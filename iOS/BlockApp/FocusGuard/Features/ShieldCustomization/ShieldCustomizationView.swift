import SwiftUI
import FocusGuardKit

/// Faithful preview of the system shield: same text builder and color resolution as the
/// ShieldConfiguration extension, laid out like Apple's shield (icon, title, subtitle, buttons).
struct ShieldPreview: View {
    let theme: ShieldThemeSnapshot
    var reason = ShieldReasonInfo(reason: .usageLimit, ruleName: "Social Media", endsAt: nil, limitMinutes: 30)

    var body: some View {
        let style = ShieldStyle(theme: theme)
        let text = ShieldContentBuilder.content(theme: theme, appName: "Instagram", reasons: [reason], revealReason: false, now: .now, calendar: .current)

        ZStack {
            background(style)
            VStack(spacing: Spacing.m) {
                Spacer()
                icon(style)
                Text(text.title)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Color(uiColor: style.titleColor))
                    .multilineTextAlignment(.center)
                Text(text.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(Color(uiColor: style.subtitleColor))
                    .multilineTextAlignment(.center)
                Spacer()
                Text(theme.primaryButtonLabel.isEmpty ? "Close" : theme.primaryButtonLabel)
                    .font(.headline)
                    .foregroundStyle(Color(uiColor: style.buttonTextColor))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.s)
                    .background(Color(uiColor: style.accentColor), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                if !theme.secondaryButtonLabel.isEmpty {
                    Text(theme.secondaryButtonLabel)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color(uiColor: style.accentColor))
                }
            }
            .padding(Spacing.l)
        }
        .frame(height: 440)
        .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 36, style: .continuous).strokeBorder(.quaternary, lineWidth: 6))
        .environment(\.colorScheme, colorScheme)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Blocking screen preview")
    }

    private var colorScheme: ColorScheme {
        switch theme.appearance {
        case .light: .light
        case .dark: .dark
        case .system: .light
        }
    }

    @ViewBuilder
    private func background(_ style: ShieldStyle) -> some View {
        ZStack {
            if style.blurStyle != nil {
                LinearGradient(colors: [.pink, .orange, .purple], startPoint: .topLeading, endPoint: .bottomTrailing)
                Rectangle().fill(.regularMaterial)
            }
            if let color = style.backgroundColor {
                Color(uiColor: color)
            }
        }
    }

    @ViewBuilder
    private func icon(_ style: ShieldStyle) -> some View {
        switch theme.iconKind {
        case .symbol:
            Image(systemName: theme.iconValue)
                .font(.system(size: 52, weight: .semibold))
                .foregroundStyle(Color(uiColor: style.accentColor))
        case .emoji:
            Text(theme.iconValue).font(.system(size: 60))
        case .none:
            EmptyView()
        }
    }
}

struct ShieldCustomizationView: View {
    @Environment(RulesRepository.self) private var repository
    @State private var theme = ShieldThemeSnapshot.template(.motivational)
    @State private var loaded = false
    @State private var saved = false

    private let symbols = ["shield.lefthalf.filled", "circle.slash", "moon.stars.fill", "checklist", "brain.head.profile", "leaf.fill", "flame.fill", "hourglass", "target", "figure.mind.and.body", "book.fill", "sparkles"]
    private let emojis = ["🔥", "🧘", "🎯", "🌱", "📚", "💪", "⏳", "🚀", "🌙", "✋"]

    var body: some View {
        Form {
            Section {
                ShieldPreview(theme: theme)
                    .padding(.horizontal, Spacing.xxl)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .animation(.fgSpring, value: theme)
            }

            Section("Template") {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.s) {
                        ForEach(ShieldTemplate.allCases) { template in
                            templateCard(template)
                        }
                    }
                    .padding(.vertical, Spacing.xxs)
                }
            }

            Section {
                TextField("Title", text: binding(\.title), axis: .vertical)
                Menu("Suggestions") {
                    ForEach(ShieldThemeSnapshot.titleSuggestions, id: \.self) { suggestion in
                        Button(suggestion) { update { $0.title = suggestion } }
                    }
                }
                TextField("Subtitle", text: binding(\.subtitle), axis: .vertical)
                Menu("Suggestions") {
                    ForEach(ShieldThemeSnapshot.subtitleSuggestions, id: \.self) { suggestion in
                        Button(suggestion) { update { $0.subtitle = suggestion } }
                    }
                }
            } header: {
                Text("Message")
            } footer: {
                Text("Use {app} to insert the blocked app's name.")
            }

