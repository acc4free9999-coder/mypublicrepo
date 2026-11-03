import Foundation
import SwiftData
@preconcurrency import FamilyControls
import FocusGuardKit

struct EngineState {
    var activeKeys: Set<RuleKey> = []
    var overflowKeys: Set<RuleKey> = []
    var monitoringErrors: [RuleKey: String] = [:]
    var usage: [UUID: UsageRecord] = [:]
    var shieldDismissalsToday = 0
    var lastSync: Date?
    var lastError: String?
}

/// Single entry point for turning user rules into system state.
///
/// 1. Builds a `BlockingConfiguration` snapshot and writes it to the App Group.
/// 2. Diffs it against registered DeviceActivity schedules (restarting only what changed).
/// 3. Reconciles per-rule ManagedSettings stores for the current moment.
///
/// It never runs in the background: after this, DeviceActivity wakes the monitor extension,
/// which runs the same reconciliation using the same shared code.
@MainActor
@Observable
final class BlockingEngine {
    private static let signaturesKey = "activity.signatures"

    private(set) var state = EngineState()
    private(set) var configuration = BlockingConfiguration()

    private let context: ModelContext
    private let sharedStore: SharedStore
    private let monitor: any ActivityMonitoring
    private let applier: any ShieldApplying
    private let authorization: any AuthorizationServicing
    private let preferences: PreferencesStore
    private let signatureDefaults: UserDefaults
    private let now: () -> Date
    private let calendar: () -> Calendar

    init(
        context: ModelContext,
        sharedStore: SharedStore = SharedStore(),
        monitor: any ActivityMonitoring,
        applier: any ShieldApplying,
        authorization: any AuthorizationServicing,
        preferences: PreferencesStore,
        signatureDefaults: UserDefaults = AppGroup.defaults,
        now: @escaping () -> Date = { Date() },
        calendar: @escaping () -> Calendar = { Calendar.current }
    ) {
        self.context = context
        self.sharedStore = sharedStore
        self.monitor = monitor
        self.applier = applier
        self.authorization = authorization
        self.preferences = preferences
        self.signatureDefaults = signatureDefaults
        self.now = now
        self.calendar = calendar
    }

    // MARK: - Synchronization

    /// Call after any rule change, on launch, on foreground, and on authorization changes.
    func synchronize() {
        let date = now()
        let cal = calendar()
        finalizeFocusSessions(at: date)

        let config = ConfigurationBuilder.build(fetchInput(), now: date, calendar: cal)
        configuration = config
        do {
            try sharedStore.saveConfiguration(config)
            state.lastError = nil
        } catch {
            state.lastError = "Couldn't save blocking configuration: \(error.localizedDescription)"
        }

        let enabled = Set(config.rules.filter(\.descriptor.isEnabled).map(\.key))
        state.overflowKeys = enabled.subtracting(config.monitoredKeys)

        if authorization.state == .approved {
            state.monitoringErrors = updateMonitoring(for: config, calendar: cal)
        } else {
            state.monitoringErrors = [:]
        }
        refreshShields()
        state.lastSync = date
    }

    /// Re-reads runtime facts written by extensions and re-applies shields for "now".
    /// Cheap enough to run on a timer while the app is in the foreground.
    func refreshShields() {
        let date = now()
        let cal = calendar()
        let hasEndedSession = configuration.rules.contains { rule in
            if case .session(let interval) = rule.descriptor.condition { return interval.end <= date }
            return false
        }
        // Rebuilding drops the ended session from the configuration, so this can't loop.
        if hasEndedSession {
            synchronize()
            return
        }

        let config = configuration
        let authorized = authorization.state == .approved

        let active: Set<RuleKey> = sharedStore.updateRuntime { runtime in
            if authorized {
                return ShieldReconciler.reconcile(configuration: config, runtime: &runtime, at: date, calendar: cal, applier: applier)
            }
            let context = EvaluationContext(date: date, calendar: cal, usage: runtime.usage)
            return RuleEvaluator.activeKeys(for: config.effectiveRules.map(\.descriptor), in: context)
        } ?? []

        let runtime = sharedStore.loadRuntime()
        state.activeKeys = active
        state.usage = runtime.usage
        state.shieldDismissalsToday = runtime.shieldDismissals[DayKey(date: date, calendar: cal).description] ?? 0
    }

