//
//  SubscriptionState.swift
//  LockedIn
//
//  @Observable state container that mirrors the React Native
//  `SubscriptionProvider` (`apps/mobile/src/features/subscription/SubscriptionProvider.tsx`).
//
//  Owns:
//    • `isSubscribed` — derived from `Inner_Circle` entitlement
//    • `isLoading`   — true until RevenueCat reports its first customer info
//    • `offerings`   — cached fetched RevenueCat offerings (current package)
//
//  Side-effects when the entitlement transitions:
//    • TRIAL → NORMAL → fires PostHog `Subscription Converted`
//    • subscribed → not-subscribed → fires PostHog `Subscription Expired`
//    • showPaywall (after presentation) → fires PostHog `Trial Started` /
//      `Subscription Converted` on conversion.
//
//  NOTE: AppsFlyer subscription events (trial start / conversion / renewal)
//  are deliberately NOT fired client-side. RevenueCat's server-side
//  integration sends `rc_trial_started_event`, `rc_trial_converted_event`,
//  `rc_renewal_event`, etc. with validated revenue — those are the single
//  source of truth for AppsFlyer and ad-network postbacks (Meta). Firing
//  `af_subscribe` / `af_start_trial` here would double-count conversions.
//
//  Persistence: RevenueCat owns its own state. The ONLY thing persisted here
//  is the App Group entitlement mirror (`@lockedin/is_subscribed`, contract
//  C4) written by `setSubscribed(_:)` so out-of-process consumers — the
//  AppIntentsKit gate (Siri / Shortcuts / widget-button starts) and the
//  QuickStart widget — can enforce the Pro gate without RevenueCat access.
//

import Foundation
import Observation
import RevenueCat
import WidgetKit

// MARK: - Subscription state

@MainActor
@Observable
public final class SubscriptionState {

    // MARK: - Public observable state

    public private(set) var isSubscribed: Bool = false
    public private(set) var isLoading: Bool = true
    public private(set) var offerings: Offerings?

    /// The currently-active entitlement (if any). `nil` when not subscribed.
    public private(set) var currentEntitlement: EntitlementInfo?

    // MARK: - Internal cached state for transition detection

    private var lastPeriodType: PeriodType?
    private var previousCustomerInfo: CustomerInfo?
    private var loggedInUserID: String?
    private var listenerTask: Task<Void, Never>?
    private var configured = false

    // MARK: - App Group entitlement mirror (contract C4)

    /// App Group key mirroring `isSubscribed` for out-of-process readers —
    /// AppIntentsKit's `LockInAppGroupGate` (Siri / Shortcuts / widget-button
    /// gating) and the QuickStart widget's timeline. Frozen cross-workstream
    /// string; a missing key reads as NOT subscribed on the consumer side, so
    /// the mirror only ever widens access when an entitlement is actually
    /// active.
    private static let isSubscribedMirrorKey = "@lockedin/is_subscribed"

    /// App Group key mirroring the active entitlement's expiration (epoch ms)
    /// next to the boolean — frozen duplicate of
    /// `LockInAppGroupGate.subscriptionExpiresAtKey`. The boolean alone has no
    /// horizon: it is rewritten only when THIS app re-evaluates the
    /// entitlement, so a lapse while the app stays closed would leave direct
    /// Siri / Shortcuts starts passing on a stale `true` indefinitely. The
    /// gate fails closed once the mirrored expiry (plus grace) is past.
    /// Removed (no horizon) for lifetime entitlements / unknown expiry.
    private static let subscriptionExpiresAtMirrorKey = "@lockedin/subscription_expires_at_ms"

    /// `QuickStartWidget.kind` (LockedInWidgets target) — documented
    /// duplicate; the widget target can't be imported here. Reloaded on
    /// entitlement changes so the widget flips between its interactive
    /// tap-target and non-interactive deep-link layouts without waiting for
    /// its 24h timeline refresh.
    private static let quickStartWidgetKind = "LockedInQuickStartWidget"

