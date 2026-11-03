import SwiftUI
import FocusGuardKit

struct SettingsView: View {
    @Environment(BlockingEngine.self) private var engine
    @Environment(PreferencesStore.self) private var preferences
    @Environment(FamilyControlsAuthorizationService.self) private var authorization
    @Environment(LocalNotificationService.self) private var notifications
    @Environment(\.openURL) private var openURL

    var body: some View {
        @Bindable var preferences = preferences
        NavigationStack {
            Form {
                Section {
                    NavigationLink {
                        ShieldCustomizationView()
                    } label: {
                        Label("Blocking Screen", systemImage: "rectangle.portrait.on.rectangle.portrait.angled.fill")
                    }
                } footer: {
                    Text("Customize what you see when you open a blocked app.")
                }

                Section("Screen Time Access") {
                    HStack {
                        Label("Status", systemImage: "hourglass")
                        Spacer()
                        authorizationBadge
                    }
                    if authorization.state != .approved {
                        Button("Allow Access") { Task { await authorization.request() } }
                    }
                    if let error = authorization.lastErrorMessage {
                        Text(error).font(.footnote).foregroundStyle(Color.fgWarning)
                    }
                }

                Section {
                    HStack {
                        Label("Permission", systemImage: "bell.badge")
                        Spacer()
                        if notifications.isAuthorized {
                            StatusBadge(text: "On", tint: .fgSuccess)
                        } else if notifications.isDenied {
                            Button("Open Settings") { openSettings() }.font(.subheadline)
                        } else {
                            Button("Enable") { Task { await notifications.requestAuthorization() } }.font(.subheadline)
                        }
                    }
                    Toggle("Limit almost reached", isOn: $preferences.value.notifications.limitWarnings)
                    Toggle("Limit reached", isOn: $preferences.value.notifications.limitReached)
                    Toggle("Upcoming scheduled block", isOn: $preferences.value.notifications.upcomingBlocks)
                    Toggle("Focus session completed", isOn: $preferences.value.notifications.focusCompleted)
                    Toggle("Daily focus reminder", isOn: $preferences.value.dailyReminderEnabled)
                    if preferences.value.dailyReminderEnabled {
                        DatePicker("Remind me at", selection: $preferences.value.dailyReminderTime.asDate, displayedComponents: .hourAndMinute)
                    }
                } header: {
                    Text("Notifications")
                } footer: {
                    Text("Usage alerts are sent by iOS on FocusGuard's behalf, even when the app is closed.")
                }
                .disabled(!notifications.isAuthorized)
                .onChange(of: preferences.value.notifications) { engine.synchronize() }
                .onChange(of: preferences.value.dailyReminderEnabled) { updateReminder() }
                .onChange(of: preferences.value.dailyReminderMinutes) { updateReminder() }

                Section {
                    let monitored = engine.configuration.monitoredKeys.count
                    LabeledContent("Active rules", value: "\(monitored) of \(MonitoringPlanner.activityQuota)")
                    if !engine.state.overflowKeys.isEmpty {
                        Label("\(engine.state.overflowKeys.count) rule(s) exceed the iOS limit and are paused. Disable rules you don't need.", systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(Color.fgWarning)
                    }
                    if let last = engine.state.lastSync {
                        LabeledContent("Last sync", value: last.formatted(date: .omitted, time: .standard))
                    }
                    Button("Re-apply all rules") { engine.synchronize() }
                } header: {
                    Text("System")
                } footer: {
                    Text("iOS can monitor up to \(MonitoringPlanner.activityQuota) schedules at once. Focus sessions and usage limits get priority, then schedules, then all-day rules.")
                }

                Section("About") {
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")
                    Text("FocusGuard uses Apple's Screen Time frameworks (FamilyControls, ManagedSettings, DeviceActivity). Distribution requires Apple's Family Controls entitlement, and features depend on your iOS version. Your app usage never leaves your device.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
        }
    }

    @ViewBuilder
    private var authorizationBadge: some View {
        switch authorization.state {
        case .approved: StatusBadge(text: "Allowed", symbol: "checkmark.seal.fill", tint: .fgSuccess)
        case .denied: StatusBadge(text: "Denied", symbol: "xmark.octagon.fill", tint: .fgDanger)
        case .notDetermined: StatusBadge(text: "Not set", tint: .secondary)
        }
    }

    private func updateReminder() {
        notifications.updateDailyReminder(enabled: preferences.value.dailyReminderEnabled, time: preferences.value.dailyReminderTime)
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
    }
}
