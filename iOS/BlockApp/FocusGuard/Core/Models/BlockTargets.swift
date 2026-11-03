import Foundation
@preconcurrency import FamilyControls

/// Rules target any mix of block groups plus individually picked apps. Referencing groups
/// (instead of copying their apps) means editing a group updates every rule that uses it.
protocol BlockTargetsOwner: AnyObject {
    var groupIDs: [UUID] { get set }
    var selectionData: Data { get set }
}

extension BlockTargetsOwner {
    var customSelection: FamilyActivitySelection {
        get { SelectionCoder.decode(selectionData) }
        set { selectionData = SelectionCoder.encode(newValue) }
    }

    func resolvedSelection(groups: [AppBlockGroup]) -> FamilyActivitySelection {
        groups
            .filter { $0.isEnabled && groupIDs.contains($0.id) }
            .reduce(customSelection) { $0.union($1.selectedApplications) }
    }
}

enum SelectionCoder {
    static func encode(_ selection: FamilyActivitySelection) -> Data {
        (try? PropertyListEncoder().encode(selection)) ?? Data()
    }

    static func decode(_ data: Data) -> FamilyActivitySelection {
        guard !data.isEmpty else { return FamilyActivitySelection() }
        return (try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)) ?? FamilyActivitySelection()
    }
}

extension FamilyActivitySelection {
    func union(_ other: FamilyActivitySelection) -> FamilyActivitySelection {
        var result = FamilyActivitySelection()
        result.applicationTokens = applicationTokens.union(other.applicationTokens)
        result.categoryTokens = categoryTokens.union(other.categoryTokens)
        result.webDomainTokens = webDomainTokens.union(other.webDomainTokens)
        return result
    }

    var itemCount: Int { applicationTokens.count + categoryTokens.count + webDomainTokens.count }
    var isEmpty: Bool { itemCount == 0 }

    func intersects(_ other: FamilyActivitySelection) -> Bool {
        !applicationTokens.isDisjoint(with: other.applicationTokens)
            || !categoryTokens.isDisjoint(with: other.categoryTokens)
            || !webDomainTokens.isDisjoint(with: other.webDomainTokens)
    }

    var summary: String {
        var parts: [String] = []
        if !applicationTokens.isEmpty { parts.append("\(applicationTokens.count) app\(applicationTokens.count == 1 ? "" : "s")") }
        if !categoryTokens.isEmpty { parts.append("\(categoryTokens.count) categor\(categoryTokens.count == 1 ? "y" : "ies")") }
        if !webDomainTokens.isEmpty { parts.append("\(webDomainTokens.count) website\(webDomainTokens.count == 1 ? "" : "s")") }
        return parts.isEmpty ? "Nothing selected" : parts.joined(separator: " · ")
    }
}
