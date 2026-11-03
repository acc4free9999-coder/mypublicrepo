import Foundation
import Testing
@testable import FocusGuardKit

@Suite("Usage limits")
struct UsageLimitTests {
    let cal = Fixtures.calendar()

    @Test(arguments: [5, 15, 20, 30, 45, 60, 90, 120, 240, 1440])
    func milestonesAreBoundedAndEndAtLimit(limit: Int) {
        let m = UsageLimitCalculator.milestones(forLimit: limit)
        #expect(m.last == limit)
        #expect(m == m.sorted())
        #expect(Set(m).count == m.count)
        #expect(m.count <= 26)
        #expect(m.allSatisfy { $0 > 0 && $0 <= limit })
        if limit > UsageLimitCalculator.warningLeadMinutes {
            #expect(m.contains(limit - UsageLimitCalculator.warningLeadMinutes))
        }
    }

    @Test func thirtyMinuteMilestones() {
        #expect(UsageLimitCalculator.milestones(forLimit: 30) == [5, 10, 15, 20, 25, 30])
        #expect(UsageLimitCalculator.milestones(forLimit: 0).isEmpty)
    }

    @Test func remainingAndProgress() {
        #expect(UsageLimitCalculator.remainingMinutes(used: 24, limit: 30) == 6)
        #expect(UsageLimitCalculator.remainingMinutes(used: 40, limit: 30) == 0)
        #expect(UsageLimitCalculator.progress(used: 24, limit: 30) == 0.8)
        #expect(UsageLimitCalculator.progress(used: 60, limit: 30) == 1)
        #expect(UsageLimitCalculator.isLimitReached(used: 30, limit: 30))
        #expect(!UsageLimitCalculator.isLimitReached(used: 29, limit: 30))
    }

    @Test func warningOnlyOnceAndBeforeLimit() {
        #expect(UsageLimitCalculator.shouldSendWarning(used: 25, limit: 30, alreadySent: false))
        #expect(!UsageLimitCalculator.shouldSendWarning(used: 25, limit: 30, alreadySent: true))
        #expect(!UsageLimitCalculator.shouldSendWarning(used: 20, limit: 30, alreadySent: false))
        #expect(!UsageLimitCalculator.shouldSendWarning(used: 30, limit: 30, alreadySent: false))
    }

    @Test func dailyResetIgnoresYesterday() {
        let monday = DayKey(year: 2026, month: 3, day: 2)
        let tuesday = DayKey(year: 2026, month: 3, day: 3)
        var record = UsageRecord(day: monday)
        record.recordMilestone(25, on: monday)
        record.recordMilestone(20, on: monday)
        #expect(record.usedMinutes(on: monday) == 25, "Milestones only move forward")
        #expect(record.usedMinutes(on: tuesday) == 0)

        record.warningSent = true
        record.recordMilestone(5, on: tuesday)
        #expect(record.day == tuesday)
        #expect(record.usedMinutes == 5)
        #expect(!record.warningSent, "New day resets warning state")
    }

    @Test func milestoneEventRoundTrip() {
        let event = UsageMilestoneEvent(limitID: UUID(), minutes: 25)
        #expect(UsageMilestoneEvent(rawValue: event.rawValue) == event)
        #expect(UsageMilestoneEvent(rawValue: "milestone.bad.5") == nil)
        #expect(UsageMilestoneEvent(rawValue: "schedule.\(UUID().uuidString)") == nil)
    }
}
