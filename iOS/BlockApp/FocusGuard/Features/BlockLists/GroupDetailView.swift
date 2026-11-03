import DeviceActivity
import SwiftUI
@preconcurrency import FamilyControls

struct GroupDetailView: View {
    @Bindable var group: AppBlockGroup
    @Environment(BlockingEngine.self) private var engine
    @Environment(RulesRepository.self) private var repository
    @State private var showEditor = false
    @State private var showPicker = false
    @State private var pickerSelection = FamilyActivitySelection()

    var body: some View {
        let selection = group.selectedApplications
        let blockedBy = engine.activeRuleNames(blocking: selection)

        List {
            Section {
                HStack(spacing: Spacing.m) {
                    IconBadge(symbol: group.category.symbol, tint: group.category.tint, size: 52)
                    VStack(alignment: .leading, spacing: Spacing.xxs) {
                        Text(group.category.title).font(.subheadline).foregroundStyle(.secondary)
                        if !group.isEnabled {
                            StatusBadge(text: "Disabled", tint: .secondary)
                        } else if blockedBy.isEmpty {
                            StatusBadge(text: "Not blocked right now", symbol: "lock.open.fill", tint: .fgSuccess)
                        } else {
                            StatusBadge(text: "Blocked by \(blockedBy.joined(separator: ", "))", symbol: "lock.fill", tint: .fgDanger)
                        }
                    }
                }
                .listRowBackground(Color.clear)
            }

            Section {
                SelectionListView(selection: selection, blocked: engine.blockedSelection) { updated in
                    group.selectedApplications = updated
                    repository.commit()
                }
                Button {
                    pickerSelection = selection
                    showPicker = true
                } label: {
                    Label("Add or remove apps", systemImage: "plus.app")
                }
            } header: {
                Text("Apps")
            } footer: {
                Text("Swipe an item to remove it from this list.")
            }

            Section("Today's usage") {
                DeviceActivityReport(.appUsage, filter: usageFilter(for: selection))
                    .frame(minHeight: 160)
            }

            let rules = repository.rulesReferencing(group)
            Section("Used by") {
                if rules.isEmpty {
                    Text("Not used by any rule yet.").foregroundStyle(.secondary)
                } else {
                    ForEach(rules, id: \.self) { Text($0) }
                }
            }
        }
        .navigationTitle(group.name)
        .toolbar {
            Button("Edit") { showEditor = true }
        }
        .sheet(isPresented: $showEditor) { GroupEditorView(group: group) }
        .familyActivityPicker(isPresented: $showPicker, selection: $pickerSelection)
        .onChange(of: showPicker) { _, isShowing in
            if !isShowing, pickerSelection != selection {
                group.selectedApplications = pickerSelection
                repository.commit()
            }
        }
    }

    private func usageFilter(for selection: FamilyActivitySelection) -> DeviceActivityFilter {
        let start = Calendar.current.startOfDay(for: .now)
        return DeviceActivityFilter(
            segment: .daily(during: DateInterval(start: start, end: .now)),
            users: .all,
            devices: .init([.iPhone, .iPad]),
            applications: selection.applicationTokens,
            categories: selection.categoryTokens,
            webDomains: selection.webDomainTokens
        )
    }
}
