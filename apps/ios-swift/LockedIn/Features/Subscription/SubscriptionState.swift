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
//    • TRIAL → NORMAL → fires AppsFlyer `af_subscribe` + PostHog `Subscription Converted`
//    • subscribed → not-subscribed → fires PostHog `Subscription Expired`
//    • showPaywall (after presentation) → fires `af_start_trial` / `af_subscribe`
//      and PostHog `Trial Started` / `Subscription Converted` on conversion.
//
//  Persistence: none — RevenueCat owns its own state.
//

import Foundation
import Observation
import RevenueCat

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
            isSubscribed = entitled
            currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]
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
        isSubscribed = false
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
        isSubscribed = subscribed
        currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]

        if subscribed && !wasPreviouslySubscribed {
            let entitlement = currentEntitlement
            let productID = entitlement?.productIdentifier ?? "unknown"

            // Mirrors PaywallOfferScreen.tsx:149/152 + PaywallScreen.tsx:107.
            if entitlement?.periodType == .trial {
                AnalyticsService.shared.trackAppsFlyer("af_start_trial", values: ["af_content_id": productID])
                AnalyticsService.shared.track("Trial Started", properties: ["product_id": productID])
            } else {
                AnalyticsService.shared.trackAppsFlyer("af_subscribe", values: ["af_content_id": productID])
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
        isSubscribed = subscribed
        if subscribed, let info = await SubscriptionService.shared.customerInfo() {
            currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]
        }
        return subscribed
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
        isSubscribed = entitled
        currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]

        if entitled {
            let entitlement = currentEntitlement
            let currentPeriod = entitlement?.periodType
            let productID = entitlement?.productIdentifier ?? "unknown"

            // Detect TRIAL → NORMAL conversion.
            if lastPeriodType == .trial, currentPeriod == .normal {
                AnalyticsService.shared.trackAppsFlyer("af_subscribe", values: ["af_content_id": productID])
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
        isSubscribed = subscribed
        guard subscribed else { return }
        Task { @MainActor [weak self] in
            guard let self else { return }
            if let info = await SubscriptionService.shared.customerInfo() {
                self.currentEntitlement = info.entitlements.active[SubscriptionService.entitlementID]
            }
        }
    }
}
