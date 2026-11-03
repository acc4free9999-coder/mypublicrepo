import Foundation
@preconcurrency import FamilyControls
@preconcurrency import ManagedSettings
import FocusGuardKit

protocol ShieldApplying {
    func apply(_ selection: FamilyActivitySelection, to key: RuleKey)
    func clear(_ key: RuleKey)
}

/// One named `ManagedSettingsStore` per rule. iOS merges all stores, so the effective shield
/// is the union of every active rule and clearing one store can't unblock another rule's apps.
struct ManagedSettingsShieldApplier: ShieldApplying {
    func apply(_ selection: FamilyActivitySelection, to key: RuleKey) {
        let store = ManagedSettingsStore(named: ManagedSettingsStore.Name(rawValue: key.rawValue))
        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
        store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
        store.shield.webDomainCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    }

    func clear(_ key: RuleKey) {
        ManagedSettingsStore(named: ManagedSettingsStore.Name(rawValue: key.rawValue)).clearAllSettings()
    }
}

/// Stateless recomputation of all shields from configuration + runtime facts. Called by the app
/// and by every DeviceActivity callback, so state self-heals after restarts or missed events.
enum ShieldReconciler {
    @discardableResult
    static func reconcile(
        configuration: BlockingConfiguration,
        runtime: inout RuntimeState,
        at date: Date,
        calendar: Calendar,
        applier: any ShieldApplying
    ) -> Set<RuleKey> {
        let rules = configuration.effectiveRules
        let context = EvaluationContext(date: date, calendar: calendar, usage: runtime.usage)
        let active = RuleEvaluator.activeKeys(for: rules.map(\.descriptor), in: context)
        let plan = ShieldPlan.make(
            active: active,
            previouslyApplied: runtime.appliedStores,
            known: Set(configuration.rules.map(\.key))
        )
        for key in plan.storesToClear { applier.clear(key) }
        for rule in rules where plan.storesToApply.contains(rule.key) {
            applier.apply(rule.selection, to: rule.key)
        }
        runtime.appliedStores = active
        runtime.lastReconciledAt = date
        return active
    }
}
