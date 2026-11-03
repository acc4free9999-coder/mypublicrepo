import SwiftData
import SwiftUI
@preconcurrency import FamilyControls
import FocusGuardKit

struct AppsView: View {
    enum Segment: String, CaseIterable, Identifiable {
        case groups = "Block Lists"
        case limits = "Usage Limits"
        var id: String { rawValue }
    }

    @State private var segment: Segment = .groups
    @State private var editingGroup: AppBlockGroup?
    @State private var editingLimit: UsageLimit?
    @State private var showNewGroup = false
    @State private var showNewLimit = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    AuthorizationRequiredBanner()
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
                switch segment {
                case .groups: GroupsList(onEdit: { editingGroup = $0 })
                case .limits: LimitsList(onEdit: { editingLimit = $0 })
                }
            }
            .listSectionSpacing(Spacing.m)
            .safeAreaInset(edge: .top) {
                Picker("View", selection: $segment) {
                    ForEach(Segment.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Spacing.m)
                .padding(.bottom, Spacing.xs)
                .background(.bar)
            }
            .navigationTitle("Apps")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        if segment == .groups { showNewGroup = true } else { showNewLimit = true }
                    } label: {
                        Image(systemName: "plus.circle.fill").font(.title3)
                    }
                    .accessibilityLabel(segment == .groups ? "New block list" : "New usage limit")
                }
            }
            .navigationDestination(for: AppBlockGroup.self) { GroupDetailView(group: $0) }
            .sheet(isPresented: $showNewGroup) { GroupEditorView(group: nil) }
            .sheet(item: $editingGroup) { GroupEditorView(group: $0) }
            .sheet(isPresented: $showNewLimit) { UsageLimitEditorView(limit: nil) }
            .sheet(item: $editingLimit) { UsageLimitEditorView(limit: $0) }
        }
    }
}

private struct GroupsList: View {
    @Query(sort: \AppBlockGroup.createdAt) private var groups: [AppBlockGroup]
    @Environment(BlockingEngine.self) private var engine
    @Environment(RulesRepository.self) private var repository
    let onEdit: (AppBlockGroup) -> Void

    var body: some View {
        if groups.isEmpty {
            ContentUnavailableView {
                Label("No block lists yet", systemImage: "square.stack.3d.up.slash")
            } description: {
                Text("Create lists like “Social Media” or “Games”, then use them in limits, schedules and focus sessions.")
            }
            .listRowBackground(Color.clear)
        }
        ForEach(BlockCategory.allCases) { category in
            let items = groups.filter { $0.category == category }
            if !items.isEmpty {
                Section {
                    ForEach(items) { group in
                        NavigationLink(value: group) {
                            GroupRow(group: group, isBlocked: group.isEnabled && engine.blockedSelection.intersects(group.selectedApplications))
                        }
                        .swipeActions(edge: .trailing) {
                            Button("Delete", role: .destructive) { repository.deleteGroup(group) }
                            Button("Edit") { onEdit(group) }.tint(.accentColor)
                        }
                    }
                } header: {
                    Label(category.title, systemImage: category.symbol)
                }
            }
        }
    }
}

private struct GroupRow: View {
    @Bindable var group: AppBlockGroup
    let isBlocked: Bool
    @Environment(RulesRepository.self) private var repository

    var body: some View {
        HStack(spacing: Spacing.s) {
            IconBadge(symbol: group.category.symbol, tint: group.category.tint)
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                HStack {
                    Text(group.name).font(.headline)
                    if isBlocked { StatusBadge(text: "Blocked", symbol: "lock.fill", tint: .fgDanger) }
                }
                SelectionIconsView(selection: group.selectedApplications, maxIcons: 5, iconSize: 22)
            }
            Spacer()
            Toggle("Enabled", isOn: $group.isEnabled)
                .labelsHidden()
                .onChange(of: group.isEnabled) { repository.commit() }
        }
        .padding(.vertical, Spacing.xxs)
    }
}

private struct LimitsList: View {
    @Query(sort: \UsageLimit.createdAt) private var limits: [UsageLimit]
    @Environment(RulesRepository.self) private var repository
    let onEdit: (UsageLimit) -> Void

    var body: some View {
        if limits.isEmpty {
            ContentUnavailableView {
                Label("No usage limits", systemImage: "hourglass")
            } description: {
                Text("Set a daily allowance, like 30 minutes of social media. When it's used up, the apps are blocked until midnight.")
            }
            .listRowBackground(Color.clear)
        }
        Section {
            ForEach(limits) { limit in
                UsageLimitRow(limit: limit)
                    .contentShape(Rectangle())
                    .onTapGesture { onEdit(limit) }
                    .swipeActions {
                        Button("Delete", role: .destructive) { repository.delete(limit) }
                    }
            }
        } footer: {
            if !limits.isEmpty {
                Text("iOS reports usage in steps, so progress updates every few minutes. Limits reset at midnight in your current time zone.")
            }
        }
    }
}

struct UsageLimitRow: View {
    @Bindable var limit: UsageLimit
    @Environment(BlockingEngine.self) private var engine
    @Environment(RulesRepository.self) private var repository

    var body: some View {
        let used = engine.usedMinutes(for: limit.id)
        let progress = UsageLimitCalculator.progress(used: used, limit: limit.dailyLimitMinutes)
        let reached = engine.isActive(limit.ruleKey)
        let remaining = UsageLimitCalculator.remainingMinutes(used: used, limit: limit.dailyLimitMinutes)
        let tint: Color = reached ? .fgDanger : progress >= 0.8 ? .fgWarning : .accentColor

        VStack(alignment: .leading, spacing: Spacing.s) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(limit.name).font(.headline)
                    Text("\(DurationFormat.minutes(limit.dailyLimitMinutes)) daily limit")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                Toggle("Enabled", isOn: $limit.isEnabled)
                    .labelsHidden()
                    .onChange(of: limit.isEnabled) { repository.commit() }
            }
            UsageBar(progress: progress, tint: tint)
            HStack {
                Text("\(used) / \(limit.dailyLimitMinutes) minutes")
                    .font(.subheadline.monospacedDigit())
                Spacer()
                if reached {
                    StatusBadge(text: "Blocked until midnight", symbol: "lock.fill", tint: .fgDanger)
                } else {
                    Text("\(remaining) minutes remaining")
                        .font(.subheadline)
                        .foregroundStyle(tint == .accentColor ? .secondary : tint)
                }
            }
            RuleHealthBadge(key: limit.ruleKey)
        }
        .padding(.vertical, Spacing.xxs)
        .opacity(limit.isEnabled ? 1 : 0.55)
        .accessibilityElement(children: .combine)
    }
}
