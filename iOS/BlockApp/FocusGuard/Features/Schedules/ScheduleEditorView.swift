import SwiftUI
@preconcurrency import FamilyControls
import FocusGuardKit

struct ScheduleDraft: Identifiable, Hashable {
    let id = UUID()
    var name: String
    var start: TimeOfDay
    var end: TimeOfDay
    var weekdays: Set<Weekday>

    static let blank = ScheduleDraft(name: "", start: TimeOfDay(hour: 9, minute: 0), end: TimeOfDay(hour: 17, minute: 0), weekdays: Weekday.workdays)

    static let templates: [ScheduleDraft] = [
        ScheduleDraft(name: "Morning focus", start: TimeOfDay(hour: 8, minute: 0), end: TimeOfDay(hour: 12, minute: 0), weekdays: Weekday.workdays),
        ScheduleDraft(name: "Afternoon deep work", start: TimeOfDay(hour: 13, minute: 0), end: TimeOfDay(hour: 17, minute: 0), weekdays: Weekday.workdays),
        ScheduleDraft(name: "Night routine", start: TimeOfDay(hour: 22, minute: 0), end: TimeOfDay(hour: 7, minute: 0), weekdays: Weekday.everyDay),
        ScheduleDraft(name: "Weekend mornings", start: TimeOfDay(hour: 8, minute: 0), end: TimeOfDay(hour: 11, minute: 0), weekdays: Weekday.weekend)
    ]
}

struct ScheduleEditorView: View {
    let schedule: BlockingSchedule?
    let preset: ScheduleDraft

    @Environment(\.dismiss) private var dismiss
    @Environment(RulesRepository.self) private var repository
    @State private var name = ""
    @State private var start = TimeOfDay(hour: 9, minute: 0)
    @State private var end = TimeOfDay(hour: 17, minute: 0)
    @State private var weekdays: Set<Weekday> = Weekday.workdays
    @State private var groupIDs: [UUID] = []
    @State private var selection = FamilyActivitySelection()
    @State private var loaded = false

    private var window: RecurringWindow { RecurringWindow(start: start, end: end, weekdays: weekdays) }
    private var issues: [RuleValidationIssue] {
        var all = window.validationIssues
        if groupIDs.isEmpty && selection.isEmpty { all.append(.noTargets) }
        return all
    }
    private var isValid: Bool { issues.isEmpty && !name.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("e.g. Work hours", text: $name)
                }
                Section {
                    DatePicker("Starts", selection: $start.asDate, displayedComponents: .hourAndMinute)
                    DatePicker("Ends", selection: $end.asDate, displayedComponents: .hourAndMinute)
                    HStack {
                        Label(DurationFormat.minutes(window.durationMinutes), systemImage: "clock")
                        Spacer()
                        if window.isOvernight && start != end {
                            StatusBadge(text: "Ends next day", symbol: "moon.fill", tint: .indigo)
                        }
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                } header: {
                    Text("Time")
                } footer: {
                    Text("Times follow your current time zone and adjust automatically for daylight saving.")
                }
                Section {
                    WeekdaySelector(selection: $weekdays)
                        .padding(.vertical, Spacing.xxs)
                } header: {
                    Text("Repeat")
                } footer: {
                    if window.isOvernight {
                        Text("Overnight blocks belong to the day they start on — Friday 22:00 continues into Saturday morning.")
                    }
                }
                TargetsSection(groupIDs: $groupIDs, selection: $selection)
                if !issues.isEmpty {
                    Section {
                        ForEach(issues, id: \.self) { issue in
                            Label(issue.message, systemImage: "exclamationmark.circle.fill")
                                .foregroundStyle(Color.fgWarning)
                                .font(.subheadline)
                        }
                    }
                }
            }
            .navigationTitle(schedule == nil ? "New Schedule" : "Edit Schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save", action: save).disabled(!isValid) }
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        if let schedule {
            name = schedule.name
            start = schedule.window.start
            end = schedule.window.end
            weekdays = schedule.window.weekdays
            groupIDs = schedule.groupIDs
            selection = schedule.customSelection
        } else {
            name = preset.name
            start = preset.start
            end = preset.end
            weekdays = preset.weekdays
        }
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if let schedule {
            schedule.name = trimmed
            schedule.window = window
            schedule.groupIDs = groupIDs
            schedule.customSelection = selection
            repository.commit()
        } else {
            repository.insert(BlockingSchedule(name: trimmed, window: window, groupIDs: groupIDs, selectionData: SelectionCoder.encode(selection)))
        }
        dismiss()
    }
}

struct AllDayRuleEditorView: View {
    let rule: AllDayRule?

    @Environment(\.dismiss) private var dismiss
    @Environment(RulesRepository.self) private var repository
    @State private var name = ""
    @State private var weekdays: Set<Weekday> = Weekday.workdays
    @State private var startDate = Date.now
    @State private var hasEndDate = false
    @State private var endDate = Calendar.current.date(byAdding: .month, value: 1, to: .now) ?? .now
    @State private var groupIDs: [UUID] = []
    @State private var selection = FamilyActivitySelection()
    @State private var loaded = false

    private var dayRule: DayRule {
        DayRule(weekdays: weekdays, effectiveStart: startDate, effectiveEnd: hasEndDate ? endDate : nil)
    }

    private var issues: [RuleValidationIssue] {
        var all = dayRule.validationIssues(calendar: .current)
        if groupIDs.isEmpty && selection.isEmpty { all.append(.noTargets) }
        return all
    }

    private var isValid: Bool { issues.isEmpty && !name.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("e.g. No social on workdays", text: $name)
                }
                Section {
                    WeekdaySelector(selection: $weekdays)
                        .padding(.vertical, Spacing.xxs)
                } header: {
                    Text("Days")
                } footer: {
                    Text("Apps are blocked from midnight to midnight on these days.")
                }
                Section("Effective dates") {
                    DatePicker("Starts", selection: $startDate, displayedComponents: .date)
                    Toggle("End date", isOn: $hasEndDate.animation(.fgSpring))
                    if hasEndDate {
                        DatePicker("Ends", selection: $endDate, in: startDate..., displayedComponents: .date)
                    }
                }
                TargetsSection(groupIDs: $groupIDs, selection: $selection)
                if !issues.isEmpty {
                    Section {
                        ForEach(issues, id: \.self) { issue in
                            Label(issue.message, systemImage: "exclamationmark.circle.fill")
                                .foregroundStyle(Color.fgWarning)
                                .font(.subheadline)
                        }
                    }
                }
            }
            .navigationTitle(rule == nil ? "New All-Day Rule" : "Edit All-Day Rule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save", action: save).disabled(!isValid) }
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard !loaded, let rule else { return }
        loaded = true
        name = rule.name
        weekdays = rule.dayRule.weekdays
        startDate = rule.effectiveStartDate
        hasEndDate = rule.effectiveEndDate != nil
        endDate = rule.effectiveEndDate ?? endDate
        groupIDs = rule.groupIDs
        selection = rule.customSelection
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if let rule {
            rule.name = trimmed
            rule.dayRule = dayRule
            rule.groupIDs = groupIDs
            rule.customSelection = selection
            repository.commit()
        } else {
            repository.insert(AllDayRule(name: trimmed, dayRule: dayRule, groupIDs: groupIDs, selectionData: SelectionCoder.encode(selection)))
        }
        dismiss()
    }
}