    /// SINGLE funnel for every `isSubscribed` assignment. Keeps the App
    /// Group mirror in lockstep with the in-memory flag — a direct
    /// `isSubscribed = ...` write would let Siri / widget gating drift from
    /// what the app shows the user. Add new entitlement paths through here.
    ///
    /// `expiresAt` is the active entitlement's `expirationDate` when known:
    /// it bounds how long the mirrored `true` stays trusted out-of-process
    /// (see `subscriptionExpiresAtMirrorKey`). Pass nil for "no horizon"
    /// (lifetime entitlement, unknown expiry, or `subscribed == false`).
    private func setSubscribed(_ subscribed: Bool, expiresAt: Date?) {
        // Detect "mirror out of sync" BEFORE writing: covers both a real
        // entitlement flip and the first-ever write on installs that predate
        // the mirror (key missing while the user is subscribed).
        let mirrorOutOfSync = (Defaults.appGroup.object(forKey: Self.isSubscribedMirrorKey) as? Bool) != subscribed

        isSubscribed = subscribed
        Defaults.setBool(subscribed, Self.isSubscribedMirrorKey, scope: .appGroup)
        if subscribed, let expiresAt {
            Defaults.setDouble(
                expiresAt.timeIntervalSince1970 * 1000.0,
                Self.subscriptionExpiresAtMirrorKey,
                scope: .appGroup
            )
        } else {
            Defaults.remove(Self.subscriptionExpiresAtMirrorKey, scope: .appGroup)
        }

        // Reload only when the widget-visible state actually changed —
        // WidgetKit budgets reloads, and entitlement re-evaluations happen on
        // every customer-info tick.
        if mirrorOutOfSync {
            WidgetCenter.shared.reloadTimelines(ofKind: Self.quickStartWidgetKind)
        }
    }

    // MARK: - Lifecycle

    public init() {}

    /// Boot the subscription system. Mirrors the RN `init()` effect:
    ///   1. configure RevenueCat
    ///   2. attach customer-info update listener
    ///   3. read initial customer info
    ///
    /// - Parameter apiKey: RevenueCat iOS API key.
    public func bootstrap(apiKey: String) async {
        guard !configured else { return }
        configured = true

        _ = await SubscriptionService.shared.configure(apiKey: apiKey)

        // NOTE: Analytics `identify(...)` runs in `RootView.bootIfNeeded()` once
        // the Supabase user is resolved — that is the canonical identity
        // (Supabase `auth.users.id.uuidString`). We deliberately do NOT call
        // `identify(...)` here with `info.originalAppUserId`: that's the
        // RevenueCat-side id and would diverge from Supabase + admin dashboard
        // identity. The `first_seen` user property is set in RootView with the
        // same gating, so no analytics calls are needed here.

        await refreshOfferings()
        attachListener()

        if let info = await SubscriptionService.shared.customerInfo() {
            previousCustomerInfo = info
            let entitled = SubscriptionService.hasEntitlement(in: info)
            currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]
            setSubscribed(entitled, expiresAt: currentEntitlement?.expirationDate)
            if entitled {
                lastPeriodType = currentEntitlement?.periodType
            }
        }

