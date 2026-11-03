import Foundation
import SwiftData
import Testing
@preconcurrency import FamilyControls
import FocusGuardKit
@testable import FocusGuard

@MainActor
final class MockMonitor: ActivityMonitoring {
    var monitoredActivityNames: Set<String> = []
    var started: [String] = []
    var stopped: [String] = []

    func startMonitoring(_ spec: ActivitySpec) throws {
        started.append(spec.name.rawValue)
        monitoredActivityNames.insert(spec.name.rawValue)
    }

    func stopMonitoring(_ names: [String]) {
        stopped.append(contentsOf: names)
        monitoredActivityNames.subtract(names)
    }
}

final class MockApplier: ShieldApplying, @unchecked Sendable {
    var applied: [RuleKey] = []
    var cleared: [RuleKey] = []
    func apply(_ selection: FamilyActivitySelection, to key: RuleKey) { applied.append(key) }
    func clear(_ key: RuleKey) { cleared.append(key) }
}

@MainActor
final class MockAuthorization: AuthorizationServicing {
    var state: AuthorizationState
    var lastErrorMessage: String?
    init(_ state: AuthorizationState) { self.state = state }
    func refresh() {}
    func request() async -> AuthorizationState { state }
}

@MainActor
struct EngineHarness {
    let container: ModelContainer
    let store: SharedStore
    let monitor = MockMonitor()
    let applier = MockApplier()
    let authorization: MockAuthorization
    let engine: BlockingEngine
    var context: ModelContext { container.mainContext }

    init(auth: AuthorizationState = .approved, now: Date = .now) throws {
        container = try PersistenceController.makeContainer(inMemory: true)
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        store = SharedStore(directory: directory)
        authorization = MockAuthorization(auth)
        engine = BlockingEngine(
            context: container.mainContext,
            sharedStore: store,
            monitor: monitor,
            applier: applier,
            authorization: authorization,
            preferences: PreferencesStore(defaults: UserDefaults(suiteName: UUID().uuidString)!),
            signatureDefaults: UserDefaults(suiteName: UUID().uuidString)!,
            now: { now },
            calendar: { Calendar(identifier: .gregorian) }
        )
    }
}

@MainActor
@Suite("BlockingEngine integration")
struct BlockingEngineTests {
    @Test func persistsConfigurationForExtensions() throws {
        let h = try EngineHarness()
        let schedule = BlockingSchedule(name: "Work", window: RecurringWindow(start: TimeOfDay(hour: 9, minute: 0), end: TimeOfDay(hour: 17, minute: 0), weekdays: Weekday.workdays))
        h.context.insert(schedule)
        h.engine.synchronize()

        let saved = h.store.loadConfiguration()
        #expect(saved.rules.count == 1)
        #expect(saved.rule(for: schedule.ruleKey)?.name == "Work")
        #expect(saved.theme == ShieldThemeSnapshot.template(.motivational))
    }

    @Test func rulesWithoutTargetsAreNeverMonitored() throws {
        let h = try EngineHarness()
        h.context.insert(UsageLimit(name: "Empty", dailyLimitMinutes: 30))
        h.engine.synchronize()

        #expect(h.engine.configuration.monitoredKeys.isEmpty)
        #expect(h.monitor.started.isEmpty)
        #expect(h.applier.applied.isEmpty)
    }

    @Test func staleActivitiesAndStoresAreCleanedUp() throws {
        let h = try EngineHarness()
        let orphan = RuleKey(reason: .schedule, id: UUID())
        h.monitor.monitoredActivityNames = [orphan.rawValue]
        h.store.updateRuntime { $0.appliedStores = [orphan] }

        h.engine.synchronize()

        #expect(h.monitor.stopped == [orphan.rawValue])
        #expect(h.applier.cleared.contains(orphan), "A deleted rule's shield must be removed")
        #expect(h.store.loadRuntime().appliedStores.isEmpty)
    }

