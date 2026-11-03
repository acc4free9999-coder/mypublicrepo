import UIKit

extension UIColor {
    convenience init(hex: String, alpha: CGFloat = 1) {
        var value: UInt64 = 0
        let cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        Scanner(string: cleaned).scanHexInt64(&value)
        let r, g, b: CGFloat
        if cleaned.count == 6 {
            r = CGFloat((value >> 16) & 0xFF) / 255
            g = CGFloat((value >> 8) & 0xFF) / 255
            b = CGFloat(value & 0xFF) / 255
        } else {
            r = 0; g = 0; b = 0
        }
        self.init(red: r, green: g, blue: b, alpha: alpha)
    }

    var hexString: String {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        getRed(&r, green: &g, blue: &b, alpha: &a)
        func clamp(_ v: CGFloat) -> Int { Int((min(max(v, 0), 1) * 255).rounded()) }
        return String(format: "#%02X%02X%02X", clamp(r), clamp(g), clamp(b))
    }

    /// Black or white, whichever reads better on this color.
    var contrastingTextColor: UIColor {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        getRed(&r, green: &g, blue: &b, alpha: &a)
        let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        return luminance > 0.6 ? .black : .white
    }
}

/// Resolved UIKit styling for a theme — used by the shield extension and the in-app preview.
struct ShieldStyle {
    let backgroundColor: UIColor?
    let blurStyle: UIBlurEffect.Style?
    let titleColor: UIColor
    let subtitleColor: UIColor
    let accentColor: UIColor
    let buttonTextColor: UIColor

    init(theme: ShieldThemeSnapshot) {
        let blur: UIBlurEffect.Style = switch theme.appearance {
        case .system: .systemMaterial
        case .light: .systemMaterialLight
        case .dark: .systemMaterialDark
        }
        switch theme.backgroundStyle {
        case .solid:
            backgroundColor = UIColor(hex: theme.backgroundHex)
            blurStyle = nil
        case .blur:
            backgroundColor = nil
            blurStyle = blur
        case .tintedBlur:
            backgroundColor = UIColor(hex: theme.backgroundHex, alpha: 0.45)
            blurStyle = blur
        }
        if theme.appearance == .system {
            titleColor = .label
            subtitleColor = .secondaryLabel
        } else {
            titleColor = UIColor(hex: theme.textHex)
            subtitleColor = UIColor(hex: theme.textHex, alpha: 0.72)
        }
        accentColor = UIColor(hex: theme.accentHex)
        buttonTextColor = accentColor.contrastingTextColor
    }
}
