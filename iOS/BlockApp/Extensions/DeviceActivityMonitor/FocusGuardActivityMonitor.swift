import DeviceActivity
import Foundation
import FocusGuardKit

/// Woken by iOS at schedule boundaries and usage thresholds. Every callback records the fact
/// it learned and then recomputes all shields from scratch via `ShieldReconciler`.
final class FocusGuardActivityMonitor: DeviceActivityMonitor {
    private let store = SharedStore()

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        let now = Date().roundedToNearestMinute()
        let key = RuleKey(rawValue: activity.rawValue)
        reconcile(at: now) { runtime in
            // A usage-limit interval starts each day: this is the daily reset.
            if let key, key.reason == .usageLimit {
                runtime.usage[key.id] = UsageRecord(day: DayKey(date: now, calendar: .current))
            }
        }
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        reconcile(at: Date().roundedToNearestMinute())
    }

    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventDidReachThreshold(event, activity: activity)
        guard let milestone = UsageMilestoneEvent(rawValue: event.rawValue) else { return }
        let configuration = store.loadConfiguration()
        let key = RuleKey(reason: .usageLimit, id: milestone.limitID)
        guard let rule = configuration.rule(for: key),
              case .usageLimit(let limit) = rule.descriptor.condition else { return }

        let now = Date()
        let calendar = Calendar.current
        let today = DayKey(date: now, calendar: calendar)
        let prefs = configuration.notifications

        let notification: (title: String, body: String)? = store.updateRuntime { runtime in
            var record = runtime.usage[key.id] ?? UsageRecord(day: today)
            record.recordMilestone(milestone.minutes, on: today)
            var message: (String, String)?

            if UsageLimitCalculator.isLimitReached(used: record.usedMinutes, limit: limit) {
                if record.limitReachedAt == nil {
                    record.limitReachedAt = now
                    if prefs.limitReached {
                        message = ("Daily limit reached", "You've used your \(limit) minutes for “\(rule.name)”. It's blocked until midnight.")
                    }
                }
            } else if UsageLimitCalculator.shouldSendWarning(used: record.usedMinutes, limit: limit, alreadySent: record.warningSent) {
                record.warningSent = true
                if prefs.limitWarnings {
                    let remaining = UsageLimitCalculator.remainingMinutes(used: record.usedMinutes, limit: limit)
                    message = ("Almost at your limit", "\(remaining) minutes left today for “\(rule.name)”.")
                }
            }

            runtime.usage[key.id] = record
            ShieldReconciler.reconcile(configuration: configuration, runtime: &runtime, at: now, calendar: calendar, applier: ManagedSettingsShieldApplier())
            return message
        } ?? nil

        if let notification {
            LocalNotifier.post(id: "limit.\(key.id).\(milestone.minutes)", title: notification.title, body: notification.body, thread: "limits")
        }
    }

    override func intervalWillStartWarning(for activity: DeviceActivityName) {
        super.intervalWillStartWarning(for: activity)
        guard let key = RuleKey(rawValue: activity.rawValue), key.reason == .schedule else { return }
        let configuration = store.loadConfiguration()
        guard configuration.notifications.upcomingBlocks,
              let rule = configuration.rule(for: key),
              case .recurring(let window) = rule.descriptor.condition else { return }
        // Schedules repeat daily; only warn if the upcoming occurrence is on a selected weekday.
        let startsAt = window.start.date(on: Date().addingTimeInterval(15 * 60), calendar: .current)
        guard window.contains(startsAt, calendar: .current) else { return }
        LocalNotifier.post(
            id: "upcoming.\(key.id)",
            title: "Block starting soon",
            body: "“\(rule.name)” starts at \(startsAt.formatted(date: .omitted, time: .shortened)).",
            thread: "schedules"
        )
    }

    private func reconcile(at date: Date, mutate: (inout RuntimeState) -> Void = { _ in }) {
        let configuration = store.loadConfiguration()
        store.updateRuntime { runtime in
            mutate(&runtime)
            ShieldReconciler.reconcile(configuration: configuration, runtime: &runtime, at: date, calendar: .current, applier: ManagedSettingsShieldApplier())
        }
    }
}
