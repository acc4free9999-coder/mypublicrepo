import Foundation
import FocusGuardKit

/// Turns persisted models into the `BlockingConfiguration` snapshot extensions consume.
/// Pure function of its inputs, so it is straightforward to test.
enum ConfigurationBuilder {
    struct Input {
        var groups: [AppBlockGroup]
        var limits: [UsageLimit]
        var schedules: [BlockingSchedule]
        var allDayRules: [AllDayRule]
        var focusSessions: [FocusSession]
        var theme: ShieldThemeSnapshot
        var notifications: NotificationPreferences
    }

    static func build(_ input: Input, now: Date, calendar: Calendar) -> BlockingConfiguration {
        var rules: [ConfiguredRule] = []

        for limit in input.limits {
            let selection = limit.resolvedSelection(groups: input.groups)
            let valid = limit.dailyLimitMinutes > 0 && !selection.isEmpty
            rules.append(ConfiguredRule(
                descriptor: RuleDescriptor(key: limit.ruleKey, isEnabled: limit.isEnabled && valid, condition: .usageLimit(minutes: limit.dailyLimitMinutes)),
                name: limit.name,
                selection: selection
            ))
        }

        for schedule in input.schedules {
            let selection = schedule.resolvedSelection(groups: input.groups)
            let window = schedule.window
            let valid = window.validationIssues.isEmpty && !selection.isEmpty
            rules.append(ConfiguredRule(
                descriptor: RuleDescriptor(key: schedule.ruleKey, isEnabled: schedule.isEnabled && valid, condition: .recurring(window)),
                name: schedule.name,
                selection: selection
            ))
        }

        for rule in input.allDayRules {
            let selection = rule.resolvedSelection(groups: input.groups)
            let dayRule = rule.dayRule
            let valid = dayRule.validationIssues(calendar: calendar).isEmpty
                && !dayRule.hasExpired(at: now, calendar: calendar)
                && !selection.isEmpty
            rules.append(ConfiguredRule(
                descriptor: RuleDescriptor(key: rule.ruleKey, isEnabled: rule.isEnabled && valid, condition: .days(dayRule)),
                name: rule.name,
                selection: selection
            ))
        }

        for session in input.focusSessions where session.status == .active && session.endDate > now {
            let selection = session.resolvedSelection(groups: input.groups)
            rules.append(ConfiguredRule(
                descriptor: RuleDescriptor(key: session.ruleKey, isEnabled: !selection.isEmpty, condition: .session(session.interval)),
                name: "Focus session",
                selection: selection
            ))
        }

        let plan = MonitoringPlanner.plan(rules: rules.map(\.descriptor), now: now)
        return BlockingConfiguration(
            rules: rules,
            monitoredKeys: plan.monitored,
            theme: input.theme,
            notifications: input.notifications,
            updatedAt: now
        )
    }
}
