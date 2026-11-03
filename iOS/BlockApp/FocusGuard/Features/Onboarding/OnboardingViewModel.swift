import Foundation
import SwiftData
@preconcurrency import FamilyControls
import FocusGuardKit

@MainActor
@Observable
final class OnboardingViewModel {
    enum Step: Int, CaseIterable {
        case welcome, howItWorks, authorization, permissionsInfo, selectApps, firstRule, done
    }

    enum FirstRule: String, CaseIterable, Identifiable {
        case usageLimit, workHours, nightRoutine, none

        var id: String { rawValue }

        var title: String {
            switch self {
            case .usageLimit: "Daily limit"
            case .workHours: "Work hours"
            case .nightRoutine: "Night routine"
            case .none: "Decide later"
            }
        }

        var detail: String {
            switch self {
            case .usageLimit: "Block after 30 minutes of use each day."
            case .workHours: "Block 09:00 – 17:00 on weekdays."
            case .nightRoutine: "Block 22:00 – 07:00 every night."
            case .none: "Just save the group for now."
            }
        }

        var symbol: String {
            switch self {
            case .usageLimit: "hourglass"
            case .workHours: "briefcase.fill"
            case .nightRoutine: "moon.stars.fill"
            case .none: "clock.arrow.circlepath"
            }
        }
    }

    var step: Step = .welcome
    var selection = FamilyActivitySelection()
    var groupName = "Distractions"
    var category: BlockCategory = .socialMedia
    var firstRule: FirstRule = .usageLimit
    var isRequesting = false

    private let authorization: any AuthorizationServicing
    private let notifications: any NotificationServicing
    private let repository: RulesRepository
    private let preferences: PreferencesStore

    init(authorization: any AuthorizationServicing, notifications: any NotificationServicing, repository: RulesRepository, preferences: PreferencesStore) {
        self.authorization = authorization
        self.notifications = notifications
        self.repository = repository
        self.preferences = preferences
    }

    var authorizationState: AuthorizationState { authorization.state }
    var authorizationError: String? { authorization.lastErrorMessage }
    var progress: Double { Double(step.rawValue) / Double(Step.allCases.count - 1) }

    var canContinue: Bool {
        switch step {
        case .selectApps: !selection.isEmpty && !groupName.trimmingCharacters(in: .whitespaces).isEmpty
        default: true
        }
    }

    func advance() {
        switch step {
        case .permissionsInfo where authorization.state != .approved:
            // Without Screen Time access the picker can't show apps; let the user explore instead.
            step = .done
        default:
            step = Step(rawValue: step.rawValue + 1) ?? .done
        }
    }

    func back() {
        guard let previous = Step(rawValue: step.rawValue - 1) else { return }
        step = previous
    }

    func requestAuthorization() async {
        isRequesting = true
        defer { isRequesting = false }
        if await authorization.request() == .approved {
            advance()
        }
    }

    func finish() async {
        if authorization.state == .approved, !selection.isEmpty {
            let group = AppBlockGroup(name: groupName.trimmingCharacters(in: .whitespaces), category: category, selection: selection)
            repository.insert(group)
            switch firstRule {
            case .usageLimit:
                repository.insert(UsageLimit(name: group.name, dailyLimitMinutes: 30, groupIDs: [group.id]))
            case .workHours:
                repository.insert(BlockingSchedule(
                    name: "Work hours",
                    window: RecurringWindow(start: TimeOfDay(hour: 9, minute: 0), end: TimeOfDay(hour: 17, minute: 0), weekdays: Weekday.workdays),
                    groupIDs: [group.id]
                ))
            case .nightRoutine:
                repository.insert(BlockingSchedule(
                    name: "Night routine",
                    window: RecurringWindow(start: TimeOfDay(hour: 22, minute: 0), end: TimeOfDay(hour: 7, minute: 0), weekdays: Weekday.everyDay),
                    groupIDs: [group.id]
                ))
            case .none:
                break
            }
        }
        await notifications.requestAuthorization()
        preferences.value.hasCompletedOnboarding = true
    }
}