            Section("Icon") {
                Picker("Type", selection: binding(\.iconKind)) {
                    ForEach(ShieldIconKind.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                if theme.iconKind != .none {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: Spacing.s) {
                        ForEach(theme.iconKind == .symbol ? symbols : emojis, id: \.self) { value in
                            Button { update { $0.iconValue = value } } label: {
                                Group {
                                    if theme.iconKind == .symbol { Image(systemName: value).font(.title3) } else { Text(value).font(.title2) }
                                }
                                .frame(width: 44, height: 44)
                                .background(theme.iconValue == value ? Color.accentColor.opacity(0.18) : Color.fgFill, in: RoundedRectangle(cornerRadius: Radius.chip))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, Spacing.xxs)
                }
            }

            Section {
                Picker("Background", selection: binding(\.backgroundStyle)) {
                    ForEach(ShieldBackgroundStyle.allCases) { Text($0.title).tag($0) }
                }
                Picker("Appearance", selection: binding(\.appearance)) {
                    ForEach(ShieldAppearance.allCases) { Text($0.title).tag($0) }
                }
                if theme.backgroundStyle != .blur {
                    ColorPicker("Background color", selection: colorBinding(\.backgroundHex), supportsOpacity: false)
                }
                if theme.appearance != .system {
                    ColorPicker("Text color", selection: colorBinding(\.textHex), supportsOpacity: false)
                }
                ColorPicker("Accent color", selection: colorBinding(\.accentHex), supportsOpacity: false)
            } header: {
                Text("Style")
            } footer: {
                Text("Apple's shield supports a solid color and/or system blur. Gradients and background images aren't available on the real blocking screen, so they aren't offered here.")
            }

            Section {
                TextField("Primary button", text: binding(\.primaryButtonLabel))
                TextField("Secondary button (optional)", text: binding(\.secondaryButtonLabel))
                Toggle("Show when apps unlock", isOn: binding(\.showsRemainingTime))
                Toggle("Show why it's blocked", isOn: binding(\.showsBlockReason))
            } header: {
                Text("Details")
            } footer: {
                Text("The primary button closes the app. The secondary button reveals which rule is blocking it. iOS doesn't allow other actions on the blocking screen.")
            }
        }
        .navigationTitle("Blocking Screen")
        .toolbar {
            Button("Save") {
                repository.updateTheme(theme)
                saved.toggle()
            }
            .fontWeight(.semibold)
        }
        .sensoryFeedback(.success, trigger: saved)
        .onAppear {
            guard !loaded else { return }
            loaded = true
            theme = repository.theme.snapshot
        }
    }

    private func templateCard(_ template: ShieldTemplate) -> some View {
        let preset = template == .custom ? theme : ShieldThemeSnapshot.template(template)
        let style = ShieldStyle(theme: preset)
        let isSelected = theme.template == template
        return Button {
            withAnimation(.fgSpring) {
                if template == .custom {
                    theme.template = .custom
                } else {
                    theme = ShieldThemeSnapshot.template(template)
                }
            }
        } label: {
            VStack(spacing: Spacing.xs) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(uiColor: style.backgroundColor ?? .systemGray5))
                    .overlay {
                        Image(systemName: template == .custom ? "paintbrush.pointed.fill" : "textformat")
                            .foregroundStyle(Color(uiColor: style.accentColor))
                    }
                    .frame(width: 72, height: 96)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(isSelected ? Color.accentColor : Color.clear, lineWidth: 3)
                    )
                Text(template.title).font(.caption.weight(.medium)).foregroundStyle(.primary)
            }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func update(_ change: (inout ShieldThemeSnapshot) -> Void) {
        change(&theme)
        theme.template = .custom
    }

    private func binding<T>(_ keyPath: WritableKeyPath<ShieldThemeSnapshot, T>) -> Binding<T> {
        Binding(
            get: { theme[keyPath: keyPath] },
            set: { value in update { $0[keyPath: keyPath] = value } }
        )
    }

    private func colorBinding(_ keyPath: WritableKeyPath<ShieldThemeSnapshot, String>) -> Binding<Color> {
        Binding(
            get: { Color(hex: theme[keyPath: keyPath]) },
            set: { color in update { $0[keyPath: keyPath] = color.hexString } }
        )
    }
}
