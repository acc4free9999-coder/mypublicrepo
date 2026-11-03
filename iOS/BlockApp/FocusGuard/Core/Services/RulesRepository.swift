import Foundation
import SwiftData
@preconcurrency import FamilyControls
import FocusGuardKit

/// All writes go through here so every change is persisted and immediately re-applied.
@MainActor
@Observable
final class RulesRepository {
    private(set) var lastError: String?
    private let context: ModelContext
    private let engine: BlockingEngine

    init(context: ModelContext, engine: BlockingEngine) {
        self.context = context
        self.engine = engine
    }

    func commit() {
        do {
            try context.save()
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
        engine.synchronize()
    }

    func insert(_ model: some PersistentModel) {
        context.insert(model)
        commit()
    }

    func delete(_ model: some PersistentModel) {
        context.delete(model)
        commit()
    }

    /// Removes a group and detaches it from every rule that referenced it.
    func deleteGroup(_ group: AppBlockGroup) {
        let id = group.id
        let owners: [any BlockTargetsOwner] =
            ((try? context.fetch(FetchDescriptor<UsageLimit>())) ?? [])
            + ((try? context.fetch(FetchDescriptor<BlockingSchedule>())) ?? [])
            + ((try? context.fetch(FetchDescriptor<AllDayRule>())) ?? [])
        for owner in owners where owner.groupIDs.contains(id) {
            owner.groupIDs.removeAll { $0 == id }
        }
        delete(group)
    }

    func rulesReferencing(_ group: AppBlockGroup) -> [String] {
        let id = group.id
        let limits = ((try? context.fetch(FetchDescriptor<UsageLimit>())) ?? []).filter { $0.groupIDs.contains(id) }.map(\.name)
        let schedules = ((try? context.fetch(FetchDescriptor<BlockingSchedule>())) ?? []).filter { $0.groupIDs.contains(id) }.map(\.name)
        let allDay = ((try? context.fetch(FetchDescriptor<AllDayRule>())) ?? []).filter { $0.groupIDs.contains(id) }.map(\.name)
        return limits + schedules + allDay
    }

    var theme: ShieldTheme { engine.currentTheme() }

    func updateTheme(_ snapshot: ShieldThemeSnapshot) {
        theme.snapshot = snapshot
        commit()
    }
}
