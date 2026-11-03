import Foundation
@preconcurrency import UserNotifications

/// Immediate local notifications, usable from the app and from extensions.
enum LocalNotifier {
    static func post(id: String, title: String, body: String, thread: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.threadIdentifier = thread
        let request = UNNotificationRequest(identifier: id, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }
}
