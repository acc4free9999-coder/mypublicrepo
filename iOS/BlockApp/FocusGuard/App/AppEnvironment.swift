import SwiftData
import SwiftUI

enum AppTab: Hashable {
    case home, apps, schedule, focus, settings
}

@MainActor
@Observable
final class AppRouter {
    var selectedTab: AppTab = .home
}

/// Composition root. Concrete services are created here and injected; the engine only
/// depends on protocols so it can be exercised with test doubles.
@MainActor
@Observable
final class AppEnvironment {
    let container: ModelContainer
    let preferences: PreferencesStore
    let authorization: FamilyControlsAuthorizationService
    let notifications: LocalNotificationService
    let engine: BlockingEngine
    let repository: RulesRepository
    let focus: FocusSessionController
    let router = AppRouter()

    init(container: ModelContainer) {
        let context = container.mainContext
        let preferences = PreferencesStore()
        let authorization = FamilyControlsAuthorizationService()
        let notifications = LocalNotificationService()
        let engine = BlockingEngine(
            context: context,
            monitor: DeviceActivityMonitoringService(),
            applier: ManagedSettingsShieldApplier(),
            authorization: authorization,
            preferences: preferences
        )
        self.container = container
        self.preferences = preferences
        self.authorization = authorization
        self.notifications = notifications
        self.engine = engine
        self.repository = RulesRepository(context: context, engine: engine)
        self.focus = FocusSessionController(context: context, engine: engine, notifications: notifications, preferences: preferences)
    }

    /// Run on launch and whenever the app becomes active.
    func refresh() async {
        let wasApproved = authorization.state == .approved
        authorization.refresh()
        await notifications.refreshStatus()
        if wasApproved && authorization.state != .approved {
            engine.removeAllBlocking()
        }
        engine.synchronize()
    }
}
