import SwiftUI
@preconcurrency import FamilyControls

struct OnboardingView: View {
    @Environment(FamilyControlsAuthorizationService.self) private var authorization
    @Environment(LocalNotificationService.self) private var notifications
    @Environment(RulesRepository.self) private var repository
    @Environment(PreferencesStore.self) private var preferences
    @State private var model: OnboardingViewModel?

    var body: some View {
        Group {
            if let model {
                OnboardingContent(model: model)
            } else {
                Color.fgBackground
            }
        }
        .onAppear {
            if model == nil {
                model = OnboardingViewModel(authorization: authorization, notifications: notifications, repository: repository, preferences: preferences)
            }
        }
    }
}

private struct OnboardingContent: View {
    @Bindable var model: OnboardingViewModel
    @State private var showPicker = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                if model.step != .welcome && model.step != .done {
                    Button { withAnimation(.fgSpring) { model.back() } } label: {
                        Image(systemName: "chevron.left").font(.headline)
                    }
                    .accessibilityLabel("Back")
                }
                ProgressView(value: model.progress).tint(.accentColor)
            }
            .padding(.horizontal, Spacing.l)
            .padding(.top, Spacing.s)

            ScrollView {
                stepContent
                    .padding(Spacing.l)
                    .frame(maxWidth: .infinity)
                    .id(model.step)
                    .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))
            }
            .scrollBounceBehavior(.basedOnSize)

            footer
                .padding(Spacing.l)
        }
        .background(Color.fgBackground)
        .familyActivityPicker(isPresented: $showPicker, selection: $model.selection)
    }

    @ViewBuilder
    private var stepContent: some View {
        switch model.step {
        case .welcome:
            OnboardingHero(
                symbol: "shield.lefthalf.filled",
                tint: .accentColor,
                title: "Welcome to FocusGuard",
                message: "Take back your attention. Block distracting apps with daily limits, schedules and focus sessions."
            )
        case .howItWorks:
            VStack(spacing: Spacing.xl) {
                OnboardingHero(symbol: "lightbulb.max.fill", tint: .yellow, title: "How blocking works", message: "FocusGuard uses Apple's Screen Time technology. When a rule is active, iOS shows a FocusGuard screen instead of the app.")
                VStack(spacing: Spacing.s) {
                    FeatureRow(symbol: "hourglass", tint: .orange, title: "Usage limits", detail: "Block an app after a daily amount of use.")
                    FeatureRow(symbol: "calendar.badge.clock", tint: .blue, title: "Schedules", detail: "Block during set hours, including overnight.")
                    FeatureRow(symbol: "sun.max.fill", tint: .pink, title: "All-day rules", detail: "Block apps for the whole day on chosen days.")
                    FeatureRow(symbol: "timer", tint: .purple, title: "Focus sessions", detail: "Block now, for as long as you need.")
                }
            }
        case .authorization:
            VStack(spacing: Spacing.l) {
                OnboardingHero(symbol: "hand.raised.fill", tint: .indigo, title: "Allow Screen Time access", message: "iOS will ask you to confirm with Face ID or your passcode. FocusGuard never sees which apps you use — Apple only gives it anonymous tokens.")
                authorizationStatus
            }
        case .permissionsInfo:
            VStack(spacing: Spacing.l) {
                OnboardingHero(symbol: "checkmark.shield.fill", tint: .green, title: "What FocusGuard can do", message: "Everything happens on your device.")
                VStack(spacing: Spacing.s) {
                    FeatureRow(symbol: "lock.fill", tint: .green, title: "Private by design", detail: "App names and usage stay inside Apple's Screen Time sandbox.")
                    FeatureRow(symbol: "bolt.badge.clock.fill", tint: .orange, title: "Works when closed", detail: "iOS enforces your rules even if FocusGuard isn't running.")
                    FeatureRow(symbol: "exclamationmark.triangle.fill", tint: .secondary, title: "System limits", detail: "Screen Time features need iOS 18 or later and Apple's Family Controls entitlement. iOS allows up to 20 active rules.")
                }
            }
        case .selectApps:
            VStack(alignment: .leading, spacing: Spacing.l) {
                OnboardingHero(symbol: "apps.iphone", tint: .pink, title: "Pick your distractions", message: "Choose the apps, categories or websites you want to control.")
                Card {
                    VStack(alignment: .leading, spacing: Spacing.m) {
                        TextField("Group name", text: $model.groupName)
                            .font(.headline)
                            .textFieldStyle(.plain)
                        Picker("Category", selection: $model.category) {
                            ForEach(BlockCategory.allCases) { Label($0.title, systemImage: $0.symbol).tag($0) }
                        }
                        .pickerStyle(.menu)
                        Divider()
                        Button { showPicker = true } label: {
                            Label(model.selection.isEmpty ? "Choose apps" : "Edit selection", systemImage: "plus.app.fill")
                        }
                        if !model.selection.isEmpty {
                            SelectionIconsView(selection: model.selection)
                            Text(model.selection.summary).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        case .firstRule:
            VStack(spacing: Spacing.l) {
                OnboardingHero(symbol: "slider.horizontal.3", tint: .teal, title: "Your first rule", message: "Choose how “\(model.groupName)” should be blocked. You can change this any time.")
                VStack(spacing: Spacing.s) {
                    ForEach(OnboardingViewModel.FirstRule.allCases) { rule in
                        Button { model.firstRule = rule } label: {
                            HStack(spacing: Spacing.m) {
                                IconBadge(symbol: rule.symbol, tint: .accentColor, size: 36)
                                VStack(alignment: .leading) {
                                    Text(rule.title).font(.headline)
                                    Text(rule.detail).font(.subheadline).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: model.firstRule == rule ? "checkmark.circle.fill" : "circle")
                                    .font(.title3)
                                    .foregroundStyle(model.firstRule == rule ? Color.accentColor : Color.secondary)
                            }
                            .padding(Spacing.m)
                            .background(Color.fgCard, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        case .done:
            if model.authorizationState == .approved {
                OnboardingHero(symbol: "sparkles", tint: .accentColor, title: "You're all set", message: "Your dashboard shows what's blocked, your limits and your focus progress.")
            } else {
                OnboardingHero(symbol: "eye.slash", tint: .secondary, title: "Explore without blocking", message: "You can look around now and enable Screen Time access later from Settings. Rules won't block apps until access is granted.")
            }
        }
    }

    @ViewBuilder
    private var authorizationStatus: some View {
        switch model.authorizationState {
        case .approved:
            StatusBadge(text: "Access granted", symbol: "checkmark.seal.fill", tint: .fgSuccess)
        case .denied:
            Card {
                VStack(alignment: .leading, spacing: Spacing.s) {
                    Label("Access was denied", systemImage: "xmark.octagon.fill").font(.headline).foregroundStyle(Color.fgDanger)
                    Text(model.authorizationError ?? "You can allow FocusGuard in Settings › Screen Time, or try again.")
                        .font(.subheadline).foregroundStyle(.secondary)
                    Button("Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    }
                }
            }
        case .notDetermined:
            if let error = model.authorizationError {
                Text(error).font(.footnote).foregroundStyle(Color.fgWarning).multilineTextAlignment(.center)
            }
        }
    }

    @ViewBuilder
    private var footer: some View {
        switch model.step {
        case .authorization where model.authorizationState != .approved:
            VStack(spacing: Spacing.s) {
                Button {
                    Task { await model.requestAuthorization() }
                } label: {
                    if model.isRequesting { ProgressView().tint(.white) } else { Text(model.authorizationState == .denied ? "Try Again" : "Allow Access") }
                }
                .buttonStyle(.primary)
                .disabled(model.isRequesting)
                Button("Not now") { withAnimation(.fgSpring) { model.advance() } }
                    .font(.subheadline)
            }
        case .done:
            Button("Go to Dashboard") { Task { await model.finish() } }
                .buttonStyle(.primary)
        default:
            Button("Continue") { withAnimation(.fgSpring) { model.advance() } }
                .buttonStyle(.primary)
                .disabled(!model.canContinue)
                .opacity(model.canContinue ? 1 : 0.5)
        }
    }
}

private struct OnboardingHero: View {
    let symbol: String
    let tint: Color
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: Spacing.m) {
            Image(systemName: symbol)
                .font(.system(size: 52, weight: .semibold))
                .foregroundStyle(tint.gradient)
                .frame(width: 112, height: 112)
                .background(tint.opacity(0.12), in: Circle())
                .symbolEffect(.bounce, value: title)
                .padding(.top, Spacing.xl)
            Text(title)
                .font(.largeTitle.weight(.bold))
                .multilineTextAlignment(.center)
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }
}

struct FeatureRow: View {
    let symbol: String
    let tint: Color
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.m) {
            IconBadge(symbol: symbol, tint: tint, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(Spacing.m)
        .background(Color.fgCard, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }
}
