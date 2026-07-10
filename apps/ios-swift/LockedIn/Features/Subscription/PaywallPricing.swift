//
//  PaywallPricing.swift
//  LockedIn
//
//  Pure (no-SwiftUI) derivation of what the custom `HUDPaywallScreen` renders
//  for each RevenueCat `Package`. Kept separate so the pricing/savings/intro
//  logic is unit-testable and the View stays declarative.
//
//  Currency-safety: every price string comes from StoreKit already localized to
//  the user's storefront currency (`localizedPriceString`,
//  `localizedPricePerWeek`). Savings is a ratio of two same-currency decimals,
//  so it is correct in every region without any manual formatting or hardcoded
//  symbols. We never build a price string ourselves.
//

import Foundation
import RevenueCat

/// Introductory-offer presentation for a plan (only surfaced when the account
/// is actually eligible — returning subscribers see the standard price).
public struct IntroInfo: Equatable {
    /// Short badge, e.g. `"7-DAY FREE TRIAL"` or `"INTRO $2.99"`.
    public let badge: String
    /// Secondary line, e.g. `"then $34.99 / year"`.
    public let detail: String
    /// Free-trial offers flip the CTA to "Start free trial".
    public let isFreeTrial: Bool
}

/// Everything the paywall needs to draw one plan row + the shared footer/CTA.
public struct PlanViewModel: Identifiable, Equatable {
    public let id: String              // package.identifier
    public let package: Package
    public let productIdentifier: String
    public let title: String           // "Annual" / "Monthly" / "Weekly" / "Lifetime"
    public let perWeekText: String     // "$0.67" (localized) — paired with "per week"
    public let perWeekValue: Double?   // raw per-week amount (for cross-offering discount math)
    public let hasPerWeek: Bool        // false for lifetime / non-recurring
    public let savingsPercent: Int?    // computed vs the shortest-cadence plan (shown as a SAVE badge)
    public let isBestValue: Bool
    public let billedTerms: String     // "Billed $34.99 per year"
    public let intro: IntroInfo?

    // Compare every displayed field (Package itself isn't Equatable, so its
    // productIdentifier stands in). An incomplete `==` would let SwiftUI skip
    // re-rendering a row after a price/currency refresh that leaves id/savings
    // unchanged but changes the shown price.
    public static func == (lhs: PlanViewModel, rhs: PlanViewModel) -> Bool {
        lhs.id == rhs.id
            && lhs.productIdentifier == rhs.productIdentifier
            && lhs.title == rhs.title
            && lhs.perWeekText == rhs.perWeekText
            && lhs.perWeekValue == rhs.perWeekValue
            && lhs.hasPerWeek == rhs.hasPerWeek
            && lhs.savingsPercent == rhs.savingsPercent
            && lhs.isBestValue == rhs.isBestValue
            && lhs.billedTerms == rhs.billedTerms
            && lhs.intro == rhs.intro
    }
}

public enum PaywallPricing {

    /// Build the ordered plan view-models for a set of packages.
    ///
    /// - Parameters:
    ///   - packages: `offering.availablePackages` (1–3 in practice).
    ///   - eligibility: productID → intro-offer eligible (from
    ///     `SubscriptionState.introEligibility`).
    /// - Returns: plans sorted longest-period first (best value leads), with the
    ///   max-savings plan flagged `isBestValue`.
    public static func buildPlans(
        packages: [Package],
        eligibility: [String: Bool]
    ) -> [PlanViewModel] {
        // Longest billing period first so the best-value plan leads the list.
        let sorted = packages.sorted { approxWeeks($0) > approxWeeks($1) }

        // Anchor = the most expensive per-week price (the shortest-cadence
        // plan). Used only to compute each plan's honest savings-vs-anchor % —
        // NOT shown as a struck-through "was" price (a fabricated reference
        // price risks App Review rejection under the accurate-metadata rules).
        let anchorPerWeek = sorted.compactMap { $0.storeProduct.pricePerWeek?.doubleValue }.max()

        // Precompute savings so we can pick the single best-value plan.
        let savings: [String: Int] = Dictionary(uniqueKeysWithValues: sorted.compactMap { pkg in
            guard sorted.count > 1,
                  let anchor = anchorPerWeek, anchor > 0,
                  let mine = pkg.storeProduct.pricePerWeek?.doubleValue,
                  mine < anchor else { return nil }
            let pct = Int(((anchor - mine) / anchor * 100).rounded())
            return pct > 0 ? (pkg.identifier, pct) : nil
        })
        // Pick the best-value plan from the ORDERED array (not `savings.max`,
        // which iterates an unordered Dictionary and breaks ties unstably).
        // Strict `>` keeps the first — i.e. longest-period — plan on ties.
        var bestID: String?
        var bestPct = 0
        for pkg in sorted {
            if let pct = savings[pkg.identifier], pct > bestPct {
                bestPct = pct
                bestID = pkg.identifier
            }
        }

        return sorted.map { pkg in
            let product = pkg.storeProduct
            let pct = savings[pkg.identifier]
            return PlanViewModel(
                id: pkg.identifier,
                package: pkg,
                productIdentifier: product.productIdentifier,
                title: planTitle(period: product.subscriptionPeriod, type: pkg.packageType),
                perWeekText: product.localizedPricePerWeek ?? product.localizedPriceString,
                perWeekValue: product.pricePerWeek?.doubleValue,
                hasPerWeek: product.localizedPricePerWeek != nil,
                savingsPercent: pct,
                isBestValue: pkg.identifier == bestID,
                billedTerms: billedTerms(product: product),
                intro: introInfo(product: product, eligible: eligibility[product.productIdentifier] ?? false)
            )
        }
    }

