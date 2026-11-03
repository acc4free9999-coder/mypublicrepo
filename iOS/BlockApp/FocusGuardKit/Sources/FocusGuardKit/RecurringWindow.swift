import Foundation

public enum RuleValidationIssue: Hashable, Sendable {
    case noWeekdays
    case durationTooShort(minimumMinutes: Int)
    case startEqualsEnd
    case endDateBeforeStartDate
    case invalidLimit
    case noTargets

    public var message: String {
        switch self {
        case .noWeekdays: "Select at least one day."
        case .durationTooShort(let m): "iOS requires blocks to last at least \(m) minutes."
        case .startEqualsEnd: "Start and end can't be the same. Use an All-Day rule instead."
        case .endDateBeforeStartDate: "The end date must be on or after the start date."
        case .invalidLimit: "Choose a limit of at least 1 minute."
        case .noTargets: "Choose at least one app, category, or group."
        }
    }
}

/// A repeating daily time window filtered by weekday. When `end <= start` the window is
/// overnight and belongs to the weekday on which it *starts* (e.g. Fri 22:00 – Sat 07:00).
public struct RecurringWindow: Codable, Hashable, Sendable {
    /// DeviceActivity rejects intervals shorter than 15 minutes.
    public static let minimumDurationMinutes = 15

    public var start: TimeOfDay
    public var end: TimeOfDay
    public var weekdays: Set<Weekday>

    public init(start: TimeOfDay, end: TimeOfDay, weekdays: Set<Weekday>) {
        self.start = start
        self.end = end
        self.weekdays = weekdays
    }

    public var isOvernight: Bool { end.minutesSinceMidnight <= start.minutesSinceMidnight }

    public var durationMinutes: Int {
        let d = end.minutesSinceMidnight - start.minutesSinceMidnight
        return d > 0 ? d : d + TimeOfDay.minutesPerDay
    }

    public func contains(_ date: Date, calendar: Calendar) -> Bool {
        let m = TimeOfDay(date: date, calendar: calendar).minutesSinceMidnight
        let today = Weekday(date: date, calendar: calendar)
        let s = start.minutesSinceMidnight
        let e = end.minutesSinceMidnight

        if !isOvernight {
            return weekdays.contains(today) && m >= s && m < e
        }
        if m >= s { return weekdays.contains(today) }
        if m < e { return weekdays.contains(today.previous) }
        return false
    }

    /// The end of the occurrence that contains `date`, or nil if the window isn't active.
    public func endOfOccurrence(containing date: Date, calendar: Calendar) -> Date? {
        guard contains(date, calendar: calendar) else { return nil }
        let m = TimeOfDay(date: date, calendar: calendar).minutesSinceMidnight
        let endsTomorrow = isOvernight && m >= start.minutesSinceMidnight
        let base = endsTomorrow ? (calendar.date(byAdding: .day, value: 1, to: date) ?? date) : date
        return end.date(on: base, calendar: calendar)
    }

    public func nextStart(after date: Date, calendar: Calendar) -> Date? {
        weekdays.compactMap { day in
            calendar.nextDate(
                after: date,
                matching: DateComponents(hour: start.hour, minute: start.minute, weekday: day.rawValue),
                matchingPolicy: .nextTime
            )
        }.min()
    }

    public var validationIssues: [RuleValidationIssue] {
        var issues: [RuleValidationIssue] = []
        if weekdays.isEmpty { issues.append(.noWeekdays) }
        if start == end {
            issues.append(.startEqualsEnd)
        } else if durationMinutes < Self.minimumDurationMinutes {
            issues.append(.durationTooShort(minimumMinutes: Self.minimumDurationMinutes))
        }
        return issues
    }
}
