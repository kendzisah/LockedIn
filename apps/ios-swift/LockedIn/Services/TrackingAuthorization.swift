//
//  TrackingAuthorization.swift
//  LockedIn
//
//  App Tracking Transparency (ATT) opt-in. Presents Apple's system tracking
//  prompt and, once the user responds, forwards IDFA/IDFV to RevenueCat for
//  attribution.
//
//  Mirrors the RN app (`apps/mobile/src/app/App.tsx`), which after the splash
//  hides calls `requestTrackingPermissionsAsync()` and then
//  `Purchases.collectDeviceIdentifiers()`. AppsFlyer is told to defer its first
//  attribution send until this prompt resolves via
//  `waitForATTUserAuthorization(timeoutInterval:)` in
//  `LockedInApp.configureSDKs()`.
//

import AppTrackingTransparency
import RevenueCat
import UIKit

/// Presents the iOS App Tracking Transparency prompt exactly once per launch.
@MainActor
enum TrackingAuthorization {
    private static var didRequest = false

    /// Show the ATT opt-in prompt if the user hasn't decided yet, then hand the
    /// resolved device identifiers to RevenueCat.
    ///
    /// iOS only presents the prompt while the app is foreground-`.active` — a
    /// request issued during the cold-launch transition (scene still
    /// `.inactive`) is silently dropped and returns `.notDetermined` with no
    /// UI. So we wait for the active state before asking. Idempotent.
    static func requestIfNeeded() async {
        guard !didRequest else { return }

        // Nothing to do once the user has already decided — avoid consuming the
        // one-shot guard so a future call can still run if this fires early.
        guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else {
            didRequest = true
            return
        }

        // Wait until the scene is actually active, or bail if it never becomes
        // active (e.g. launched into the background) — the prompt can't show then.
        guard await waitUntilActive() else { return }

        didRequest = true

        _ = await requestAuthorization()

        // Whatever the user chose, forward identifiers to RevenueCat. If the
        // user denied tracking, iOS zeroes the IDFA and RevenueCat still gets
        // the IDFV. AppsFlyer picks up the resolved status via
        // `waitForATTUserAuthorization`. Guard on `isConfigured` — touching
        // `Purchases.shared` before configuration traps.
        if Purchases.isConfigured {
            Purchases.shared.attribution.collectDeviceIdentifiers()
        }
    }

    /// Poll for the foreground-active state, up to ~5s. Returns `true` once the
    /// app is active, `false` if it never reached active within the window.
    private static func waitUntilActive() async -> Bool {
        for _ in 0..<50 {
            if UIApplication.shared.applicationState == .active { return true }
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }
        return UIApplication.shared.applicationState == .active
    }

    /// `async` bridge over the completion-handler ATT API.
    private static func requestAuthorization() async -> ATTrackingManager.AuthorizationStatus {
        await withCheckedContinuation { continuation in
            ATTrackingManager.requestTrackingAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }
}
