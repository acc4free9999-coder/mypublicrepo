import Foundation

public enum BlockReason: String, Codable, Sendable, CaseIterable {
    case focusSession
    case usageLimit
    case schedule
    case allDay

    /// Lower is monitored first when the DeviceActivity quota is exceeded.
    var monitoringPriority: Int {
        switch self {
        case .focusSession: 0
        case .usageLimit: 1
        case .schedule: 2
        case .allDay: 3
        }
    }
}

/// Stable identity of a rule. Its raw value is used both as the `ManagedSettingsStore` name
/// and the `DeviceActivityName`, so every rule owns exactly one store and one activity.
public struct RuleKey: Hashable, Codable, Sendable, RawRepresentable, Comparable {
    public let reason: BlockReason
    public let id: UUID

    public init(reason: BlockReason, id: UUID) {
        self.reason = reason
        self.id = id
    }

    public var rawValue: String { "\(reason.rawValue).\(id.uuidString)" }

    public init?(rawValue: String) {
        let parts = rawValue.split(separator: ".", maxSplits: 1)
        guard parts.count == 2,
              let reason = BlockReason(rawValue: String(parts[0])),
              let id = UUID(uuidString: String(parts[1])) else { return nil }
        self.init(reason: reason, id: id)
    }

    public static func < (lhs: RuleKey, rhs: RuleKey) -> Bool {
        (lhs.reason.monitoringPriority, lhs.id.uuidString) < (rhs.reason.monitoringPriority, rhs.id.uuidString)
    }
}

public enum RuleCondition: Codable, Hashable, Sendable {
    case recurring(RecurringWindow)
    case days(DayRule)
    case usageLimit(minutes: Int)
    case session(DateInterval)
}

public struct RuleDescriptor: Codable, Hashable, Sendable, Identifiable {
    public var key: RuleKey
    public var isEnabled: Bool
    public var condition: RuleCondition

    public init(key: RuleKey, isEnabled: Bool, condition: RuleCondition) {
        self.key = key
        self.isEnabled = isEnabled
        self.condition = condition
    }

    public var id: RuleKey { key }
}

public struct EvaluationContext: Sendable {
    public var date: Date
    public var calendar: Calendar
    public var usage: [UUID: UsageRecord]

    public init(date: Date, calendar: Calendar, usage: [UUID: UsageRecord] = [:]) {
        self.date = date
        self.calendar = calendar
        self.usage = usage
    }
}

public enum RuleEvaluator {
    public static func isActive(_ rule: RuleDescriptor, in context: EvaluationContext) -> Bool {
        guard rule.isEnabled else { return false }
        switch rule.condition {
        case .recurring(let window):
            return window.contains(context.date, calendar: context.calendar)
        case .days(let dayRule):
            return dayRule.contains(context.date, calendar: context.calendar)
        case .usageLimit(let minutes):
            let today = DayKey(date: context.date, calendar: context.calendar)
            let used = context.usage[rule.key.id]?.usedMinutes(on: today) ?? 0
            return UsageLimitCalculator.isLimitReached(used: used, limit: minutes)
        case .session(let interval):
            return context.date >= interval.start && context.date < interval.end
        }
    }

    public static func activeKeys(for rules: [RuleDescriptor], in context: EvaluationContext) -> Set<RuleKey> {
        Set(rules.filter { isActive($0, in: context) }.map(\.key))
    }

    /// Union of the targets of all active rules — an item is blocked if ANY active rule blocks it.
    public static func blockedTargets<T: Hashable>(activeKeys: Set<RuleKey>, targets: [RuleKey: Set<T>]) -> Set<T> {
        activeKeys.reduce(into: Set<T>()) { result, key in
            result.formUnion(targets[key] ?? [])
        }
    }

    public static func blockingRules<T: Hashable>(for item: T, activeKeys: Set<RuleKey>, targets: [RuleKey: Set<T>]) -> [RuleKey] {
        activeKeys.filter { targets[$0]?.contains(item) == true }.sorted()
    }
}

/// Which per-rule stores to write and which to clear. Because each rule owns its own store,
/// clearing one rule never touches shields that another rule applied.
public struct ShieldPlan: Equatable, Sendable {
    public let storesToApply: Set<RuleKey>
    public let storesToClear: Set<RuleKey>

    public static func make(active: Set<RuleKey>, previouslyApplied: Set<RuleKey>, known: Set<RuleKey>) -> ShieldPlan {
        ShieldPlan(
            storesToApply: active,
            storesToClear: previouslyApplied.union(known).subtracting(active)
        )
    }
}

/// iOS allows a limited number of simultaneously monitored DeviceActivity schedules.
public enum MonitoringPlanner {
    public static let activityQuota = 20

    public struct Result: Equatable, Sendable {
        public let monitored: [RuleKey]
        public let overflow: [RuleKey]
    }

    public static func plan(rules: [RuleDescriptor], now: Date, quota: Int = activityQuota) -> Result {
        let candidates = rules
            .filter { rule in
                guard rule.isEnabled else { return false }
                if case .session(let interval) = rule.condition { return interval.end > now }
                return true
            }
            .map(\.key)
            .sorted()
        return Result(
            monitored: Array(candidates.prefix(quota)),
            overflow: Array(candidates.dropFirst(quota))
        )
    }
}
