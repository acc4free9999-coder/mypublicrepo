import Foundation
import FocusGuardKit

struct AppPreferences: Codable, Equatable {
    var hasCompletedOnboarding = false
    var notifications = NotificationPreferences()
    var dailyReminderEnabled = false
    var dailyReminderMinutes = 9 * 60
    var focusDefaultMinutes = 30
    var focusGroupIDs: [UUID] = []
    var focusSelectionData = Data()

    var dailyReminderTime: TimeOfDay {
        get { TimeOfDay(minutesSinceMidnight: dailyReminderMinutes) }
        set { dailyReminderMinutes = newValue.minutesSinceMidnight }
    }
}

@MainActor
@Observable
final class PreferencesStore {
    private static let key = "app.preferences"
    private let defaults: UserDefaults

    var value: AppPreferences {
        didSet { persist() }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: Self.key),
           let decoded = try? JSONDecoder().decode(AppPreferences.self, from: data) {
            value = decoded
        } else {
            value = AppPreferences()
        }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(value) {
            defaults.set(data, forKey: Self.key)
        }
    }
}
