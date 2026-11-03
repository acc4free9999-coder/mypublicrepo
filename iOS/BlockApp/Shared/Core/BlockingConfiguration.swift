import Foundation
@preconcurrency import FamilyControls
import FocusGuardKit

/// A rule resolved to concrete targets. Written by the app, read by every extension.
struct ConfiguredRule: Codable {
    var descriptor: RuleDescriptor
    var name: String
    var selection: FamilyActivitySelection

    var key: RuleKey { descriptor.key }
}

struct NotificationPreferences: Codable, Equatable {
    var limitWarnings = true
    var limitReached = true
    var upcomingBlocks = true
    var focusCompleted = true
}

/// Snapshot of everything extensions need. SwiftData stays app-private; extensions only
/// decode this small JSON file, which keeps them well within their memory limits.
struct BlockingConfiguration: Codable {
    var rules: [ConfiguredRule] = []
    /// Rules that fit within the DeviceActivity quota and are actually enforced.
    var monitoredKeys: [RuleKey] = []
    var theme: ShieldThemeSnapshot = .template(.motivational)
    var notifications = NotificationPreferences()
    var updatedAt: Date = .distantPast

    func rule(for key: RuleKey) -> ConfiguredRule? {
        rules.first { $0.key == key }
    }

    var effectiveRules: [ConfiguredRule] {
        let monitored = Set(monitoredKeys)
        return rules.filter { monitored.contains($0.key) }
    }
}

/// State mutated at runtime by both the app and extensions.
struct RuntimeState: Codable {
    var usage: [UUID: UsageRecord] = [:]
    var appliedStores: Set<RuleKey> = []
    /// Keyed by `DayKey.description`.
    var shieldDismissals: [String: Int] = [:]
    var reasonRevealUntil: Date?
    var lastReconciledAt: Date?
}
