import Foundation

/// Usage observed for one limit on one day. Usage is only reported by iOS through
/// DeviceActivity threshold events, so `usedMinutes` is the highest milestone reached.
public struct UsageRecord: Codable, Hashable, Sendable {
    public var day: DayKey
    public var usedMinutes: Int
    public var warningSent: Bool
    public var limitReachedAt: Date?

    public init(day: DayKey, usedMinutes: Int = 0, warningSent: Bool = false, limitReachedAt: Date? = nil) {
        self.day = day
        self.usedMinutes = usedMinutes
        self.warningSent = warningSent
        self.limitReachedAt = limitReachedAt
    }

    /// Records from a previous day count as zero — this is the daily reset.
    public func usedMinutes(on today: DayKey) -> Int {
        day == today ? usedMinutes : 0
    }

    public mutating func recordMilestone(_ minutes: Int, on today: DayKey) {
        if day != today { self = UsageRecord(day: today) }
        usedMinutes = max(usedMinutes, minutes)
    }
}

public enum UsageLimitCalculator {
    public static let warningLeadMinutes = 5
    static let stepCandidates = [1, 2, 5, 10, 15, 20, 30, 60]

    /// Threshold events registered with DeviceActivity. Keeps roughly ten events per limit
    /// plus a warning milestone and the limit itself.
    public static func milestones(forLimit limit: Int) -> [Int] {
        guard limit > 0 else { return [] }
        let target = Int((Double(limit) / 10).rounded(.up))
        let step = stepCandidates.first { $0 >= target } ?? 60
        var values = Set(stride(from: step, to: limit, by: step))
        if limit > warningLeadMinutes { values.insert(limit - warningLeadMinutes) }
        values.insert(limit)
        return values.sorted()
    }

    public static func remainingMinutes(used: Int, limit: Int) -> Int {
        max(0, limit - used)
    }

    public static func progress(used: Int, limit: Int) -> Double {
        guard limit > 0 else { return 0 }
        return min(1, max(0, Double(used) / Double(limit)))
    }

    public static func isLimitReached(used: Int, limit: Int) -> Bool {
        limit > 0 && used >= limit
    }

    public static func shouldSendWarning(used: Int, limit: Int, alreadySent: Bool) -> Bool {
        !alreadySent
            && !isLimitReached(used: used, limit: limit)
            && limit > warningLeadMinutes
            && limit - used <= warningLeadMinutes
    }
}

/// Encodes a usage milestone into a DeviceActivityEvent name: `milestone.<limitID>.<minutes>`.
public struct UsageMilestoneEvent: Hashable, Sendable, RawRepresentable {
    public let limitID: UUID
    public let minutes: Int

    public init(limitID: UUID, minutes: Int) {
        self.limitID = limitID
        self.minutes = minutes
    }

    public var rawValue: String { "milestone.\(limitID.uuidString).\(minutes)" }

    public init?(rawValue: String) {
        let parts = rawValue.split(separator: ".")
        guard parts.count == 3, parts[0] == "milestone",
              let id = UUID(uuidString: String(parts[1])),
              let minutes = Int(parts[2]) else { return nil }
        self.init(limitID: id, minutes: minutes)
    }
}
