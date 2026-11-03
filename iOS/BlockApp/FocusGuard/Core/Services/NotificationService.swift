import Foundation
@preconcurrency import UserNotifications
import FocusGuardKit

@MainActor
protocol NotificationServicing: AnyObject {
    var isAuthorized: Bool { get }
    var isDenied: Bool { get }
    func refreshStatus() async
    @discardableResult func requestAuthorization() async -> Bool
    func scheduleFocusCompletion(sessionID: UUID, at date: Date)
    func cancelFocusCompletion(sessionID: UUID)
    func updateDailyReminder(enabled: Bool, time: TimeOfDay)
}

@MainActor
@Observable
final class LocalNotificationService: NotificationServicing {
    private static let reminderID = "focus.reminder.daily"
    private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    private var center: UNUserNotificationCenter { .current() }

    var isAuthorized: Bool {
        [.authorized, .provisional, .ephemeral].contains(authorizationStatus)
    }

    var isDenied: Bool { authorizationStatus == .denied }

    func refreshStatus() async {
        authorizationStatus = await center.notificationSettings().authorizationStatus
    }

    @discardableResult
    func requestAuthorization() async -> Bool {
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        await refreshStatus()
        return granted
    }

    func scheduleFocusCompletion(sessionID: UUID, at date: Date) {
        let content = UNMutableNotificationContent()
        content.title = "Focus session complete"
        content.body = "Nice work. Your apps are available again."
        content.sound = .default
        content.threadIdentifier = "focus"
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, date.timeIntervalSinceNow), repeats: false)
        center.add(UNNotificationRequest(identifier: Self.focusID(sessionID), content: content, trigger: trigger), withCompletionHandler: nil)
    }

    func cancelFocusCompletion(sessionID: UUID) {
        center.removePendingNotificationRequests(withIdentifiers: [Self.focusID(sessionID)])
    }

    func updateDailyReminder(enabled: Bool, time: TimeOfDay) {
        center.removePendingNotificationRequests(withIdentifiers: [Self.reminderID])
        guard enabled else { return }
        let content = UNMutableNotificationContent()
        content.title = "Time to focus"
        content.body = "Start a focus session and protect your attention."
        content.sound = .default
        content.threadIdentifier = "focus"
        let trigger = UNCalendarNotificationTrigger(dateMatching: time.dateComponents, repeats: true)
        center.add(UNNotificationRequest(identifier: Self.reminderID, content: content, trigger: trigger), withCompletionHandler: nil)
    }

    private static func focusID(_ id: UUID) -> String { "focus.complete.\(id.uuidString)" }
}
