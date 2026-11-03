import SwiftData
import SwiftUI
import FocusGuardKit

struct ScheduleView: View {
    enum Segment: String, CaseIterable, Identifiable {
        case timeRanges = "Time Ranges"
        case allDay = "All-Day"
        var id: String { rawValue }
    }

    @State private var segment: Segment = .timeRanges
    @State private var editingSchedule: BlockingSchedule?
    @State private var editingAllDay: AllDayRule?
    @State private var newSchedulePreset: ScheduleDraft?
    @State private var showNewAllDay = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    AuthorizationRequiredBanner()
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
                switch segment {
                case .timeRanges:
                    ScheduleList(onEdit: { editingSchedule = $0 }, onCreate: { newSchedulePreset = $0 })
                case .allDay:
                    AllDayList(onEdit: { editingAllDay = $0 })
                }
            }
            .safeAreaInset(edge: .top) {
                Picker("View", selection: $segment) {
                    ForEach(Segment.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Spacing.m)
                .padding(.bottom, Spacing.xs)
                .background(.bar)
            }
            .navigationTitle("Schedule")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        if segment == .timeRanges { newSchedulePreset = .blank } else { showNewAllDay = true }
                    } label: {
                        Image(systemName: "plus.circle.fill").font(.title3)
                    }
                    .accessibilityLabel(segment == .timeRanges ? "New schedule" : "New all-day rule")
                }
            }
            .sheet(item: $newSchedulePreset) { ScheduleEditorView(schedule: nil, preset: $0) }
            .sheet(item: $editingSchedule) { ScheduleEditorView(schedule: $0, preset: .blank) }
            .sheet(isPresented: $showNewAllDay) { AllDayRuleEditorView(rule: nil) }
            .sheet(item: $editingAllDay) { AllDayRuleEditorView(rule: $0) }
        }
    }
}

private struct ScheduleList: View {
    @Query(sort: \BlockingSchedule.startMinutes) private var schedules: [BlockingSchedule]
    @Environment(RulesRepository.self) private var repository
    let onEdit: (BlockingSchedule) -> Void
    let onCreate: (ScheduleDraft) -> Void

    var body: some View {
        if schedules.isEmpty {
            Section {
                ContentUnavailableView {
                    Label("No schedules", systemImage: "calendar.badge.clock")
                } description: {
                    Text("Block apps during set hours. Start from a template:")
                }
                .listRowBackground(Color.clear)
                ForEach(ScheduleDraft.templates) { draft in
                    Button { onCreate(draft) } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(draft.name).font(.headline).foregroundStyle(.primary)
                                Text("\(draft.start.formatted) – \(draft.end.formatted) · \(Weekday.summary(draft.weekdays))")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "plus.circle").foregroundStyle(Color.accentColor)
                        }
                    }
                }
            }
        } else {
            let weekdayRules = schedules.filter { !$0.window.weekdays.isSubset(of: Weekday.weekend) }
            let weekendRules = schedules.filter { $0.window.weekdays.isSubset(of: Weekday.weekend) && !$0.window.weekdays.isEmpty }
            if !weekdayRules.isEmpty {
                Section("Weekdays & daily") { rows(weekdayRules) }
            }
            if !weekendRules.isEmpty {
                Section("Weekends") { rows(weekendRules) }
            }
        }
    }

    private func rows(_ items: [BlockingSchedule]) -> some View {
        ForEach(items) { schedule in
            ScheduleRow(schedule: schedule)
                .contentShape(Rectangle())
                .onTapGesture { onEdit(schedule) }
                .swipeActions {
                    Button("Delete", role: .destructive) { repository.delete(schedule) }
                }
        }
    }
}

private struct ScheduleRow: View {
    @Bindable var schedule: BlockingSchedule
    @Environment(BlockingEngine.self) private var engine
    @Environment(RulesRepository.self) private var repository

    var body: some View {
        let window = schedule.window
        let isActive = engine.isActive(schedule.ruleKey)

        VStack(alignment: .leading, spacing: Spacing.s) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(schedule.name).font(.headline)
                    HStack(spacing: Spacing.xs) {
                        Text("\(window.start.formatted) – \(window.end.formatted)")
                            .font(.title3.weight(.semibold).monospacedDigit())
                        if window.isOvernight {
                            Image(systemName: "moon.fill").foregroundStyle(.indigo).accessibilityLabel("Overnight")
                        }
                    }
                    Text(Weekday.summary(window.weekdays)).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                Toggle("Enabled", isOn: $schedule.isEnabled)
                    .labelsHidden()
                    .onChange(of: schedule.isEnabled) { repository.commit() }
            }
            HStack {
                if isActive, let end = window.endOfOccurrence(containing: .now, calendar: .current) {
                    StatusBadge(text: "Active until \(end.formatted(date: .omitted, time: .shortened))", symbol: "lock.fill", tint: .fgDanger)
                } else if schedule.isEnabled, let next = window.nextStart(after: .now, calendar: .current) {
                    StatusBadge(text: "Next \(next.formatted(.dateTime.weekday(.abbreviated).hour().minute()))", symbol: "clock", tint: .accentColor)
                }
                Spacer()
            }
            RuleHealthBadge(key: schedule.ruleKey)
        }
        .padding(.vertical, Spacing.xxs)
        .opacity(schedule.isEnabled ? 1 : 0.55)
    }
}

private struct AllDayList: View {
    @Query(sort: \AllDayRule.createdAt) private var rules: [AllDayRule]
    @Environment(RulesRepository.self) private var repository
    @Environment(BlockingEngine.self) private var engine
    let onEdit: (AllDayRule) -> Void

    var body: some View {
        if rules.isEmpty {
            ContentUnavailableView {
                Label("No all-day rules", systemImage: "sun.max")
            } description: {
                Text("Block apps for the entire day — for example, all social media Monday to Friday. All-day rules work independently of time-range schedules.")
            }
            .listRowBackground(Color.clear)
        }
        Section {
            ForEach(rules) { rule in
                AllDayRow(rule: rule, isActive: engine.isActive(rule.ruleKey))
                    .contentShape(Rectangle())
                    .onTapGesture { onEdit(rule) }
                    .swipeActions {
                        Button("Delete", role: .destructive) { repository.delete(rule) }
                    }
            }
        }
    }
}

private struct AllDayRow: View {
    @Bindable var rule: AllDayRule
    let isActive: Bool
    @Environment(RulesRepository.self) private var repository

    var body: some View {
        let dayRule = rule.dayRule
        VStack(alignment: .leading, spacing: Spacing.s) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(rule.name).font(.headline)
                    Text(Weekday.summary(dayRule.weekdays)).font(.subheadline).foregroundStyle(.secondary)
                    Text(rangeText(dayRule)).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Toggle("Enabled", isOn: $rule.isEnabled)
                    .labelsHidden()
                    .onChange(of: rule.isEnabled) { repository.commit() }
            }
            if isActive {
                StatusBadge(text: "Blocking today", symbol: "lock.fill", tint: .fgDanger)
            } else if dayRule.hasExpired(at: .now, calendar: .current) {
                StatusBadge(text: "Ended", tint: .secondary)
            }
            RuleHealthBadge(key: rule.ruleKey)
        }
        .padding(.vertical, Spacing.xxs)
        .opacity(rule.isEnabled ? 1 : 0.55)
    }

    private func rangeText(_ rule: DayRule) -> String {
        let start = rule.effectiveStart.formatted(date: .abbreviated, time: .omitted)
        if let end = rule.effectiveEnd {
            return "\(start) – \(end.formatted(date: .abbreviated, time: .omitted))"
        }
        return "From \(start), no end date"
    }
}
