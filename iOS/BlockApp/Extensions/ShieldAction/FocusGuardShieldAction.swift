import Foundation
import ManagedSettings
import FocusGuardKit

/// Handles shield button taps. The primary button closes the app and counts as a resisted
/// distraction; the secondary button re-renders the shield with the blocking reason.
final class FocusGuardShieldAction: ShieldActionDelegate {
    private let store = SharedStore()

    override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        completionHandler(respond(to: action))
    }

    override func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        completionHandler(respond(to: action))
    }

    override func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        completionHandler(respond(to: action))
    }

    private func respond(to action: ShieldAction) -> ShieldActionResponse {
        let now = Date()
        switch action {
        case .primaryButtonPressed:
            let day = DayKey(date: now, calendar: .current).description
            store.updateRuntime { runtime in
                runtime.shieldDismissals[day, default: 0] += 1
                runtime.reasonRevealUntil = nil
            }
            return .close
        case .secondaryButtonPressed:
            store.updateRuntime { $0.reasonRevealUntil = now.addingTimeInterval(60) }
            return .defer
        default:
            return .close
        }
    }
}
