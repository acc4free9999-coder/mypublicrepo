import SwiftUI
@preconcurrency import FamilyControls
import FocusGuardKit

struct UsageLimitEditorView: View {
    let limit: UsageLimit?

    @Environment(\.dismiss) private var dismiss
    @Environment(RulesRepository.self) private var repository
    @State private var name = ""
    @State private var minutes = 30
    @State private var groupIDs: [UUID] = []
    @State private var selection = FamilyActivitySelection()

    private let presets = [15, 20, 30, 45, 60, 90, 120]

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && minutes > 0
            && (!groupIDs.isEmpty || !selection.isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("e.g. Instagram", text: $name)
                }
                Section {
                    VStack(alignment: .leading, spacing: Spacing.m) {
                        Text(DurationFormat.minutes(minutes))
                            .font(.fgLargeNumber)
                            .contentTransition(.numericText())
                            .animation(.fgSpring, value: minutes)
                            .frame(maxWidth: .infinity)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(presets, id: \.self) { preset in
                                    ChipButton(title: DurationFormat.minutes(preset), isSelected: minutes == preset) { minutes = preset }
                                }
                            }
                        }
                        Stepper("Custom", value: $minutes, in: 1...720, step: minutes < 30 ? 1 : 5)
                    }
                    .padding(.vertical, Spacing.xxs)
                } header: {
                    Text("Daily limit")
                } footer: {
                    Text("Usage is counted across all selected apps together. When the limit is reached they're blocked until midnight. You'll be warned \(UsageLimitCalculator.warningLeadMinutes) minutes before.")
                }
                TargetsSection(
                    groupIDs: $groupIDs,
                    selection: $selection,
                    footer: "For a per-app limit, choose a single app. Create one limit per app to give each its own allowance."
                )
            }
            .navigationTitle(limit == nil ? "New Usage Limit" : "Edit Usage Limit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save", action: save).disabled(!isValid) }
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard let limit else { return }
        name = limit.name
        minutes = limit.dailyLimitMinutes
        groupIDs = limit.groupIDs
        selection = limit.customSelection
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if let limit {
            limit.name = trimmed
            limit.dailyLimitMinutes = minutes
            limit.groupIDs = groupIDs
            limit.customSelection = selection
            repository.commit()
        } else {
            repository.insert(UsageLimit(name: trimmed, dailyLimitMinutes: minutes, groupIDs: groupIDs, selectionData: SelectionCoder.encode(selection)))
        }
        dismiss()
    }
}
