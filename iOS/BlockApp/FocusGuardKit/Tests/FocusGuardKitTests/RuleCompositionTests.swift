import Foundation
import Testing
@testable import FocusGuardKit

@Suite("Rule composition and blocking state")
struct RuleCompositionTests {
    let cal = Fixtures.calendar()

    @Test func ruleKeyRoundTrip() {
        let key = Fixtures.key(.schedule)
        #expect(RuleKey(rawValue: key.rawValue) == key)
        #expect(RuleKey(rawValue: "nope") == nil)
    }

    @Test func anyActiveRuleKeepsItemBlocked() {
        let schedule = RuleDescriptor(key: Fixtures.key(.schedule), isEnabled: true, condition: .recurring(Fixtures.window((8, 0), (12, 0), Weekday.everyDay)))
        let allDay = RuleDescriptor(key: Fixtures.key(.allDay), isEnabled: true, condition: .days(DayRule(weekdays: Weekday.workdays, effectiveStart: .distantPast)))
        let targets: [RuleKey: Set<String>] = [
            schedule.key: ["instagram", "tiktok"],
            allDay.key: ["instagram", "youtube"]
        ]

        let morning = EvaluationContext(date: Fixtures.date(2026, 3, 2, 9, 0), calendar: cal)
        let active = RuleEvaluator.activeKeys(for: [schedule, allDay], in: morning)
        #expect(RuleEvaluator.blockedTargets(activeKeys: active, targets: targets) == ["instagram", "tiktok", "youtube"])
        #expect(RuleEvaluator.blockingRules(for: "instagram", activeKeys: active, targets: targets).count == 2)

        // Schedule ends — Instagram must remain blocked by the all-day rule.
        let afternoon = EvaluationContext(date: Fixtures.date(2026, 3, 2, 13, 0), calendar: cal)
        let later = RuleEvaluator.activeKeys(for: [schedule, allDay], in: afternoon)
        #expect(later == [allDay.key])
        #expect(RuleEvaluator.blockedTargets(activeKeys: later, targets: targets) == ["instagram", "youtube"])
    }

    @Test func disabledRulesNeverBlock() {
        let rule = RuleDescriptor(key: Fixtures.key(.allDay), isEnabled: false, condition: .days(DayRule(weekdays: Weekday.everyDay, effectiveStart: .distantPast)))
        #expect(!RuleEvaluator.isActive(rule, in: EvaluationContext(date: .now, calendar: cal)))
    }

    @Test func usageLimitBlockingTransitions() {
        let key = Fixtures.key(.usageLimit)
        let rule = RuleDescriptor(key: key, isEnabled: true, condition: .usageLimit(minutes: 30))
        let monday = Fixtures.date(2026, 3, 2, 15, 0)
        let mondayKey = DayKey(date: monday, calendar: cal)

        var ctx = EvaluationContext(date: monday, calendar: cal, usage: [key.id: UsageRecord(day: mondayKey, usedMinutes: 25)])
        #expect(!RuleEvaluator.isActive(rule, in: ctx))

        ctx.usage[key.id]?.recordMilestone(30, on: mondayKey)
        #expect(RuleEvaluator.isActive(rule, in: ctx), "Threshold reached → blocked")

        ctx.date = Fixtures.date(2026, 3, 3, 0, 1)
        #expect(!RuleEvaluator.isActive(rule, in: ctx), "Next day → unblocked even before the monitor resets the record")
    }

    @Test func focusSessionInterval() {
        let start = Fixtures.date(2026, 3, 2, 10, 0)
        let rule = RuleDescriptor(key: Fixtures.key(.focusSession), isEnabled: true, condition: .session(DateInterval(start: start, duration: 1800)))
        #expect(RuleEvaluator.isActive(rule, in: EvaluationContext(date: start, calendar: cal)))
        #expect(RuleEvaluator.isActive(rule, in: EvaluationContext(date: start.addingTimeInterval(1799), calendar: cal)))
        #expect(!RuleEvaluator.isActive(rule, in: EvaluationContext(date: start.addingTimeInterval(1800), calendar: cal)))
    }

