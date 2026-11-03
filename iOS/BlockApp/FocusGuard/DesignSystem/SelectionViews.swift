import SwiftUI
@preconcurrency import FamilyControls
import FocusGuardKit

/// Shows app/category/website icons for a selection using FamilyControls' privacy-preserving labels.
struct SelectionIconsView: View {
    let selection: FamilyActivitySelection
    var maxIcons = 6
    var iconSize: CGFloat = 28

    var body: some View {
        HStack(spacing: -6) {
            ForEach(Array(selection.applicationTokens.prefix(maxIcons)), id: \.self) { token in
                Label(token).labelStyle(.iconOnly).frame(width: iconSize, height: iconSize)
            }
            ForEach(Array(selection.categoryTokens.prefix(max(0, maxIcons - selection.applicationTokens.count))), id: \.self) { token in
                Label(token).labelStyle(.iconOnly).frame(width: iconSize, height: iconSize)
            }
            if selection.itemCount > maxIcons {
                Text("+\(selection.itemCount - maxIcons)")
                    .font(.caption2.weight(.bold))
                    .frame(width: iconSize, height: iconSize)
                    .background(Color.fgFill, in: Circle())
                    .padding(.leading, Spacing.xs)
            }
        }
        .accessibilityLabel(selection.summary)
    }
}

/// A list of each selected item with its name and icon, as provided by the system.
struct SelectionListView: View {
    let selection: FamilyActivitySelection
    var blocked: FamilyActivitySelection = FamilyActivitySelection()
    var onRemove: ((FamilyActivitySelection) -> Void)?

    var body: some View {
        ForEach(Array(selection.applicationTokens), id: \.self) { token in
            row(isBlocked: blocked.applicationTokens.contains(token)) { Label(token) } remove: {
                var copy = selection
                copy.applicationTokens.remove(token)
                return copy
            }
        }
        ForEach(Array(selection.categoryTokens), id: \.self) { token in
            row(isBlocked: blocked.categoryTokens.contains(token)) { Label(token) } remove: {
                var copy = selection
                copy.categoryTokens.remove(token)
                return copy
            }
        }
        ForEach(Array(selection.webDomainTokens), id: \.self) { token in
            row(isBlocked: blocked.webDomainTokens.contains(token)) { Label(token) } remove: {
                var copy = selection
                copy.webDomainTokens.remove(token)
                return copy
            }
        }
    }

    private func row<L: View>(isBlocked: Bool, @ViewBuilder label: () -> L, remove: @escaping () -> FamilyActivitySelection) -> some View {
        HStack {
            label()
            Spacer()
            if isBlocked {
                StatusBadge(text: "Blocked", symbol: "lock.fill", tint: .fgDanger)
            } else {
                StatusBadge(text: "Allowed", tint: .secondary)
            }
        }
        .swipeActions {
            if let onRemove {
                Button("Remove", role: .destructive) { onRemove(remove()) }
            }
        }
    }
}

struct WeekdaySelector: View {
    @Binding var selection: Set<Weekday>

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            HStack(spacing: Spacing.xs) {
                ForEach(Weekday.ordered()) { day in
                    let isOn = selection.contains(day)
                    Button {
                        withAnimation(.fgSpring) {
                            if isOn { selection.remove(day) } else { selection.insert(day) }
                        }
                    } label: {
                        Text(day.veryShortSymbol())
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 38)
                            .foregroundStyle(isOn ? Color.white : Color.primary)
                            .background(
                                isOn ? AnyShapeStyle(Color.accentColor.gradient) : AnyShapeStyle(Color.fgFill),
                                in: Circle()
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(day.shortSymbol())
                    .accessibilityAddTraits(isOn ? .isSelected : [])
                }
            }
            HStack(spacing: Spacing.xs) {
                ChipButton(title: "Weekdays", isSelected: selection == Weekday.workdays) { selection = Weekday.workdays }
                ChipButton(title: "Weekends", isSelected: selection == Weekday.weekend) { selection = Weekday.weekend }
                ChipButton(title: "Every day", isSelected: selection == Weekday.everyDay) { selection = Weekday.everyDay }
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
    }
}

extension TimeOfDay {
    /// Bridges to `DatePicker`, which edits a `Date`.
    var pickerDate: Date { date(on: .now, calendar: .current) }

    var formatted: String {
        pickerDate.formatted(date: .omitted, time: .shortened)
    }
}

extension Binding where Value == TimeOfDay {
    var asDate: Binding<Date> {
        Binding<Date>(
            get: { wrappedValue.pickerDate },
            set: { wrappedValue = TimeOfDay(date: $0, calendar: .current) }
        )
    }
}
