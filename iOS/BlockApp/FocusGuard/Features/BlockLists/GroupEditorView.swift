import SwiftUI
@preconcurrency import FamilyControls

struct GroupEditorView: View {
    let group: AppBlockGroup?

    @Environment(\.dismiss) private var dismiss
    @Environment(RulesRepository.self) private var repository
    @State private var name = ""
    @State private var category: BlockCategory = .socialMedia
    @State private var selection = FamilyActivitySelection()
    @State private var showPicker = false

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && !selection.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("e.g. Social Media Block", text: $name)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(["Social Media Block", "Gaming Block", "Work Distractions", "Night Routine"], id: \.self) { suggestion in
                                ChipButton(title: suggestion, isSelected: name == suggestion) { name = suggestion }
                            }
                        }
                    }
                }
                Section("Category") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: Spacing.s) {
                        ForEach(BlockCategory.allCases) { item in
                            Button { category = item } label: {
                                VStack(spacing: Spacing.xs) {
                                    IconBadge(symbol: item.symbol, tint: item.tint, size: 36)
                                    Text(item.title).font(.caption.weight(.medium)).foregroundStyle(.primary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, Spacing.s)
                                .background(
                                    RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                                        .strokeBorder(category == item ? item.tint : .clear, lineWidth: 2)
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(category == item ? .isSelected : [])
                        }
                    }
                    .padding(.vertical, Spacing.xxs)
                }
                Section {
                    Button { showPicker = true } label: {
                        Label(selection.isEmpty ? "Choose apps" : "Edit apps", systemImage: "plus.app.fill")
                    }
                    if !selection.isEmpty {
                        SelectionListView(selection: selection) { selection = $0 }
                    }
                } header: {
                    Text("Apps")
                } footer: {
                    Text(selection.isEmpty ? "Pick apps, whole categories, or websites." : selection.summary)
                }
            }
            .navigationTitle(group == nil ? "New Block List" : "Edit Block List")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save).disabled(!isValid)
                }
            }
            .familyActivityPicker(isPresented: $showPicker, selection: $selection)
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard let group else { return }
        name = group.name
        category = group.category
        selection = group.selectedApplications
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if let group {
            group.name = trimmed
            group.category = category
            group.selectedApplications = selection
            repository.commit()
        } else {
            repository.insert(AppBlockGroup(name: trimmed, category: category, selection: selection))
        }
        dismiss()
    }
}