    @Test func shieldPlanOnlyClearsInactiveStores() {
        let a = Fixtures.key(.schedule), b = Fixtures.key(.allDay), deleted = Fixtures.key(.usageLimit)
        let plan = ShieldPlan.make(active: [b], previouslyApplied: [a, b, deleted], known: [a, b])
        #expect(plan.storesToApply == [b])
        #expect(plan.storesToClear == [a, deleted], "Deleted rules' stores are cleaned up; active stores are untouched")
    }

    @Test func monitoringQuotaPrioritisesFocusAndLimits() {
        let now = Fixtures.date(2026, 3, 2, 10, 0)
        let schedules = (0..<20).map { _ in RuleDescriptor(key: Fixtures.key(.schedule), isEnabled: true, condition: .recurring(Fixtures.window((8, 0), (9, 0), Weekday.everyDay))) }
        let limit = RuleDescriptor(key: Fixtures.key(.usageLimit), isEnabled: true, condition: .usageLimit(minutes: 30))
        let focus = RuleDescriptor(key: Fixtures.key(.focusSession), isEnabled: true, condition: .session(DateInterval(start: now, duration: 900)))
        let expiredFocus = RuleDescriptor(key: Fixtures.key(.focusSession), isEnabled: true, condition: .session(DateInterval(start: now.addingTimeInterval(-3600), duration: 900)))
        let disabled = RuleDescriptor(key: Fixtures.key(.allDay), isEnabled: false, condition: .days(DayRule(weekdays: Weekday.everyDay, effectiveStart: now)))

        let result = MonitoringPlanner.plan(rules: schedules + [limit, focus, expiredFocus, disabled], now: now)
        #expect(result.monitored.count == 20)
        #expect(result.monitored.first == focus.key)
        #expect(result.monitored.contains(limit.key))
        #expect(result.overflow.count == 2)
        #expect(!result.monitored.contains(expiredFocus.key))
        #expect(!result.monitored.contains(disabled.key))
    }

    @Test func roundingSnapsCallbacksToBoundary() {
        let w = Fixtures.window((8, 0), (12, 0), Weekday.everyDay)
        let early = Fixtures.date(2026, 3, 2, 8, 0).addingTimeInterval(-2)
        #expect(!w.contains(early, calendar: cal))
        #expect(w.contains(early.roundedToNearestMinute(), calendar: cal))
    }
}

@Suite("Focus statistics")
struct FocusStatisticsTests {
    let cal = Fixtures.calendar()

    @Test func computesTotalsRateAndStreak() {
        let now = Fixtures.date(2026, 3, 4, 20, 0)
        func session(_ day: Int, _ minutes: Int, _ status: FocusSessionStatus, actual: Int? = nil) -> FocusSessionRecord {
            let start = Fixtures.date(2026, 3, day, 9, 0)
            return FocusSessionRecord(
                start: start,
                plannedEnd: start.addingTimeInterval(TimeInterval(minutes * 60)),
                actualEnd: start.addingTimeInterval(TimeInterval((actual ?? minutes) * 60)),
                status: status
            )
        }
        let stats = FocusStatistics.compute([
            session(2, 30, .completed),
            session(3, 45, .completed),
            session(4, 60, .cancelled, actual: 10),
            session(4, 15, .completed)
        ], now: now, calendar: cal)

        #expect(stats.completedCount == 3)
        #expect(stats.endedEarlyCount == 1)
        #expect(stats.totalFocusMinutes == 100)
        #expect(stats.completionRate == 0.75)
        #expect(stats.currentStreakDays == 3)
        #expect(stats.lastSevenDays.count == 7)
        #expect(stats.lastSevenDays.last?.minutes == 25)
    }
}
