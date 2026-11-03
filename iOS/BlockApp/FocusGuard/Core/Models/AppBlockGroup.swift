import Foundation
import SwiftData
@preconcurrency import FamilyControls

@Model
final class AppBlockGroup {
    @Attribute(.unique) var id: UUID
    var name: String
    var categoryRaw: String
    var selectionData: Data
    var isEnabled: Bool
    var createdAt: Date

    init(name: String, category: BlockCategory, selection: FamilyActivitySelection, isEnabled: Bool = true) {
        self.id = UUID()
        self.name = name
        self.categoryRaw = category.rawValue
        self.selectionData = SelectionCoder.encode(selection)
        self.isEnabled = isEnabled
        self.createdAt = .now
    }

    var category: BlockCategory {
        get { BlockCategory(rawValue: categoryRaw) ?? .other }
        set { categoryRaw = newValue.rawValue }
    }

    var selectedApplications: FamilyActivitySelection {
        get { SelectionCoder.decode(selectionData) }
        set { selectionData = SelectionCoder.encode(newValue) }
    }
}