    /// The CTA title for the currently-selected plan. Free-trial-eligible plans
    /// invite the trial; everything else uses the context default.
    public static func ctaTitle(for plan: PlanViewModel?, default fallback: String) -> String {
        if let intro = plan?.intro, intro.isFreeTrial { return "Start Free Trial" }
        return fallback
    }

    // MARK: - Helpers

    /// Approximate length of a billing period in weeks, for sorting. A `nil`
    /// period (lifetime / non-recurring) sorts as the longest.
    static func approxWeeks(_ package: Package) -> Double {
        guard let p = package.storeProduct.subscriptionPeriod else { return .greatestFiniteMagnitude }
        let v = Double(p.value)
        switch p.unit {
        case .day:   return v / 7.0
        case .week:  return v
        case .month: return v * 4.345
        case .year:  return v * 52.143
        @unknown default: return v
        }
    }

    static func planTitle(period: SubscriptionPeriod?, type: PackageType) -> String {
        // Prefer a clean label from the RevenueCat package type; fall back to the
        // raw StoreKit period for custom packages.
        switch type {
        case .annual:     return "Annual"
        case .sixMonth:   return "6 Months"
        case .threeMonth: return "3 Months"
        case .twoMonth:   return "2 Months"
        case .monthly:    return "Monthly"
        case .weekly:     return "Weekly"
        case .lifetime:   return "Lifetime"
        default: break
        }
        guard let p = period else { return "Lifetime" }
        let plural = p.value > 1
        switch p.unit {
        case .day:   return plural ? "\(p.value) Days"   : "Daily"
        case .week:  return plural ? "\(p.value) Weeks"  : "Weekly"
        case .month: return plural ? "\(p.value) Months" : "Monthly"
        case .year:  return plural ? "\(p.value) Years"  : "Annual"
        @unknown default: return "Subscription"
        }
    }

    /// Singular period noun for billed-terms copy: "year" / "month" / "week".
    static func periodNoun(_ period: SubscriptionPeriod?) -> String {
        guard let p = period else { return "once" }
        switch p.unit {
        case .day:   return p.value > 1 ? "\(p.value) days"   : "day"
        case .week:  return p.value > 1 ? "\(p.value) weeks"  : "week"
        case .month: return p.value > 1 ? "\(p.value) months" : "month"
        case .year:  return p.value > 1 ? "\(p.value) years"  : "year"
        @unknown default: return "period"
        }
    }

    static func billedTerms(product: StoreProduct) -> String {
        guard product.subscriptionPeriod != nil else {
            return "One-time \(product.localizedPriceString)"
        }
        return "Billed \(product.localizedPriceString) per \(periodNoun(product.subscriptionPeriod))"
    }

    static func introInfo(product: StoreProduct, eligible: Bool) -> IntroInfo? {
        guard eligible, let discount = product.introductoryDiscount else { return nil }
        let span = introSpan(discount)
        let thenLine = "then \(product.localizedPriceString) / \(periodNoun(product.subscriptionPeriod))"
        switch discount.paymentMode {
        case .freeTrial:
            return IntroInfo(badge: "\(span) FREE TRIAL".uppercased(), detail: thenLine, isFreeTrial: true)
        case .payUpFront, .payAsYouGo:
            return IntroInfo(badge: "INTRO \(discount.localizedPriceString)", detail: thenLine, isFreeTrial: false)
        @unknown default:
            return nil
        }
    }

    /// Human span of an intro offer, e.g. "7-day", "2-week", "1-month".
    static func introSpan(_ discount: StoreProductDiscount) -> String {
        let p = discount.subscriptionPeriod
        let total = p.value * max(discount.numberOfPeriods, 1)
        let unit: String
        switch p.unit {
        case .day:   unit = "day"
        case .week:  unit = "week"
        case .month: unit = "month"
        case .year:  unit = "year"
        @unknown default: unit = "day"
        }
        return "\(total)-\(unit)"
    }
}
