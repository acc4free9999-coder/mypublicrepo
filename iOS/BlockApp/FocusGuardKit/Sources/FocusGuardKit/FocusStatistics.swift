import Foundation

public enum FocusSessionStatus: String, Codable, Sendable, CaseIterable {
    case active
    case completed
    case cancelled
    case interrupted

    public var title: String {
        switch self {
        case .active: "In progress"
        case .completed: "Completed"
        case .cancelled: "Ended early"
        case .interrupted: "Interrupted"
        }
    }
}

public struct FocusSessionRecord: Sendable, Hashable {
    public var start: Date
    public var plannedEnd: Date
    public var actualEnd: Date?
    public var status: FocusSessionStatus

    public init(start: Date, plannedEnd: Date, actualEnd: Date?, status: FocusSessionStatus) {
        self.start = start
        self.plannedEnd = plannedEnd
        self.actualEnd = actualEnd
        self.status = status
    }

    public func focusedSeconds(now: Date) -> TimeInterval {
        let end = actualEnd ?? min(now, plannedEnd)
        return max(0, end.timeIntervalSince(start))
    }
}

public struct DailyFocus: Hashable, Sendable, Identifiable {
    public let day: Date
    public let minutes: Int
    public var id: Date { day }
}

public struct FocusStatistics: Equatable, Sendable {
    public let completedCount: Int
    public let endedEarlyCount: Int
    public let totalFocusMinutes: Int
    public let completionRate: Double
    public let currentStreakDays: Int
    public let lastSevenDays: [DailyFocus]

    public static func compute(_ sessions: [FocusSessionRecord], now: Date, calendar: Calendar) -> FocusStatistics {
        let finished = sessions.filter { $0.status != .active }
        let completed = finished.filter { $0.status == .completed }
        let total = sessions.reduce(0.0) { $0 + $1.focusedSeconds(now: now) }

        let today = calendar.startOfDay(for: now)
        let days: [DailyFocus] = (0..<7).reversed().compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: -offset, to: today),
                  let next = calendar.date(byAdding: .day, value: 1, to: day) else { return nil }
            let seconds = sessions
                .filter { $0.start >= day && $0.start < next }
                .reduce(0.0) { $0 + $1.focusedSeconds(now: now) }
            return DailyFocus(day: day, minutes: Int(seconds / 60))
        }

        let completedDays = Set(completed.map { calendar.startOfDay(for: $0.start) })
        var streak = 0
        var cursor = completedDays.contains(today) ? today : calendar.date(byAdding: .day, value: -1, to: today)!
        while completedDays.contains(cursor) {
            streak += 1
            cursor = calendar.date(byAdding: .day, value: -1, to: cursor)!
        }

        return FocusStatistics(
            completedCount: completed.count,
            endedEarlyCount: finished.count - completed.count,
            totalFocusMinutes: Int(total / 60),
            completionRate: finished.isEmpty ? 0 : Double(completed.count) / Double(finished.count),
            currentStreakDays: streak,
            lastSevenDays: days
        )
    }
}
