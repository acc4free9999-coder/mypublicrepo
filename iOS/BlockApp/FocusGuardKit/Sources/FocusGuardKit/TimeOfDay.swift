import Foundation

/// A wall-clock time, independent of time zone. Schedules are stored this way so that
/// "08:00" keeps meaning 08:00 local time across time-zone and daylight-saving changes.
public struct TimeOfDay: Codable, Hashable, Sendable, Comparable {
    public static let minutesPerDay = 1440

    public let minutesSinceMidnight: Int

    public init(minutesSinceMidnight: Int) {
        let m = minutesSinceMidnight % Self.minutesPerDay
        self.minutesSinceMidnight = m < 0 ? m + Self.minutesPerDay : m
    }

    public init(hour: Int, minute: Int) {
        self.init(minutesSinceMidnight: hour * 60 + minute)
    }

    public init(date: Date, calendar: Calendar) {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        self.init(hour: c.hour ?? 0, minute: c.minute ?? 0)
    }

    public var hour: Int { minutesSinceMidnight / 60 }
    public var minute: Int { minutesSinceMidnight % 60 }

    public var dateComponents: DateComponents { DateComponents(hour: hour, minute: minute) }

    /// This time on the given day. Falls forward if it lands in a DST gap.
    public func date(on day: Date, calendar: Calendar) -> Date {
        let start = calendar.startOfDay(for: day)
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: start)
            ?? start.addingTimeInterval(TimeInterval(minutesSinceMidnight * 60))
    }

    public static func < (lhs: TimeOfDay, rhs: TimeOfDay) -> Bool {
        lhs.minutesSinceMidnight < rhs.minutesSinceMidnight
    }
}

public extension Date {
    /// DeviceActivity callbacks can fire a few seconds around a boundary; snapping to the
    /// nearest minute makes evaluation match the minute precision of schedules.
    func roundedToNearestMinute() -> Date {
        Date(timeIntervalSinceReferenceDate: (timeIntervalSinceReferenceDate / 60).rounded() * 60)
    }
}
