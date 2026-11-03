import Foundation

enum AppGroup {
    static let identifier = "group.com.focusguard.shared"

    /// Falls back to Application Support when the App Group entitlement is missing
    /// (e.g. unsigned simulator builds) so the app still runs.
    static var containerURL: URL {
        if let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier) {
            return url
        }
        let fallback = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appending(path: "FocusGuardShared", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: fallback, withIntermediateDirectories: true)
        return fallback
    }

    static var defaults: UserDefaults {
        UserDefaults(suiteName: identifier) ?? .standard
    }
}
