import Foundation
import SwiftData
import FocusGuardKit

@Model
final class UsageLimit: BlockTargetsOwner {
    @Attribute(.unique) var id: UUID
    var name: String
    var groupIDs: [UUID]
    /// Individually picked apps; may hold a single application token or several.
    var selectionData: Data
    var dailyLimitMinutes: Int
    var isEnabled: Bool
    var createdAt: Date

    init(name: String, dailyLimitMinutes: Int, groupIDs: [UUID] = [], selectionData: Data = Data(), isEnabled: Bool = true) {
        self.id = UUID()
        self.name = name
        self.groupIDs = groupIDs
        self.selectionData = selectionData
        self.dailyLimitMinutes = dailyLimitMinutes
        self.isEnabled = isEnabled
        self.createdAt = .now
    }

    var ruleKey: RuleKey { RuleKey(reason: .usageLimit, id: id) }
}

@Model
final class BlockingSchedule: BlockTargetsOwner {
    @Attribute(.unique) var id: UUID
    var name: String
    /// Wall-clock minutes since midnight; see `TimeOfDay`.
    var startMinutes: Int
    var endMinutes: Int
    var selectedWeekdays: [Int]
    var groupIDs: [UUID]
    var selectionData: Data
    var isEnabled: Bool
    var createdAt: Date

    init(name: String, window: RecurringWindow, groupIDs: [UUID] = [], selectionData: Data = Data(), isEnabled: Bool = true) {
        self.id = UUID()
        self.name = name
        self.startMinutes = window.start.minutesSinceMidnight
        self.endMinutes = window.end.minutesSinceMidnight
        self.selectedWeekdays = window.weekdays.map(\.rawValue).sorted()
        self.groupIDs = groupIDs
        self.selectionData = selectionData
        self.isEnabled = isEnabled
        self.createdAt = .now
    }

    var window: RecurringWindow {
        get {
            RecurringWindow(
                start: TimeOfDay(minutesSinceMidnight: startMinutes),
                end: TimeOfDay(minutesSinceMidnight: endMinutes),
                weekdays: Set(selectedWeekdays.compactMap(Weekday.init(rawValue:)))
            )
        }
        set {
            startMinutes = newValue.start.minutesSinceMidnight
            endMinutes = newValue.end.minutesSinceMidnight
            selectedWeekdays = newValue.weekdays.map(\.rawValue).sorted()
        }
    }

    var ruleKey: RuleKey { RuleKey(reason: .schedule, id: id) }
}

@Model
final class AllDayRule: BlockTargetsOwner {
    @Attribute(.unique) var id: UUID
    var name: String
    var selectedWeekdays: [Int]
    var groupIDs: [UUID]
    var selectionData: Data
    var isEnabled: Bool
    var effectiveStartDate: Date
    var effectiveEndDate: Date?
    var createdAt: Date

    init(name: String, dayRule: DayRule, groupIDs: [UUID] = [], selectionData: Data = Data(), isEnabled: Bool = true) {
        self.id = UUID()
        self.name = name
        self.selectedWeekdays = dayRule.weekdays.map(\.rawValue).sorted()
        self.groupIDs = groupIDs
        self.selectionData = selectionData
        self.isEnabled = isEnabled
        self.effectiveStartDate = dayRule.effectiveStart
        self.effectiveEndDate = dayRule.effectiveEnd
        self.createdAt = .now
    }

    var dayRule: DayRule {
        get {
            DayRule(
                weekdays: Set(selectedWeekdays.compactMap(Weekday.init(rawValue:))),
                effectiveStart: effectiveStartDate,
                effectiveEnd: effectiveEndDate
            )
        }
        set {
            selectedWeekdays = newValue.weekdays.map(\.rawValue).sorted()
            effectiveStartDate = newValue.effectiveStart
            effectiveEndDate = newValue.effectiveEnd
        }
    }

    var ruleKey: RuleKey { RuleKey(reason: .allDay, id: id) }
}

@Model
final class FocusSession: BlockTargetsOwner {
    @Attribute(.unique) var id: UUID
    var duration: TimeInterval
    var startDate: Date
    /// Planned end.
    var endDate: Date
    var actualEndDate: Date?
    var statusRaw: String
    var groupIDs: [UUID]
    var selectionData: Data

    init(duration: TimeInterval, startDate: Date, groupIDs: [UUID], selectionData: Data) {
        self.id = UUID()
        self.duration = duration
        self.startDate = startDate
        self.endDate = startDate.addingTimeInterval(duration)
        self.statusRaw = FocusSessionStatus.active.rawValue
        self.groupIDs = groupIDs
        self.selectionData = selectionData
    }

    var status: FocusSessionStatus {
        get { FocusSessionStatus(rawValue: statusRaw) ?? .interrupted }
        set { statusRaw = newValue.rawValue }
    }

    var interval: DateInterval { DateInterval(start: startDate, end: endDate) }
    var ruleKey: RuleKey { RuleKey(reason: .focusSession, id: id) }

    var record: FocusSessionRecord {
        FocusSessionRecord(start: startDate, plannedEnd: endDate, actualEnd: actualEndDate, status: status)
    }
}

@Model
final class ShieldTheme {
    @Attribute(.unique) var id: UUID
    var title: String
    var subtitle: String
    var backgroundStyle: String
    var appearance: String
    var template: String
    /// Remaining styling fields, encoded as `ShieldThemeSnapshot`.
    var payload: Data

    init(snapshot: ShieldThemeSnapshot) {
        self.id = UUID()
        self.title = snapshot.title
        self.subtitle = snapshot.subtitle
        self.backgroundStyle = snapshot.backgroundStyle.rawValue
        self.appearance = snapshot.appearance.rawValue
        self.template = snapshot.template.rawValue
        self.payload = (try? JSONEncoder().encode(snapshot)) ?? Data()
    }

    var snapshot: ShieldThemeSnapshot {
        get {
            var value = (try? JSONDecoder().decode(ShieldThemeSnapshot.self, from: payload)) ?? .template(.motivational)
            value.title = title
            value.subtitle = subtitle
            value.backgroundStyle = ShieldBackgroundStyle(rawValue: backgroundStyle) ?? value.backgroundStyle
            value.appearance = ShieldAppearance(rawValue: appearance) ?? value.appearance
            value.template = ShieldTemplate(rawValue: template) ?? value.template
            return value
        }
        set {
            title = newValue.title
            subtitle = newValue.subtitle
            backgroundStyle = newValue.backgroundStyle.rawValue
            appearance = newValue.appearance.rawValue
            template = newValue.template.rawValue
            payload = (try? JSONEncoder().encode(newValue)) ?? Data()
        }
    }
}
