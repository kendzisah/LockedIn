//
//  SubscriptionService.swift
//  LockedIn
//
//  Ported from `apps/mobile/src/services/SubscriptionService.ts`.
//
//  RevenueCat wrapper. Uses RevenueCat's own anonymous ID (not Supabase) so
//  subscriptions survive app reinstalls. On `configure(apiKey:)`, we eagerly
//  call `restorePurchases()` to sync any active App Store subscription to the
//  current device, covering the reinstall edge case.
//
//  Entitlement key: `Inner_Circle` (do not change — locked by Agent A audit).
//

import Foundation
import RevenueCat
import AppsFlyerLib

/// Singleton wrapper around the RevenueCat SDK.
///
/// The RN code's `SubscriptionService` is an object literal; in Swift we
/// expose this as `SubscriptionService.shared`. All async methods bridge to
/// RevenueCat's callback API via Swift Concurrency.
@MainActor
public final class SubscriptionService {

    // MARK: - Public constants

    /// RevenueCat entitlement identifier that gates `isSubscribed`.
    /// Confirmed by Agent A backend audit. Do NOT change.
    public static let entitlementID = "Inner_Circle"

    // MARK: - Singleton

    public static let shared = SubscriptionService()

    private init() {}

    // MARK: - State

    private var isConfigured = false

    /// `true` once `configure(apiKey:)` has been called (success or failure).
    public var isInitialized: Bool { isConfigured }

    // MARK: - Configuration

    /// Configure the RevenueCat SDK. Idempotent — safe to call repeatedly.
    ///
    /// Mirrors RN `SubscriptionService.initialize()`:
    ///   1. `Purchases.configure(withAPIKey:)`
    ///   2. `Purchases.shared.collectDeviceIdentifiers()` for IDFA/IDFV
    ///   3. set AppsFlyer ID for S2S attribution (wired by coordinator)
    ///   4. `restorePurchases()` to cover reinstalls
    ///
    /// - Parameter apiKey: RevenueCat iOS public API key
    ///   (`REVENUECAT_IOS_API_KEY` xcconfig entry).
    @discardableResult
    public func configure(apiKey: String) async -> Bool {
        if isConfigured { return true }

        #if DEBUG
        Purchases.logLevel = .debug
        #else
        Purchases.logLevel = .info
        #endif

        // Note: `LockedInApp.configureSDKs()` already calls
        // `Purchases.configure(withAPIKey:)` at app startup. This call is
        // idempotent under the RevenueCat SDK — calling again with the same
        // key is a no-op. We re-call here to make the service self-contained
        // (the RN service did its own `Purchases.configure`).
        Purchases.configure(withAPIKey: apiKey)
        isConfigured = true

        // Send device identifiers (IDFA/IDFV) to RevenueCat for attribution.
        Purchases.shared.attribution.collectDeviceIdentifiers()

        // Hook AppsFlyer UID into RevenueCat for S2S attribution. RN does
        // this in SubscriptionService.ts:46. The AppsFlyer SDK exposes the
        // UID synchronously after `start()` runs in the AppDelegate.
        let uid = AppsFlyerLib.shared().getAppsFlyerUID()
        if !uid.isEmpty {
            Purchases.shared.attribution.setAppsflyerID(uid)
        }

        // Restore purchases on launch to cover reinstall / new anonymous-ID
        // scenarios. Best-effort; failure is logged + captured.
        do {
            _ = try await Purchases.shared.restorePurchases()
        } catch {
            let nsError = error as NSError
            AnalyticsService.shared.captureException(error, properties: [
                "context": "subscription_restore_init",
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
            ])
            AnalyticsService.shared.track("subscription_restore_failed", properties: [
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
                "error_message": error.localizedDescription,
            ])
        }

        return true
    }

    // MARK: - Identity

    /// Identify an authenticated user in RevenueCat. Transfers any anonymous
    /// subscription to the authenticated user ID.
    ///
    /// - Parameter uuid: The **Supabase `auth.users.id` UUID** (NOT email,
    ///   NOT RevenueCat ID). This is the link between Supabase user identity
    ///   and RevenueCat.
    /// - Returns: `true` if the resulting customer info has the
    ///   `Inner_Circle` entitlement active.
    @discardableResult
    public func logIn(uuid: String) async -> Bool {
        do {
            let result = try await Purchases.shared.logIn(uuid)
            return Self.hasEntitlement(in: result.customerInfo)
        } catch {
            let nsError = error as NSError
            AnalyticsService.shared.captureException(error, properties: [
                "context": "subscription_login",
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
            ])
            AnalyticsService.shared.track("subscription_login_failed", properties: [
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
                "error_message": error.localizedDescription,
            ])
            return false
        }
    }

