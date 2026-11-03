import Foundation
@preconcurrency import DeviceActivity
@preconcurrency import FamilyControls
import FocusGuardKit

struct ActivitySpec {
    let name: DeviceActivityName
    let schedule: DeviceActivitySchedule
    let events: [DeviceActivityEvent.Name: DeviceActivityEvent]
    /// Changes whenever the schedule, events or targets change; used to avoid needless restarts.
    let signature: Data
}

enum ActivityScheduleFactory {
    static let upcomingWarningMinutes = 10

    static func spec(for rule: ConfiguredRule, calendar: Calendar) -> ActivitySpec {
        let name = DeviceActivityName(rawValue: rule.key.rawValue)
        let wholeDay = (start: DateComponents(hour: 0, minute: 0), end: DateComponents(hour: 23, minute: 59))
        var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
        let schedule: DeviceActivitySchedule

        switch rule.descriptor.condition {
        case .recurring(let window):
            // Repeats daily; the monitor applies the weekday filter, costing one activity per schedule.
            schedule = DeviceActivitySchedule(
                intervalStart: window.start.dateComponents,
                intervalEnd: window.end.dateComponents,
                repeats: true,
                warningTime: DateComponents(minute: upcomingWarningMinutes)
            )
        case .days:
            schedule = DeviceActivitySchedule(intervalStart: wholeDay.start, intervalEnd: wholeDay.end, repeats: true)
        case .usageLimit(let minutes):
            schedule = DeviceActivitySchedule(intervalStart: wholeDay.start, intervalEnd: wholeDay.end, repeats: true)
            for milestone in UsageLimitCalculator.milestones(forLimit: minutes) {
                let eventName = DeviceActivityEvent.Name(rawValue: UsageMilestoneEvent(limitID: rule.key.id, minutes: milestone).rawValue)
                events[eventName] = DeviceActivityEvent(
                    applications: rule.selection.applicationTokens,
                    categories: rule.selection.categoryTokens,
                    webDomains: rule.selection.webDomainTokens,
                    threshold: DateComponents(minute: milestone),
                    includesPastActivity: true
                )
            }
        case .session(let interval):
            let units: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
            schedule = DeviceActivitySchedule(
                intervalStart: calendar.dateComponents(units, from: interval.start),
                intervalEnd: calendar.dateComponents(units, from: interval.end),
                repeats: false
            )
        }

        return ActivitySpec(name: name, schedule: schedule, events: events, signature: signature(of: rule))
    }

    private struct SignatureSource: Encodable {
        let condition: RuleCondition
        let selection: FamilyActivitySelection
    }

    private static func signature(of rule: ConfiguredRule) -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        return (try? encoder.encode(SignatureSource(condition: rule.descriptor.condition, selection: rule.selection))) ?? Data()
    }
}

@MainActor
protocol ActivityMonitoring: AnyObject {
    var monitoredActivityNames: Set<String> { get }
    func startMonitoring(_ spec: ActivitySpec) throws
    func stopMonitoring(_ names: [String])
}

@MainActor
final class DeviceActivityMonitoringService: ActivityMonitoring {
    private let center = DeviceActivityCenter()

    var monitoredActivityNames: Set<String> {
        Set(center.activities.map(\.rawValue))
    }

    func startMonitoring(_ spec: ActivitySpec) throws {
        try center.startMonitoring(spec.name, during: spec.schedule, events: spec.events)
    }

    func stopMonitoring(_ names: [String]) {
        guard !names.isEmpty else { return }
        center.stopMonitoring(names.map { DeviceActivityName(rawValue: $0) })
    }
}