    /// Stops all monitoring and clears every shield. Used when authorization is revoked.
    func removeAllBlocking() {
        monitor.stopMonitoring(Array(monitor.monitoredActivityNames))
        signatureDefaults.removeObject(forKey: Self.signaturesKey)
        sharedStore.updateRuntime { runtime in
            for key in runtime.appliedStores.union(configuration.rules.map(\.key)) {
                applier.clear(key)
            }
            runtime.appliedStores = []
        }
        state.activeKeys = []
    }

    // MARK: - Queries for UI

    func isActive(_ key: RuleKey) -> Bool { state.activeKeys.contains(key) }
    func isOverflow(_ key: RuleKey) -> Bool { state.overflowKeys.contains(key) }
    func monitoringError(for key: RuleKey) -> String? { state.monitoringErrors[key] }

    func usedMinutes(for limitID: UUID) -> Int {
        state.usage[limitID]?.usedMinutes(on: DayKey(date: now(), calendar: calendar())) ?? 0
    }

    var blockedSelection: FamilyActivitySelection {
        configuration.rules
            .filter { state.activeKeys.contains($0.key) }
            .reduce(FamilyActivitySelection()) { $0.union($1.selection) }
    }

    var allTargetedSelection: FamilyActivitySelection {
        configuration.rules
            .filter { $0.key.reason != .focusSession }
            .reduce(FamilyActivitySelection()) { $0.union($1.selection) }
    }

    func activeRuleNames(blocking selection: FamilyActivitySelection) -> [String] {
        configuration.rules
            .filter { state.activeKeys.contains($0.key) && $0.selection.intersects(selection) }
            .map(\.name)
    }

    // MARK: - Private

    private func fetchInput() -> ConfigurationBuilder.Input {
        ConfigurationBuilder.Input(
            groups: (try? context.fetch(FetchDescriptor<AppBlockGroup>())) ?? [],
            limits: (try? context.fetch(FetchDescriptor<UsageLimit>())) ?? [],
            schedules: (try? context.fetch(FetchDescriptor<BlockingSchedule>())) ?? [],
            allDayRules: (try? context.fetch(FetchDescriptor<AllDayRule>())) ?? [],
            focusSessions: activeFocusSessions(),
            theme: currentTheme().snapshot,
            notifications: preferences.value.notifications
        )
    }

    func currentTheme() -> ShieldTheme {
        if let theme = try? context.fetch(FetchDescriptor<ShieldTheme>()).first {
            return theme
        }
        let theme = ShieldTheme(snapshot: .template(.motivational))
        context.insert(theme)
        try? context.save()
        return theme
    }

    private func activeFocusSessions() -> [FocusSession] {
        let active = FocusSessionStatus.active.rawValue
        let descriptor = FetchDescriptor<FocusSession>(predicate: #Predicate { $0.statusRaw == active })
        return (try? context.fetch(descriptor)) ?? []
    }

    /// Marks sessions whose end has passed as completed (or interrupted if blocking was lost).
    private func finalizeFocusSessions(at date: Date) {
        var changed = false
        for session in activeFocusSessions() where session.endDate <= date {
            session.status = authorization.state == .approved ? .completed : .interrupted
            session.actualEndDate = session.endDate
            changed = true
        }
        if changed { try? context.save() }
    }

    private func updateMonitoring(for config: BlockingConfiguration, calendar: Calendar) -> [RuleKey: String] {
        var signatures = (signatureDefaults.dictionary(forKey: Self.signaturesKey) as? [String: Data]) ?? [:]
        let desired = config.effectiveRules
        let desiredNames = Set(desired.map(\.key.rawValue))
        let current = monitor.monitoredActivityNames

        let stale = current.subtracting(desiredNames)
        monitor.stopMonitoring(Array(stale))
        for name in stale { signatures[name] = nil }

        var errors: [RuleKey: String] = [:]
        for rule in desired {
            let name = rule.key.rawValue
            let spec = ActivityScheduleFactory.spec(for: rule, calendar: calendar)
            if current.contains(name), signatures[name] == spec.signature { continue }
            do {
                try monitor.startMonitoring(spec)
                signatures[name] = spec.signature
            } catch {
                signatures[name] = nil
                errors[rule.key] = error.localizedDescription
            }
        }
        signatureDefaults.set(signatures, forKey: Self.signaturesKey)
        return errors
    }
}
