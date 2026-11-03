import Foundation
@preconcurrency import FamilyControls
import FocusGuardKit

struct ActiveBlocker: Identifiable {
    let id: RuleKey
    let name: String
    let detail: String
    let symbol: String
}

struct UpcomingSchedule: Identifiable {
    let id: UUID
    let name: String
    let detail: String
    let isActive: Bool
}

/// Derives dashboard content from the engine state and persisted rules.
@MainActor
enum DashboardViewModel {
    static func activeBlockers(engine: BlockingEngine, now: Date = .now, calendar: Calendar = .current) -> [ActiveBlocker] {
        engine.configuration.rules
            .filter { engine.isActive($0.key) }
            .sorted { $0.key < $1.key }
            .map { rule in
                let info = ShieldReasonInfo(rule: rule, at: now, calendar: calendar)
                let until = info.endsAt.map { $0.formatted(date: .omitted, time: .shortened) }
                let (symbol, detail): (String, String) = switch rule.key.reason {
                case .focusSession: ("timer", "Focus session · until \(until ?? "")")
                case .usageLimit: ("hourglass", "Limit reached · resets at midnight")
                case .schedule: ("calendar.badge.clock", "Schedule · until \(until ?? "")")
                case .allDay: ("sun.max.fill", "All-day rule · today")
                }
                return ActiveBlocker(id: rule.key, name: rule.name, detail: detail, symbol: symbol)
            }
    }

    static func upcomingSchedules(_ schedules: [BlockingSchedule], engine: BlockingEngine, now: Date = .now, calendar: Calendar = .current) -> [UpcomingSchedule] {
        schedules
            .filter(\.isEnabled)
            .compactMap { schedule -> (Date, UpcomingSchedule)? in
                let window = schedule.window
                if engine.isActive(schedule.ruleKey), let end = window.endOfOccurrence(containing: now, calendar: calendar) {
                    return (now, UpcomingSchedule(id: schedule.id, name: schedule.name, detail: "Active until \(end.formatted(date: .omitted, time: .shortened))", isActive: true))
                }
                guard let next = window.nextStart(after: now, calendar: calendar) else { return nil }
                let label = calendar.isDateInToday(next)
                    ? "Today at \(next.formatted(date: .omitted, time: .shortened))"
                    : next.formatted(.dateTime.weekday(.wide).hour().minute())
                return (next, UpcomingSchedule(id: schedule.id, name: schedule.name, detail: label, isActive: false))
            }
            .sorted { $0.0 < $1.0 }
            .prefix(4)
            .map(\.1)
    }

    static func blockedAppCount(_ selection: FamilyActivitySelection) -> Int {
        selection.applicationTokens.count + selection.webDomainTokens.count
    }

    static func greeting(now: Date = .now, calendar: Calendar = .current) -> String {
        switch calendar.component(.hour, from: now) {
        case 5..<12: "Good morning"
        case 12..<18: "Good afternoon"
        default: "Good evening"
        }
    }
}
