import Foundation

/// Raw values match `Calendar.Component.weekday` (1 = Sunday).
public enum Weekday: Int, CaseIterable, Codable, Sendable, Identifiable, Comparable {
    case sunday = 1, monday, tuesday, wednesday, thursday, friday, saturday

    public var id: Int { rawValue }

    public static let workdays: Set<Weekday> = [.monday, .tuesday, .wednesday, .thursday, .friday]
    public static let weekend: Set<Weekday> = [.saturday, .sunday]
    public static let everyDay: Set<Weekday> = Set(allCases)

    public static func < (lhs: Weekday, rhs: Weekday) -> Bool { lhs.rawValue < rhs.rawValue }

    public init(date: Date, calendar: Calendar) {
        self = Weekday(rawValue: calendar.component(.weekday, from: date)) ?? .sunday
    }

    public var previous: Weekday { Weekday(rawValue: rawValue == 1 ? 7 : rawValue - 1)! }
    public var next: Weekday { Weekday(rawValue: rawValue == 7 ? 1 : rawValue + 1)! }

    public func shortSymbol(calendar: Calendar = .current) -> String {
        calendar.shortWeekdaySymbols[rawValue - 1]
    }

    public func veryShortSymbol(calendar: Calendar = .current) -> String {
        calendar.veryShortWeekdaySymbols[rawValue - 1]
    }

    /// Weekdays ordered starting from the calendar's first weekday.
    public static func ordered(calendar: Calendar = .current) -> [Weekday] {
        let first = calendar.firstWeekday
        return (0..<7).map { Weekday(rawValue: (first - 1 + $0) % 7 + 1)! }
    }

    public static func summary(_ days: Set<Weekday>, calendar: Calendar = .current) -> String {
        if days == everyDay { return "Every day" }
        if days == workdays { return "Weekdays" }
        if days == weekend { return "Weekends" }
        if days.isEmpty { return "No days" }
        return ordered(calendar: calendar)
            .filter(days.contains)
            .map { $0.shortSymbol(calendar: calendar) }
            .joined(separator: ", ")
    }
}