        isLoading = false
    }

    /// Refresh the offerings cache. Idempotent; called on bootstrap and on
    /// any explicit retry from UI.
    public func refreshOfferings() async {
        offerings = await SubscriptionService.shared.offerings()
    }

    /// Sync RevenueCat identity with Supabase auth state. Call when auth
    /// state changes (anonymous → authenticated or user-id change).
    ///
    /// Mirrors `SubscriptionProvider.tsx:102-114`.
    ///
    /// - Parameter uuid: Supabase `auth.users.id` UUID, or `nil` to skip.
    public func syncAuthIdentity(uuid: String?) async {
        guard configured, !isLoading else { return }
        guard let uuid, loggedInUserID != uuid else { return }
        loggedInUserID = uuid
        let subscribed = await SubscriptionService.shared.logIn(uuid: uuid)
        applyEntitlementTransition(subscribed: subscribed)
    }

    /// Reset RevenueCat identity on logout. Mirrors `SubscriptionProvider.tsx:117-124`.
    public func handleLogout() async {
        loggedInUserID = nil
        await SubscriptionService.shared.logOut()
        setSubscribed(false, expiresAt: nil)
        currentEntitlement = nil
        lastPeriodType = nil
        previousCustomerInfo = nil
    }

    // MARK: - Paywall presentation

    /// Present the RevenueCat paywall. Returns `true` if the user becomes
    /// entitled by the time the paywall is dismissed. Mirrors
    /// `SubscriptionProvider.tsx:134-162`.
    ///
    /// Callers should drive this via `RevenueCatUI`'s SwiftUI presenter on
    /// the screen — this method is the post-dismiss state refresh.
    @discardableResult
    public func refreshAfterPaywall() async -> Bool {
        let wasPreviouslySubscribed = isSubscribed
        guard let info = await SubscriptionService.shared.customerInfo() else {
            return isSubscribed
        }
        let subscribed = SubscriptionService.hasEntitlement(in: info)
        currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]
        setSubscribed(subscribed, expiresAt: currentEntitlement?.expirationDate)

        if subscribed && !wasPreviouslySubscribed {
            let entitlement = currentEntitlement
            let productID = entitlement?.productIdentifier ?? "unknown"

            // PostHog only — AppsFlyer gets these via RevenueCat S2S
            // (rc_trial_started_event / rc_trial_converted_event).
            if entitlement?.periodType == .trial {
                AnalyticsService.shared.track("Trial Started", properties: ["product_id": productID])
            } else {
                AnalyticsService.shared.track("Subscription Converted", properties: [
                    "product_id": productID,
                    "from_trial": false,
                ])
            }
        }
        return subscribed
    }

    /// Restore purchases. Returns `true` on success.
    /// Mirrors `SubscriptionProvider.tsx:164-172`.
    @discardableResult
    public func restorePurchases() async -> Bool {
        let subscribed = await SubscriptionService.shared.restorePurchases()
        if subscribed, let info = await SubscriptionService.shared.customerInfo() {
            currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]
        }
        setSubscribed(subscribed, expiresAt: subscribed ? currentEntitlement?.expirationDate : nil)
        return subscribed
    }

    // MARK: - Custom paywall support

    /// Purchase a specific package (used by the custom `HUDPaywallScreen`).
    /// Reports success / user-cancel / failure so the paywall only surfaces an
    /// error banner for genuine failures. Entitlement-transition analytics
    /// (Trial/Converted/Expired) are emitted by the `customerInfoStream`
    /// listener; the paywall fires `"Subscription Started"` with its source.
    @discardableResult
    public func purchase(package: Package) async -> SubscriptionService.PurchaseOutcome {
        let outcome = await SubscriptionService.shared.purchaseOutcome(package: package)
        if outcome == .subscribed {
            if let info = await SubscriptionService.shared.customerInfo() {
                currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]
            }
            setSubscribed(true, expiresAt: currentEntitlement?.expirationDate)
        }
        return outcome
    }

    /// Trial / introductory-offer eligibility keyed by product identifier.
    /// `true` only when the App Store reports the account as `.eligible` — so
    /// the paywall shows "free trial" copy solely to users who can actually get
    /// it (returning subscribers see the standard price).
    public func introEligibility(productIdentifiers ids: [String]) async -> [String: Bool] {
        guard !ids.isEmpty else { return [:] }
        let result = await Purchases.shared.checkTrialOrIntroDiscountEligibility(productIdentifiers: ids)
        return result.mapValues { $0.status == .eligible }
    }

    /// Present Apple's native offer-code redemption sheet. There is no public
    /// API to pre-fill a typed code, so the App Store collects it; a redeemed
    /// entitlement flows back through the `customerInfoStream` listener, which
    /// flips `isSubscribed` and dismisses the paywall.
    public func presentOfferCodeRedemption() {
        Purchases.shared.presentCodeRedemptionSheet()
    }

    /// Marketing badge configured on the current Offering's dashboard metadata
    /// (e.g. `"60% Off Sale"`). Optional — computed savings are used when absent.
    public var offeringBadge: String? {
        offerings?.current?.metadata["badge"] as? String
    }

    // MARK: - Customer-info listener

    private func attachListener() {
        listenerTask?.cancel()
        listenerTask = Task { [weak self] in
            for await info in Purchases.shared.customerInfoStream {
                await MainActor.run { [weak self] in
                    self?.handle(info: info)
                }
            }
        }
    }

    private func handle(info: CustomerInfo) {
        let wasSubscribed = SubscriptionService.hasEntitlement(in: previousCustomerInfo)
        let entitled = SubscriptionService.hasEntitlement(in: info)
        currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]
        setSubscribed(entitled, expiresAt: currentEntitlement?.expirationDate)

        if entitled {
            let entitlement = currentEntitlement
            let currentPeriod = entitlement?.periodType
            let productID = entitlement?.productIdentifier ?? "unknown"

            // Detect TRIAL → NORMAL conversion. PostHog only — AppsFlyer
            // gets rc_trial_converted_event via RevenueCat S2S.
            if lastPeriodType == .trial, currentPeriod == .normal {
                AnalyticsService.shared.track("Subscription Converted", properties: [
                    "product_id": productID,
                    "from_trial": true,
                ])
            }
            lastPeriodType = currentPeriod
        } else if wasSubscribed && !entitled {
            // Lost entitlement — subscription expired or cancelled.
            let prevEntitlement = previousCustomerInfo?.entitlements.all[SubscriptionService.entitlementID]
            let productID = prevEntitlement?.productIdentifier ?? "unknown"
            let wasTrial = lastPeriodType == .trial
            AnalyticsService.shared.track("Subscription Expired", properties: [
                "product_id": productID,
                "was_trial": wasTrial,
            ])
            lastPeriodType = nil
        }

        previousCustomerInfo = info
    }

    private func applyEntitlementTransition(subscribed: Bool) {
        setSubscribed(subscribed, expiresAt: nil)
        guard subscribed else { return }
        Task { @MainActor [weak self] in
            guard let self else { return }
            if let info = await SubscriptionService.shared.customerInfo() {
                self.currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]
                // Refine the mirror's expiry horizon now the entitlement is
                // known (the synchronous write above had no horizon).
                if self.isSubscribed {
                    self.setSubscribed(true, expiresAt: self.currentEntitlement?.expirationDate)
                }
            }
        }
    }
}
