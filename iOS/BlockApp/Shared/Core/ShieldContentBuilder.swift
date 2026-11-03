import Foundation
import FocusGuardKit

struct ShieldReasonInfo: Equatable {
    var reason: BlockReason
    var ruleName: String
    var endsAt: Date?
    var limitMinutes: Int?

    init(reason: BlockReason, ruleName: String, endsAt: Date?, limitMinutes: Int? = nil) {
        self.reason = reason
        self.ruleName = ruleName
        self.endsAt = endsAt
        self.limitMinutes = limitMinutes
    }

    init(rule: ConfiguredRule, at date: Date, calendar: Calendar) {
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: date))
        switch rule.descriptor.condition {
        case .recurring(let window):
            self.init(reason: .schedule, ruleName: rule.name, endsAt: window.endOfOccurrence(containing: date, calendar: calendar))
        case .days:
            self.init(reason: .allDay, ruleName: rule.name, endsAt: tomorrow)
        case .usageLimit(let minutes):
            self.init(reason: .usageLimit, ruleName: rule.name, endsAt: tomorrow, limitMinutes: minutes)
        case .session(let interval):
            self.init(reason: .focusSession, ruleName: rule.name, endsAt: interval.end)
        }
    }
}

/// Builds shield text. Shared by the ShieldConfiguration extension and the in-app preview
/// so the preview matches the real shield exactly.
enum ShieldContentBuilder {
    static func content(
        theme: ShieldThemeSnapshot,
        appName: String?,
        reasons: [ShieldReasonInfo],
        revealReason: Bool,
        now: Date,
        calendar: Calendar
    ) -> (title: String, subtitle: String) {
        let name = appName ?? "This app"
        let title = theme.title.replacingOccurrences(of: ShieldThemeSnapshot.appNamePlaceholder, with: name)
        var lines = [theme.subtitle.replacingOccurrences(of: ShieldThemeSnapshot.appNamePlaceholder, with: name)]

        if revealReason, !reasons.isEmpty {
            lines = reasons.map { describe($0, now: now, calendar: calendar) }
        } else {
            if theme.showsBlockReason, let first = reasons.first {
                lines.append(describe(first, now: now, calendar: calendar))
            } else if theme.showsRemainingTime, let end = reasons.compactMap(\.endsAt).max() {
                lines.append("Unlocks \(format(end, now: now, calendar: calendar)).")
            }
        }
        return (title, lines.filter { !$0.isEmpty }.joined(separator: "\n\n"))
    }

    static func describe(_ info: ShieldReasonInfo, now: Date, calendar: Calendar) -> String {
        let until = info.endsAt.map { format($0, now: now, calendar: calendar) }
        switch info.reason {
        case .usageLimit:
            let limit = info.limitMinutes.map { "\($0)-minute" } ?? "daily"
            return "You've used your \(limit) limit for “\(info.ruleName)”. It resets at midnight."
        case .schedule:
            return "“\(info.ruleName)” is active" + (until.map { " until \($0)." } ?? ".")
        case .allDay:
            return "“\(info.ruleName)” blocks this all day today."
        case .focusSession:
            let remaining = info.endsAt.map { max(0, Int(($0.timeIntervalSince(now) / 60).rounded(.up))) }
            return "Focus session in progress" + (remaining.map { " — \($0) min left." } ?? ".")
        }
    }

    private static func format(_ date: Date, now: Date, calendar: Calendar) -> String {
        let style = Date.FormatStyle(date: .omitted, time: .shortened)
        if calendar.isDate(date, inSameDayAs: now) {
            return "at \(date.formatted(style))"
        }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) {
            return calendar.startOfDay(for: date) == date ? "at midnight" : "tomorrow at \(date.formatted(style))"
        }
        return date.formatted(.dateTime.weekday(.abbreviated).hour().minute())
    }
}
