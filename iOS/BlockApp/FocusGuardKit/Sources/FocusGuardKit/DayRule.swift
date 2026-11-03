import Foundation

/// Whole-day blocking on selected weekdays within an optional effective date range.
public struct DayRule: Codable, Hashable, Sendable {
    public var weekdays: Set<Weekday>
    public var effectiveStart: Date
    public var effectiveEnd: Date?

    public init(weekdays: Set<Weekday>, effectiveStart: Date, effectiveEnd: Date? = nil) {
        self.weekdays = weekdays
        self.effectiveStart = effectiveStart
        self.effectiveEnd = effectiveEnd
    }

    public func contains(_ date: Date, calendar: Calendar) -> Bool {
        guard weekdays.contains(Weekday(date: date, calendar: calendar)) else { return false }
        let day = calendar.startOfDay(for: date)
        if day < calendar.startOfDay(for: effectiveStart) { return false }
        if let end = effectiveEnd, day > calendar.startOfDay(for: end) { return false }
        return true
    }

    /// True once the effective range has fully elapsed.
    public func hasExpired(at date: Date, calendar: Calendar) -> Bool {
        guard let end = effectiveEnd else { return false }
        return calendar.startOfDay(for: date) > calendar.startOfDay(for: end)
    }

    public func validationIssues(calendar: Calendar) -> [RuleValidationIssue] {
        var issues: [RuleValidationIssue] = []
        if weekdays.isEmpty { issues.append(.noWeekdays) }
        if let end = effectiveEnd, calendar.startOfDay(for: end) < calendar.startOfDay(for: effectiveStart) {
            issues.append(.endDateBeforeStartDate)
        }
        return issues
    }
}
