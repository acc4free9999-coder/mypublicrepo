import SwiftUI

enum BlockCategory: String, Codable, CaseIterable, Identifiable {
    case socialMedia, entertainment, games, productivity, other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .socialMedia: "Social Media"
        case .entertainment: "Entertainment"
        case .games: "Games"
        case .productivity: "Productivity"
        case .other: "Other"
        }
    }

    var symbol: String {
        switch self {
        case .socialMedia: "bubble.left.and.bubble.right.fill"
        case .entertainment: "play.rectangle.fill"
        case .games: "gamecontroller.fill"
        case .productivity: "briefcase.fill"
        case .other: "square.grid.2x2.fill"
        }
    }

    var tint: Color {
        switch self {
        case .socialMedia: .pink
        case .entertainment: .purple
        case .games: .orange
        case .productivity: .blue
        case .other: .teal
        }
    }
}
