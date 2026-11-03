import SwiftUI

struct RootView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(PreferencesStore.self) private var preferences
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if preferences.value.hasCompletedOnboarding {
                MainTabView()
                    .transition(.opacity)
            } else {
                OnboardingView()
                    .transition(.opacity)
            }
        }
        .animation(.fgSpring, value: preferences.value.hasCompletedOnboarding)
        .task { await environment.refresh() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await environment.refresh() }
            }
        }
        // While visible, pick up usage milestones and schedule transitions written by extensions.
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                environment.engine.refreshShields()
            }
        }
    }
}

struct MainTabView: View {
    @Environment(AppRouter.self) private var router

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.selectedTab) {
            Tab("Home", systemImage: "house.fill", value: AppTab.home) {
                DashboardView()
            }
            Tab("Apps", systemImage: "square.grid.2x2.fill", value: AppTab.apps) {
                AppsView()
            }
            Tab("Schedule", systemImage: "calendar.badge.clock", value: AppTab.schedule) {
                ScheduleView()
            }
            Tab("Focus", systemImage: "timer", value: AppTab.focus) {
                FocusView()
            }
            Tab("Settings", systemImage: "gearshape.fill", value: AppTab.settings) {
                SettingsView()
            }
        }
    }
}
