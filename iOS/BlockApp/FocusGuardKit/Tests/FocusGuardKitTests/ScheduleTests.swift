import Foundation
import Testing
@testable import FocusGuardKit

@Suite("Schedule calculations")
struct ScheduleTests {
    let cal = Fixtures.calendar()

    @Test func daytimeWindowBoundaries() {
        let w = Fixtures.window((8, 0), (12, 0), Weekday.everyDay)
        #expect(!w.contains(Fixtures.date(2026, 3, 2, 7, 59), calendar: cal))
        #expect(w.contains(Fixtures.date(2026, 3, 2, 8, 0), calendar: cal))
        #expect(w.contains(Fixtures.date(2026, 3, 2, 11, 59), calendar: cal))
        #expect(!w.contains(Fixtures.date(2026, 3, 2, 12, 0), calendar: cal), "End is exclusive")
        #expect(!w.isOvernight)
        #expect(w.durationMinutes == 240)
    }

    @Test func overnightWindowSpansMidnight() {
        let w = Fixtures.window((22, 0), (7, 0), Weekday.everyDay)
        #expect(w.isOvernight)
        #expect(w.durationMinutes == 540)
        #expect(w.contains(Fixtures.date(2026, 3, 2, 23, 30), calendar: cal))
        #expect(w.contains(Fixtures.date(2026, 3, 3, 0, 0), calendar: cal))
        #expect(w.contains(Fixtures.date(2026, 3, 3, 6, 59), calendar: cal))
        #expect(!w.contains(Fixtures.date(2026, 3, 3, 7, 0), calendar: cal))
        #expect(!w.contains(Fixtures.date(2026, 3, 3, 12, 0), calendar: cal))
    }

    @Test func overnightWindowBelongsToStartDay() {
        // Friday night only: Fri 22:00 → Sat 07:00.
        let w = Fixtures.window((22, 0), (7, 0), [.friday])
        let fri = Fixtures.date(2026, 3, 6, 23, 0)
        let satMorning = Fixtures.date(2026, 3, 7, 3, 0)
        let satNight = Fixtures.date(2026, 3, 7, 23, 0)
        let friMorning = Fixtures.date(2026, 3, 6, 3, 0)
        #expect(w.contains(fri, calendar: cal))
        #expect(w.contains(satMorning, calendar: cal))
        #expect(!w.contains(satNight, calendar: cal))
        #expect(!w.contains(friMorning, calendar: cal), "Belongs to Thursday's occurrence, which isn't selected")
    }

    @Test func weekdayAndWeekendRules() {
        let weekdays = Fixtures.window((9, 0), (17, 0), Weekday.workdays)
        let weekends = Fixtures.window((10, 0), (14, 0), Weekday.weekend)
        let monday = Fixtures.date(2026, 3, 2, 11, 0)
        let saturday = Fixtures.date(2026, 3, 7, 11, 0)
        #expect(weekdays.contains(monday, calendar: cal))
        #expect(!weekdays.contains(saturday, calendar: cal))
        #expect(!weekends.contains(monday, calendar: cal))
        #expect(weekends.contains(saturday, calendar: cal))
    }

    @Test func endOfOccurrence() {
        let w = Fixtures.window((22, 0), (7, 0), Weekday.everyDay)
        let end = w.endOfOccurrence(containing: Fixtures.date(2026, 3, 2, 23, 0), calendar: cal)
        #expect(end == Fixtures.date(2026, 3, 3, 7, 0))
        let earlyEnd = w.endOfOccurrence(containing: Fixtures.date(2026, 3, 3, 2, 0), calendar: cal)
        #expect(earlyEnd == Fixtures.date(2026, 3, 3, 7, 0))
        #expect(w.endOfOccurrence(containing: Fixtures.date(2026, 3, 3, 12, 0), calendar: cal) == nil)
    }

    @Test func nextStartSkipsUnselectedDays() {
        let w = Fixtures.window((8, 0), (12, 0), [.wednesday])
        let next = w.nextStart(after: Fixtures.date(2026, 3, 2, 9, 0), calendar: cal)
        #expect(next == Fixtures.date(2026, 3, 4, 8, 0))
    }

