import Foundation
@preconcurrency import FamilyControls

enum AuthorizationState: Equatable {
    case notDetermined
    case approved
    case denied
}

@MainActor
protocol AuthorizationServicing: AnyObject {
    var state: AuthorizationState { get }
    var lastErrorMessage: String? { get }
    func refresh()
    @discardableResult func request() async -> AuthorizationState
}

@MainActor
@Observable
final class FamilyControlsAuthorizationService: AuthorizationServicing {
    private(set) var state: AuthorizationState = .notDetermined
    private(set) var lastErrorMessage: String?

    init() {
        refresh()
    }

    func refresh() {
        state = Self.map(AuthorizationCenter.shared.authorizationStatus)
    }

    @discardableResult
    func request() async -> AuthorizationState {
        lastErrorMessage = nil
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        } catch let error as FamilyControlsError {
            lastErrorMessage = Self.message(for: error)
        } catch {
            lastErrorMessage = error.localizedDescription
        }
        refresh()
        return state
    }

    private static func map(_ status: FamilyControls.AuthorizationStatus) -> AuthorizationState {
        switch status {
        case .approved: .approved
        case .denied: .denied
        case .notDetermined: .notDetermined
        default: .notDetermined
        }
    }

    private static func message(for error: FamilyControlsError) -> String {
        switch error {
        case .restricted:
            "Screen Time is restricted on this device (for example by a device management profile)."
        case .unavailable:
            "Screen Time isn't available. Check that Screen Time is turned on in Settings."
        case .invalidAccountType:
            "Sign in to iCloud with a personal Apple Account to use Screen Time controls."
        case .authorizationCanceled:
            "Permission was cancelled. You can try again any time."
        case .networkError:
            "A network connection is required the first time you grant access."
        case .authorizationConflict:
            "Another app is already managing Screen Time for this device."
        default:
            error.localizedDescription
        }
    }
}
