import SwiftData
import SwiftUI

@main
struct FocusGuardApp: App {
    @State private var environment: AppEnvironment

    init() {
        let container: ModelContainer
        do {
            container = try PersistenceController.makeContainer()
        } catch {
            // Keep the app usable rather than crash; data won't persist this launch.
            container = try! PersistenceController.makeContainer(inMemory: true)
        }
        _environment = State(initialValue: AppEnvironment(container: container))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(environment)
                .environment(environment.engine)
                .environment(environment.repository)
                .environment(environment.preferences)
                .environment(environment.authorization)
                .environment(environment.notifications)
                .environment(environment.focus)
                .environment(environment.router)
                .modelContainer(environment.container)
        }
    }
}