    @Test func validation() {
        #expect(Fixtures.window((8, 0), (8, 10), Weekday.everyDay).validationIssues == [.durationTooShort(minimumMinutes: 15)])
        #expect(Fixtures.window((8, 0), (8, 0), Weekday.everyDay).validationIssues == [.startEqualsEnd])
        #expect(Fixtures.window((8, 0), (9, 0), []).validationIssues == [.noWeekdays])
        #expect(Fixtures.window((23, 50), (0, 5), Weekday.everyDay).validationIssues.isEmpty, "Overnight 15 min is valid")
    }
}

@Suite("Time zones and daylight saving")
struct TimeZoneTests {
    @Test func wallClockScheduleFollowsTimeZoneChange() {
        let w = Fixtures.window((8, 0), (12, 0), Weekday.everyDay)
        let berlin = Fixtures.calendar("Europe/Berlin")
        let tokyo = Fixtures.calendar("Asia/Tokyo")
        // 09:00 in Berlin is 17:00 in Tokyo.
        let instant = Fixtures.date(2026, 3, 2, 9, 0, calendar: berlin)
        #expect(w.contains(instant, calendar: berlin))
        #expect(!w.contains(instant, calendar: tokyo))
    }

    @Test func springForwardGap() {
        let cal = Fixtures.calendar("Europe/Berlin")
        // 2026-03-29: clocks jump 02:00 → 03:00.
        let w = Fixtures.window((1, 0), (4, 0), Weekday.everyDay)
        let afterJump = cal.date(from: DateComponents(year: 2026, month: 3, day: 29, hour: 3, minute: 30))!
        #expect(w.contains(afterJump, calendar: cal))
        let gapStart = Fixtures.window((2, 30), (5, 0), Weekday.everyDay)
        let next = gapStart.nextStart(after: cal.date(from: DateComponents(year: 2026, month: 3, day: 29, hour: 0))!, calendar: cal)
        #expect(next != nil)
        #expect(cal.component(.day, from: next!) == 29, "Start inside the DST gap moves forward, not to the next day")
    }

    @Test func fallBackRepeatedHourStaysBlocked() {
        let cal = Fixtures.calendar("Europe/Berlin")
        // 2026-10-25: 03:00 → 02:00. Both 02:30 instants are inside 01:00–04:00.
        let w = Fixtures.window((1, 0), (4, 0), Weekday.everyDay)
        let first = cal.date(from: DateComponents(year: 2026, month: 10, day: 25, hour: 2, minute: 30))!
        #expect(w.contains(first, calendar: cal))
        #expect(w.contains(first.addingTimeInterval(3600), calendar: cal))
    }

    @Test func dayKeyDependsOnTimeZone() {
        let instant = Fixtures.date(2026, 3, 2, 23, 30, calendar: Fixtures.calendar("Europe/Berlin"))
        let berlin = DayKey(date: instant, calendar: Fixtures.calendar("Europe/Berlin"))
        let tokyo = DayKey(date: instant, calendar: Fixtures.calendar("Asia/Tokyo"))
        #expect(berlin == DayKey(year: 2026, month: 3, day: 2))
        #expect(tokyo == DayKey(year: 2026, month: 3, day: 3))
    }
}

@Suite("All-day rules")
struct AllDayRuleTests {
    let cal = Fixtures.calendar()

    @Test func respectsWeekdaysAndDateRange() {
        let rule = DayRule(
            weekdays: Weekday.workdays,
            effectiveStart: Fixtures.date(2026, 3, 3, 15, 0),
            effectiveEnd: Fixtures.date(2026, 3, 10, 9, 0)
        )
        #expect(!rule.contains(Fixtures.date(2026, 3, 2, 12, 0), calendar: cal), "Before start date")
        #expect(rule.contains(Fixtures.date(2026, 3, 3, 0, 1), calendar: cal), "Start date counts as a whole day")
        #expect(!rule.contains(Fixtures.date(2026, 3, 7, 12, 0), calendar: cal), "Saturday")
        #expect(rule.contains(Fixtures.date(2026, 3, 10, 23, 59), calendar: cal), "End date is inclusive")
        #expect(!rule.contains(Fixtures.date(2026, 3, 11, 0, 0), calendar: cal))
        #expect(rule.hasExpired(at: Fixtures.date(2026, 3, 11, 0, 0), calendar: cal))
    }

    @Test func validation() {
        let rule = DayRule(weekdays: [], effectiveStart: Fixtures.date(2026, 3, 5, 0), effectiveEnd: Fixtures.date(2026, 3, 4, 0))
        #expect(rule.validationIssues(calendar: cal) == [.noWeekdays, .endDateBeforeStartDate])
    }
}
