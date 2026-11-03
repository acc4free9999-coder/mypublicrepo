import SwiftUI

enum Spacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let s: CGFloat = 12
    static let m: CGFloat = 16
    static let l: CGFloat = 20
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

enum Radius {
    static let card: CGFloat = 22
    static let control: CGFloat = 14
    static let chip: CGFloat = 10
}

extension Color {
    static let fgBackground = Color(uiColor: .systemGroupedBackground)
    static let fgCard = Color(uiColor: .secondarySystemGroupedBackground)
    static let fgFill = Color(uiColor: .tertiarySystemFill)
    static let fgSuccess = Color.green
    static let fgWarning = Color.orange
    static let fgDanger = Color.red

    init(hex: String) {
        self.init(uiColor: UIColor(hex: hex))
    }

    var hexString: String { UIColor(self).hexString }
}

extension Font {
    static let fgLargeNumber = Font.system(size: 40, weight: .bold, design: .rounded)
    static let fgNumber = Font.system(.title2, design: .rounded).weight(.bold)
}

extension Animation {
    static let fgSpring = Animation.spring(response: 0.42, dampingFraction: 0.82)
}

enum DurationFormat {
    static func minutes(_ minutes: Int) -> String {
        if minutes < 60 { return "\(minutes) min" }
        let h = minutes / 60, m = minutes % 60
        return m == 0 ? "\(h) h" : "\(h) h \(m) min"
    }

    static func countdown(_ interval: TimeInterval) -> String {
        let total = max(0, Int(interval.rounded(.up)))
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%02d:%02d", m, s)
    }
}
