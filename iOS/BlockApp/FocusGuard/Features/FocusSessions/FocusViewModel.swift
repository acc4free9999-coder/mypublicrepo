import Foundation
import SwiftData
@preconcurrency import FamilyControls
import FocusGuardKit

@MainActor
@Observable
final class FocusViewModel {
    static let presets = [15, 30, 45, 60]

    var minutes: Int
    var groupIDs: [UUID]
    var selection: FamilyActivitySelection
    var errorMessage: String?

    private let controller: FocusSessionController

    init(controller: FocusSessionController, preferences: PreferencesStore) {
        self.controller = controller
        self.minutes = max(FocusSessionController.minimumMinutes, preferences.value.focusDefaultMinutes)
        self.groupIDs = preferences.value.focusGroupIDs
        self.selection = SelectionCoder.decode(preferences.value.focusSelectionData)
    }

    var isCustomDuration: Bool { !Self.presets.contains(minutes) }
    var canStart: Bool { !groupIDs.isEmpty || !selection.isEmpty }

    func start(groups: [AppBlockGroup]) {
        do {
            try controller.start(minutes: minutes, groupIDs: groupIDs, selection: selection, groups: groups)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func end(_ session: FocusSession) {
        controller.endEarly(session)
    }

    static func progress(of session: FocusSession, at date: Date) -> Double {
        guard session.duration > 0 else { return 1 }
        return min(1, max(0, date.timeIntervalSince(session.startDate) / session.duration))
    }
}