    @Test func expiredFocusSessionIsCompleted() throws {
        let now = Date()
        let h = try EngineHarness(now: now)
        let session = FocusSession(duration: 900, startDate: now.addingTimeInterval(-1000), groupIDs: [], selectionData: Data())
        h.context.insert(session)
        h.engine.synchronize()

        #expect(session.status == .completed)
        #expect(session.actualEndDate == session.endDate)
        #expect(h.engine.configuration.rules.isEmpty)
    }

    @Test func focusSessionInterruptedWhenAccessLost() throws {
        let now = Date()
        let h = try EngineHarness(auth: .denied, now: now)
        let session = FocusSession(duration: 900, startDate: now.addingTimeInterval(-1000), groupIDs: [], selectionData: Data())
        h.context.insert(session)
        h.engine.synchronize()

        #expect(session.status == .interrupted)
    }

    @Test func noSystemCallsWithoutAuthorization() throws {
        let h = try EngineHarness(auth: .denied)
        h.monitor.monitoredActivityNames = [RuleKey(reason: .allDay, id: UUID()).rawValue]
        h.engine.synchronize()

        #expect(h.monitor.started.isEmpty)
        #expect(h.monitor.stopped.isEmpty)
        #expect(h.applier.cleared.isEmpty)
    }

    @Test func removeAllBlockingClearsEverything() throws {
        let h = try EngineHarness()
        let key = RuleKey(reason: .usageLimit, id: UUID())
        h.monitor.monitoredActivityNames = [key.rawValue]
        h.store.updateRuntime { $0.appliedStores = [key] }

        h.engine.removeAllBlocking()

        #expect(h.monitor.monitoredActivityNames.isEmpty)
        #expect(h.applier.cleared.contains(key))
    }
}

@MainActor
@Suite("Configuration builder")
struct ConfigurationBuilderTests {
    @Test func invalidAndExpiredRulesAreDisabled() throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let calendar = Calendar(identifier: .gregorian)
        let now = Date()
        let tooShort = BlockingSchedule(name: "Short", window: RecurringWindow(start: TimeOfDay(hour: 9, minute: 0), end: TimeOfDay(hour: 9, minute: 5), weekdays: Weekday.everyDay))
        let expired = AllDayRule(name: "Old", dayRule: DayRule(weekdays: Weekday.everyDay, effectiveStart: now.addingTimeInterval(-10 * 86_400), effectiveEnd: now.addingTimeInterval(-2 * 86_400)))
        container.mainContext.insert(tooShort)
        container.mainContext.insert(expired)

        let config = ConfigurationBuilder.build(.init(
            groups: [], limits: [], schedules: [tooShort], allDayRules: [expired], focusSessions: [],
            theme: .template(.darkFocus), notifications: .init()
        ), now: now, calendar: calendar)

        #expect(config.rules.count == 2)
        #expect(config.rules.allSatisfy { !$0.descriptor.isEnabled })
        #expect(config.monitoredKeys.isEmpty)
    }

    @Test func groupReferencesResolveAndRespectGroupToggle() throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let group = AppBlockGroup(name: "Social", category: .socialMedia, selection: FamilyActivitySelection())
        let limit = UsageLimit(name: "Social", dailyLimitMinutes: 30, groupIDs: [group.id])
        container.mainContext.insert(group)
        container.mainContext.insert(limit)

        #expect(limit.resolvedSelection(groups: [group]).isEmpty)
        group.isEnabled = false
        #expect(limit.resolvedSelection(groups: [group]).isEmpty)
    }

    @Test func shieldContentUsesReasonAndAppName() {
        var theme = ShieldThemeSnapshot.template(.minimalist)
        theme.title = "Not now, {app}."
        theme.showsBlockReason = true
        let calendar = Calendar(identifier: .gregorian)
        let reason = ShieldReasonInfo(reason: .usageLimit, ruleName: "Social", endsAt: nil, limitMinutes: 30)
        let text = ShieldContentBuilder.content(theme: theme, appName: "Instagram", reasons: [reason], revealReason: false, now: .now, calendar: calendar)

        #expect(text.title == "Not now, Instagram.")
        #expect(text.subtitle.contains("30-minute"))
    }
}
