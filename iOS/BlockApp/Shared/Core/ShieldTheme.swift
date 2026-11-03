import Foundation

enum ShieldTemplate: String, Codable, CaseIterable, Identifiable {
    case minimalist, motivational, darkFocus, productivity, custom

    var id: String { rawValue }

    var title: String {
        switch self {
        case .minimalist: "Minimalist"
        case .motivational: "Motivational"
        case .darkFocus: "Dark Focus"
        case .productivity: "Productivity"
        case .custom: "Custom"
        }
    }
}

/// Mirrors what `ShieldConfiguration` can render: a background color and/or system blur.
/// Gradients and background images are not supported by Apple's shield API.
enum ShieldBackgroundStyle: String, Codable, CaseIterable, Identifiable {
    case solid, blur, tintedBlur

    var id: String { rawValue }

    var title: String {
        switch self {
        case .solid: "Solid color"
        case .blur: "System blur"
        case .tintedBlur: "Tinted blur"
        }
    }
}

enum ShieldAppearance: String, Codable, CaseIterable, Identifiable {
    case system, light, dark

    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

enum ShieldIconKind: String, Codable, CaseIterable, Identifiable {
    case symbol, emoji, none

    var id: String { rawValue }

    var title: String {
        switch self {
        case .symbol: "Symbol"
        case .emoji: "Emoji"
        case .none: "None"
        }
    }
}

struct ShieldThemeSnapshot: Codable, Equatable {
    static let appNamePlaceholder = "{app}"

    var template: ShieldTemplate
    var title: String
    var subtitle: String
    var backgroundStyle: ShieldBackgroundStyle
    var backgroundHex: String
    var appearance: ShieldAppearance
    var textHex: String
    var accentHex: String
    var iconKind: ShieldIconKind
    var iconValue: String
    var primaryButtonLabel: String
    /// Empty hides the secondary button.
    var secondaryButtonLabel: String
    var showsRemainingTime: Bool
    var showsBlockReason: Bool

    static func template(_ template: ShieldTemplate) -> ShieldThemeSnapshot {
        switch template {
        case .minimalist:
            ShieldThemeSnapshot(
                template: .minimalist, title: "Not now.", subtitle: "{app} is paused by FocusGuard.",
                backgroundStyle: .solid, backgroundHex: "#F5F5F7", appearance: .light, textHex: "#1C1C1E",
                accentHex: "#1C1C1E", iconKind: .symbol, iconValue: "circle.slash",
                primaryButtonLabel: "Close", secondaryButtonLabel: "",
                showsRemainingTime: true, showsBlockReason: false
            )
        case .motivational, .custom:
            ShieldThemeSnapshot(
                template: template, title: "Your Future Is More Important.", subtitle: "You chose to focus. Keep your promise.",
                backgroundStyle: .tintedBlur, backgroundHex: "#FF7A45", appearance: .light, textHex: "#2B1300",
                accentHex: "#FF5A1F", iconKind: .emoji, iconValue: "🔥",
                primaryButtonLabel: "Back to my goals", secondaryButtonLabel: "Why am I seeing this?",
                showsRemainingTime: true, showsBlockReason: true
            )
        case .darkFocus:
            ShieldThemeSnapshot(
                template: .darkFocus, title: "Stay Focused.", subtitle: "Take a breath and return to what matters.",
                backgroundStyle: .solid, backgroundHex: "#0B0B12", appearance: .dark, textHex: "#FFFFFF",
                accentHex: "#7B78FF", iconKind: .symbol, iconValue: "moon.stars.fill",
                primaryButtonLabel: "Close", secondaryButtonLabel: "Why is this blocked?",
                showsRemainingTime: true, showsBlockReason: true
            )
        case .productivity:
            ShieldThemeSnapshot(
                template: .productivity, title: "Time to Get Back to Work.", subtitle: "Your goals deserve your attention.",
                backgroundStyle: .solid, backgroundHex: "#EAF3FF", appearance: .light, textHex: "#0A2540",
                accentHex: "#0A84FF", iconKind: .symbol, iconValue: "checklist",
                primaryButtonLabel: "Return to work", secondaryButtonLabel: "Why is this blocked?",
                showsRemainingTime: true, showsBlockReason: true
            )
        }
    }

    static let titleSuggestions = [
        "Stay Focused.",
        "Your Future Is More Important.",
        "Time to Get Back to Work.",
        "You Have Already Reached Your Limit.",
        "Not now, {app}."
    ]

    static let subtitleSuggestions = [
        "You chose to focus. Keep your promise.",
        "Your goals deserve your attention.",
        "Take a breath and return to what matters.",
        "Small choices build big results."
    ]
}
