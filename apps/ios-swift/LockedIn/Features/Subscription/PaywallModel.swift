//
//  PaywallModel.swift
//  LockedIn
//
//  @Observable presentation state for the custom `HUDPaywallScreen`. Loads the
//  current RevenueCat offering, derives per-plan view-models (via
//  `PaywallPricing`), tracks selection + purchase progress, and exposes thin
//  purchase / restore / promo actions. Keeps `HUDPaywallScreen` declarative.
//

import Foundation
import Observation
import RevenueCat

@MainActor
@Observable
public final class PaywallModel {

    public enum LoadState: Equatable {
        case loading   // fetching offerings
        case ready     // ≥1 plan resolved
        case empty     // offering resolved but has no packages
        case failed    // offerings couldn't be fetched
    }

    public private(set) var loadState: LoadState = .loading
    public private(set) var plans: [PlanViewModel] = []
    public var selectedID: String?
    public private(set) var isPurchasing = false
    public var errorMessage: String?

    /// Marketing badge from the Offering metadata (e.g. "60% Off Sale").
    public private(set) var offeringBadge: String?

    public init() {}

    public var selectedPlan: PlanViewModel? {
        plans.first { $0.id == selectedID }
    }

    /// The CTA title for the current selection ("Start Free Trial" when the
    /// selected plan has an eligible free trial, else the context default).
    public func ctaTitle(default fallback: String) -> String {
        PaywallPricing.ctaTitle(for: selectedPlan, default: fallback)
    }

    // MARK: - Loading

    /// Load (or reload) the current offering's packages into plan view-models.
    /// Fetches offerings if the cache is empty, resolves intro eligibility, and
    /// selects the best-value plan by default.
    public func load(state: SubscriptionState) async {
        loadState = .loading
        if state.offerings == nil {
            await state.refreshOfferings()
        }
        guard let packages = state.offerings?.current?.availablePackages, !packages.isEmpty else {
            plans = []
            loadState = (state.offerings == nil) ? .failed : .empty
            return
        }

        let ids = packages.map { $0.storeProduct.productIdentifier }
        let eligibility = await state.introEligibility(productIdentifiers: ids)
        let built = PaywallPricing.buildPlans(packages: packages, eligibility: eligibility)

        offeringBadge = state.offeringBadge
        plans = built
        // Preserve a still-valid selection; otherwise default to best value.
        if selectedID == nil || !built.contains(where: { $0.id == selectedID }) {
            selectedID = built.first(where: { $0.isBestValue })?.id ?? built.first?.id
        }
        loadState = built.isEmpty ? .empty : .ready
    }

    // MARK: - Actions

    /// Purchase a specific package. Returns the raw outcome so callers can tell
    /// a user cancel (→ maybe offer a winback) from a genuine failure. Sets
    /// `errorMessage` only on failure (never on a cancel).
    @discardableResult
    public func purchase(package: Package, state: SubscriptionState) async -> SubscriptionService.PurchaseOutcome {
        guard !isPurchasing else { return .failed }
        isPurchasing = true
        errorMessage = nil
        defer { isPurchasing = false }

        let outcome = await state.purchase(package: package)
        if outcome == .failed {
            errorMessage = "Purchase couldn't be completed. Please try again."
        }
        return outcome
    }

    /// Purchase the currently-selected standard plan.
    @discardableResult
    public func purchaseSelected(state: SubscriptionState) async -> SubscriptionService.PurchaseOutcome {
        guard let plan = selectedPlan else { return .failed }
        return await purchase(package: plan.package, state: state)
    }

    /// Restore previous purchases. Returns `true` if an active subscription was
    /// found. Sets `errorMessage` when nothing is restorable.
    @discardableResult
    public func restore(state: SubscriptionState) async -> Bool {
        guard !isPurchasing else { return false }
        isPurchasing = true
        errorMessage = nil
        defer { isPurchasing = false }

        let ok = await state.restorePurchases()
        if !ok { errorMessage = "No active subscription found to restore." }
        return ok
    }

    /// Launch Apple's native offer-code redemption sheet. Any granted
    /// entitlement arrives via the SubscriptionState listener.
    public func redeemPromo(state: SubscriptionState) {
        state.presentOfferCodeRedemption()
    }

    // MARK: - Winback (downsell)

    /// Dashboard offering identifier for the discounted winback packages.
    public static let winbackOfferingID = "winback"

    public private(set) var winbackPlans: [PlanViewModel] = []

    /// Load the discounted "winback" offering's plans. Returns true when at
    /// least one plan is available (i.e. the downsell can be shown).
    @discardableResult
    public func loadWinback(state: SubscriptionState) async -> Bool {
        guard let packages = state.offerings?.all[Self.winbackOfferingID]?.availablePackages,
              !packages.isEmpty else {
            winbackPlans = []
            return false
        }
        let ids = packages.map { $0.storeProduct.productIdentifier }
        let eligibility = await state.introEligibility(productIdentifiers: ids)
        winbackPlans = PaywallPricing.buildPlans(packages: packages, eligibility: eligibility)
        return !winbackPlans.isEmpty
    }

    /// Headline discount of the winback vs the standard offering — cheapest
    /// per-week of each. `nil` when not computable or the winback isn't cheaper.
    public var winbackDiscountPercent: Int? {
        guard let win = winbackPlans.compactMap(\.perWeekValue).min(),
              let std = plans.compactMap(\.perWeekValue).min(),
              std > 0, win < std else { return nil }
        let pct = Int(((std - win) / std * 100).rounded())
        return pct > 0 ? pct : nil
    }
}
