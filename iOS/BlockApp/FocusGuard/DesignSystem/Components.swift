import SwiftUI

struct Card<Content: View>: View {
    var padding: CGFloat = Spacing.m
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.fgCard, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }
}

struct SectionHeader: View {
    let title: String
    var subtitle: String?
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.title3.weight(.semibold))
                if let subtitle {
                    Text(subtitle).font(.footnote).foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action).font(.subheadline.weight(.medium))
            }
        }
        .padding(.horizontal, Spacing.xxs)
    }
}

struct ProgressRing<Label: View>: View {
    let progress: Double
    var lineWidth: CGFloat = 12
    var tint: Color = .accentColor
    @ViewBuilder var label: Label

    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.15), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.001, min(progress, 1)))
                .stroke(
                    AngularGradient(colors: [tint.opacity(0.7), tint], center: .center),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.fgSpring, value: progress)
            label
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue("\(Int(progress * 100)) percent")
    }
}

extension ProgressRing where Label == EmptyView {
    init(progress: Double, lineWidth: CGFloat = 12, tint: Color = .accentColor) {
        self.init(progress: progress, lineWidth: lineWidth, tint: tint) { EmptyView() }
    }
}

struct UsageBar: View {
    let progress: Double
    var tint: Color = .accentColor
    var height: CGFloat = 10

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(tint.opacity(0.15))
                Capsule()
                    .fill(tint.gradient)
                    .frame(width: max(height, proxy.size.width * min(max(progress, 0), 1)))
                    .animation(.fgSpring, value: progress)
            }
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityValue("\(Int(progress * 100)) percent")
    }
}

struct StatTile: View {
    let title: String
    let value: String
    let symbol: String
    var tint: Color = .accentColor

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Image(systemName: symbol)
                    .font(.headline)
                    .foregroundStyle(tint)
                    .frame(width: 34, height: 34)
                    .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: Radius.chip, style: .continuous))
                Text(value)
                    .font(.fgNumber)
                    .contentTransition(.numericText())
                Text(title)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct StatusBadge: View {
    let text: String
    var symbol: String?
    var tint: Color = .accentColor

    var body: some View {
        HStack(spacing: 4) {
            if let symbol { Image(systemName: symbol) }
            Text(text)
        }
        .font(.caption.weight(.semibold))
        .padding(.horizontal, Spacing.xs)
        .padding(.vertical, 4)
        .foregroundStyle(tint)
        .background(tint.opacity(0.14), in: Capsule())
    }
}

struct IconBadge: View {
    let symbol: String
    var tint: Color = .accentColor
    var size: CGFloat = 40

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.45, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(tint.gradient, in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var tint: Color = .accentColor

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.m)
            .foregroundStyle(.white)
            .background(tint.gradient, in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.fgSpring, value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var primary: PrimaryButtonStyle { PrimaryButtonStyle() }
}

struct ChipButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, Spacing.s)
                .padding(.vertical, Spacing.xs)
                .frame(minWidth: 44)
                .foregroundStyle(isSelected ? Color.white : Color.primary)
                .background(
                    isSelected ? AnyShapeStyle(Color.accentColor.gradient) : AnyShapeStyle(Color.fgFill),
                    in: Capsule()
                )
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isSelected)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