    /// Reset RevenueCat to a new anonymous user. Call on sign-out so the next
    /// session gets a fresh customer ID.
    public func logOut() async {
        do {
            _ = try await Purchases.shared.logOut()
        } catch {
            // P2 — error event only, no exception capture per spec.
            let nsError = error as NSError
            AnalyticsService.shared.track("subscription_logout_failed", properties: [
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
                "error_message": error.localizedDescription,
            ])
        }
    }

    // MARK: - Entitlement checks

    /// Returns `true` if the entitlement `Inner_Circle` is active on the given
    /// customer info object.
    public static func hasEntitlement(in info: CustomerInfo?) -> Bool {
        guard let info else { return false }
        return info.entitlements.active[entitlementID] != nil
    }

    /// Convenience: fetch latest customer info and report whether the user has
    /// the `Inner_Circle` entitlement. Mirrors RN `checkSubscription()`.
    public func checkEntitlements() async -> Bool {
        do {
            let info = try await Purchases.shared.customerInfo()
            return Self.hasEntitlement(in: info)
        } catch {
            let nsError = error as NSError
            AnalyticsService.shared.captureException(error, properties: [
                "context": "subscription_entitlement_check",
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
            ])
            AnalyticsService.shared.track("subscription_entitlement_check_failed", properties: [
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
                "error_message": error.localizedDescription,
            ])
            return false
        }
    }

    /// Fetch the current `CustomerInfo` from RevenueCat. Returns `nil` on error.
    public func customerInfo() async -> CustomerInfo? {
        try? await Purchases.shared.customerInfo()
    }

    // MARK: - Offerings

    /// Fetch RevenueCat offerings (packages). Returns `nil` on error.
    public func offerings() async -> Offerings? {
        try? await Purchases.shared.offerings()
    }

    // MARK: - Purchases

    /// Distinguishes a user-cancelled purchase (no error UI) from a genuine
    /// failure (surface an error) and from success.
    public enum PurchaseOutcome: Equatable { case subscribed, cancelled, failed }

    /// Purchase the given package. Returns `true` if the resulting customer
    /// info has the `Inner_Circle` entitlement active.
    @discardableResult
    public func purchase(package: Package) async -> Bool {
        await purchaseOutcome(package: package) == .subscribed
    }

    /// Purchase the given package, reporting whether the user cancelled vs a
    /// real error occurred — used by the custom paywall to avoid flashing an
    /// error banner when the user simply backs out of the App Store sheet.
    @discardableResult
    public func purchaseOutcome(package: Package) async -> PurchaseOutcome {
        do {
            let result = try await Purchases.shared.purchase(package: package)
            if result.userCancelled { return .cancelled }
            return Self.hasEntitlement(in: result.customerInfo) ? .subscribed : .failed
        } catch {
            let nsError = error as NSError
            AnalyticsService.shared.captureException(error, properties: [
                "context": "subscription_purchase",
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
                "package_identifier": package.identifier,
                "product_identifier": package.storeProduct.productIdentifier,
            ])
            AnalyticsService.shared.track("subscription_purchase_failed", properties: [
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
                "error_message": error.localizedDescription,
                "package_identifier": package.identifier,
                "product_identifier": package.storeProduct.productIdentifier,
            ])
            return .failed
        }
    }

    /// Restore previous purchases. Returns `true` if the restored customer
    /// info has the `Inner_Circle` entitlement active. Mirrors RN
    /// `restore()`.
    @discardableResult
    public func restorePurchases() async -> Bool {
        do {
            let info = try await Purchases.shared.restorePurchases()
            return Self.hasEntitlement(in: info)
        } catch {
            let nsError = error as NSError
            AnalyticsService.shared.captureException(error, properties: [
                "context": "subscription_restore_manual",
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
            ])
            AnalyticsService.shared.track("subscription_restore_manual_failed", properties: [
                "revenuecat_error_code": nsError.code,
                "revenuecat_error_domain": nsError.domain,
                "error_message": error.localizedDescription,
            ])
            return false
        }
    }
}
