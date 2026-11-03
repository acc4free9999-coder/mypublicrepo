import ManagedSettings
import ManagedSettingsUI
import UIKit
@preconcurrency import FamilyControls
import FocusGuardKit

/// Supplies the shield's appearance. Apple controls the layout: we can set colors, blur,
/// an icon, title, subtitle and up to two button labels — nothing more.
final class FocusGuardShieldConfiguration: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        make(name: application.localizedDisplayName) { selection in
            application.token.map { selection.applicationTokens.contains($0) } ?? false
        }
    }

    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
        make(name: application.localizedDisplayName) { selection in
            (application.token.map { selection.applicationTokens.contains($0) } ?? false)
                || (category.token.map { selection.categoryTokens.contains($0) } ?? false)
        }
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        make(name: webDomain.domain) { selection in
            webDomain.token.map { selection.webDomainTokens.contains($0) } ?? false
        }
    }

    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
        make(name: webDomain.domain) { selection in
            (webDomain.token.map { selection.webDomainTokens.contains($0) } ?? false)
                || (category.token.map { selection.categoryTokens.contains($0) } ?? false)
        }
    }

    private func make(name: String?, matches: (FamilyActivitySelection) -> Bool) -> ShieldConfiguration {
        let store = SharedStore()
        let configuration = store.loadConfiguration()
        let runtime = store.loadRuntime()
        let now = Date()
        let calendar = Calendar.current
        let theme = configuration.theme
        let style = ShieldStyle(theme: theme)

        let context = EvaluationContext(date: now, calendar: calendar, usage: runtime.usage)
        let reasons = configuration.effectiveRules
            .filter { RuleEvaluator.isActive($0.descriptor, in: context) && matches($0.selection) }
            .sorted { $0.key < $1.key }
            .map { ShieldReasonInfo(rule: $0, at: now, calendar: calendar) }

        let text = ShieldContentBuilder.content(
            theme: theme,
            appName: name,
            reasons: reasons,
            revealReason: (runtime.reasonRevealUntil ?? .distantPast) > now,
            now: now,
            calendar: calendar
        )

        return ShieldConfiguration(
            backgroundBlurStyle: style.blurStyle,
            backgroundColor: style.backgroundColor,
            icon: ShieldIconRenderer.image(kind: theme.iconKind, value: theme.iconValue, tint: style.accentColor),
            title: ShieldConfiguration.Label(text: text.title, color: style.titleColor),
            subtitle: ShieldConfiguration.Label(text: text.subtitle, color: style.subtitleColor),
            primaryButtonLabel: ShieldConfiguration.Label(text: theme.primaryButtonLabel, color: style.buttonTextColor),
            primaryButtonBackgroundColor: style.accentColor,
            secondaryButtonLabel: theme.secondaryButtonLabel.isEmpty
                ? nil
                : ShieldConfiguration.Label(text: theme.secondaryButtonLabel, color: style.accentColor)
        )
    }
}

enum ShieldIconRenderer {
    static func image(kind: ShieldIconKind, value: String, tint: UIColor) -> UIImage? {
        switch kind {
        case .none:
            return nil
        case .symbol:
            let config = UIImage.SymbolConfiguration(pointSize: 56, weight: .semibold)
            return UIImage(systemName: value, withConfiguration: config)?
                .withTintColor(tint, renderingMode: .alwaysOriginal)
        case .emoji:
            let size = CGSize(width: 80, height: 80)
            return UIGraphicsImageRenderer(size: size).image { _ in
                let text = value as NSString
                let attributes: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 64)]
                let textSize = text.size(withAttributes: attributes)
                text.draw(
                    at: CGPoint(x: (size.width - textSize.width) / 2, y: (size.height - textSize.height) / 2),
                    withAttributes: attributes
                )
            }
        }
    }
}
