import Foundation
import SwiftData
@preconcurrency import FamilyControls
import FocusGuardKit

enum FocusSessionError: LocalizedError {
    case alreadyRunning
    case tooShort
    case nothingSelected

    var errorDescription: String? {
        switch self {
        case .alreadyRunning: "A focus session is already running."
        case .tooShort: "Focus sessions must be at least \(FocusSessionController.minimumMinutes) minutes."
        case .nothingSelected: "Choose apps or groups to block during the session."
        }
    }
}

@MainActor
@Observable
final class FocusSessionController {
    /// Matches DeviceActivity's minimum interval so the session can end without the app.
    nonisolated static let minimumMinutes = 15
    nonisolated static let maximumMinutes = 240

    private let context: ModelContext
    private let engine: BlockingEngine
    private let notifications: any NotificationServicing
    private let preferences: PreferencesStore

    init(context: ModelContext, engine: BlockingEngine, notifications: any NotificationServicing, preferences: PreferencesStore) {
        self.context = context
        self.engine = engine
        self.notifications = notifications
        self.preferences = preferences
    }

    var activeSession: FocusSession? {
        let active = FocusSessionStatus.active.rawValue
        var descriptor = FetchDescriptor<FocusSession>(predicate: #Predicate { $0.statusRaw == active })
        descriptor.fetchLimit = 1
        return try? context.fetch(descriptor).first
    }

    @discardableResult
    func start(minutes: Int, groupIDs: [UUID], selection: FamilyActivitySelection, groups: [AppBlockGroup]) throws -> FocusSession {
        guard activeSession == nil else { throw FocusSessionError.alreadyRunning }
        guard minutes >= Self.minimumMinutes else { throw FocusSessionError.tooShort }

        let session = FocusSession(
            duration: TimeInterval(min(minutes, Self.maximumMinutes) * 60),
            startDate: .now,
            groupIDs: groupIDs,
            selectionData: SelectionCoder.encode(selection)
        )
        guard !session.resolvedSelection(groups: groups).isEmpty else { throw FocusSessionError.nothingSelected }

        context.insert(session)
        try context.save()

        preferences.value.focusGroupIDs = groupIDs
        preferences.value.focusSelectionData = SelectionCoder.encode(selection)
        preferences.value.focusDefaultMinutes = minutes

        if preferences.value.notifications.focusCompleted {
            notifications.scheduleFocusCompletion(sessionID: session.id, at: session.endDate)
        }
        engine.synchronize()
        return session
    }

    func endEarly(_ session: FocusSession) {
        session.status = .cancelled
        session.actualEndDate = .now
        try? context.save()
        notifications.cancelFocusCompletion(sessionID: session.id)
        engine.synchronize()
    }
}
