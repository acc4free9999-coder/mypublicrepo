import Foundation
@testable import FocusGuardKit

enum Fixtures {
    static func calendar(_ identifier: String = "Europe/Berlin") -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: identifier)!
        calendar.firstWeekday = 2
        return calendar
    }

    /// 2026-03-02 is a Monday.
    static func date(_ year: Int, _ month: Int, _ day: Int, _ hour: Int, _ minute: Int = 0, calendar: Calendar = calendar()) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: hour, minute: minute))!
    }

    static func window(_ start: (Int, Int), _ end: (Int, Int), _ days: Set<Weekday>) -> RecurringWindow {
        RecurringWindow(start: TimeOfDay(hour: start.0, minute: start.1), end: TimeOfDay(hour: end.0, minute: end.1), weekdays: days)
    }

    static func key(_ reason: BlockReason) -> RuleKey { RuleKey(reason: reason, id: UUID()) }
}
