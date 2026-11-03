import SwiftData
import SwiftUI
@preconcurrency import FamilyControls
import FocusGuardKit

/// Form section for choosing what a rule blocks: any number of groups plus extra apps.
struct TargetsSection: View {
    @Binding var groupIDs: [UUID]
    @Binding var selection: FamilyActivitySelection
    var footer: String?

    @Query(sort: \AppBlockGroup.createdAt) private var groups: [AppBlockGroup]
    @State private var showPicker = false

    var body: some View {
        Section {
            ForEach(groups) { group in
                let isOn = groupIDs.contains(group.id)
                Button {
                    if isOn { groupIDs.removeAll { $0 == group.id } } else { groupIDs.append(group.id) }
                } label: {
                    HStack(spacing: Spacing.s) {
                        IconBadge(symbol: group.category.symbol, tint: group.category.tint, size: 30)
                        VStack(alignment: .leading) {
                            Text(group.name).foregroundStyle(.primary)
                            Text(group.selectedApplications.summary).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(isOn ? Color.accentColor : Color.secondary)
                            .font(.title3)
                    }
                }
                .accessibilityAddTraits(isOn ? .isSelected : [])
            }
            Button { showPicker = true } label: {
                HStack {
                    Label(selection.isEmpty ? "Add individual apps" : "Edit individual apps", systemImage: "plus.app")
                    Spacer()
                    if !selection.isEmpty { SelectionIconsView(selection: selection, maxIcons: 4, iconSize: 22) }
                }
            }
        } header: {
            Text("Apps to block")
        } footer: {
            if let footer { Text(footer) }
        }
        .familyActivityPicker(isPresented: $showPicker, selection: $selection)
    }
}

/// Fallback when no Screen Time access exists, shown wherever pickers would appear.
struct AuthorizationRequiredBanner: View {
    @Environment(FamilyControlsAuthorizationService.self) private var authorization
    @Environment(AppRouter.self) private var router

    var body: some View {
        if authorization.state != .approved {
            Card {
                HStack(alignment: .top, spacing: Spacing.m) {
                    IconBadge(symbol: "exclamationmark.shield.fill", tint: .fgWarning, size: 36)
                    VStack(alignment: .leading, spacing: Spacing.xxs) {
                        Text("Screen Time access needed").font(.headline)
                        Text("Rules are saved but won't block apps until you allow access.")
                            .font(.subheadline).foregroundStyle(.secondary)
                        Button("Allow access") {
                            Task { await authorization.request() }
                        }
                        .font(.subheadline.weight(.semibold))
                        .padding(.top, Spacing.xxs)
                    }
                }
            }
        }
    }
}

/// Shown on rule rows when iOS can't enforce the rule.
struct RuleHealthBadge: View {
    @Environment(BlockingEngine.self) private var engine
    let key: RuleKey

    var body: some View {
        if engine.isOverflow(key) {
            StatusBadge(text: "Over iOS limit of 20 rules", symbol: "exclamationmark.triangle.fill", tint: .fgWarning)
        } else if let error = engine.monitoringError(for: key) {
            StatusBadge(text: error, symbol: "exclamationmark.triangle.fill", tint: .fgWarning)
                .lineLimit(1)
        }
    }
}
