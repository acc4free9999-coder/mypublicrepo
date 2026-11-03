import Foundation
import SwiftData

enum PersistenceController {
    static var schema: Schema {
        Schema([
            AppBlockGroup.self,
            UsageLimit.self,
            BlockingSchedule.self,
            AllDayRule.self,
            FocusSession.self,
            ShieldTheme.self
        ])
    }

    static func makeContainer(inMemory: Bool = false) throws -> ModelContainer {
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: inMemory)
        return try ModelContainer(for: schema, configurations: [configuration])
    }
}
