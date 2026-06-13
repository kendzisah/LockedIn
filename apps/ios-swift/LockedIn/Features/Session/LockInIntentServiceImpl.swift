//
//  LockInIntentServiceImpl.swift
//  LockedIn
//
//  Concrete `LockInIntentService` — the bridge between the AppIntents
//  layer (Siri, Shortcuts, interactive widgets via Agent 5) and the
//  main app's session machinery (`LockModeService`, `ScreenTimeModule`,
//  `WidgetDataPublisher`).
//
//  Registered on `LockInIntentServiceLocator.shared` by `LockedInApp`
//  at boot — see `configureSDKs` for the wire-up.
//
//  Design choices:
//   - Read paths go through `WidgetDataPublisher.loadSnapshot()` so we
//     hit the same App Group snapshot the widget extension uses. This
//     means QueryStreak / QueryToday work without the main app being
//     foregrounded (the snapshot survives across cold starts).
//   - Write paths require Family Controls authorization; we throw
//     `IntentServiceError.notAuthorized` if the gate fails so the
//     caller (which has `openAppWhenRun = true`) can surface a useful
//     dialog and the user lands in the app to fix it.
//   - Analytics fires on every entry so we can grade Siri adoption in
//     PostHog under the `intent_invoked` event.
//

import AppIntentsKit
import Foundation

public final class LockInIntentServiceImpl: LockInIntentService, @unchecked Sendable {

    public init() {}

    // MARK: - Mutators

    @MainActor
    public func startSession(durationMinutes: Int) async throws {
        // Family Controls gate. The intent already pre-checked
        // `familyControlsAuthorized` but that lookup races against
        // user-driven revocation; re-check here for safety.
        guard ScreenTimeModule.shared.getAuthorizationStatus() == .approved else {
            throw IntentServiceError.notAuthorized
        }

        // Delegate to LockModeService — same path the in-app flow uses.
        // `beginSession` returns false if DeviceActivityMonitor scheduling
        // fails; we still applied the shield, but the intent should
        // surface that for telemetry purposes.
        let ok = await LockModeService.shared.beginSession(
            durationMinutes: durationMinutes
        )
        if !ok {
            throw IntentServiceError.sessionStartFailed
        }

        AnalyticsService.shared.track(
            "intent_invoked",
            properties: ["intent_name": "start_lock_in"]
        )
    }

    @MainActor
    public func endActiveSession() async throws {
        LockModeService.shared.endSession()
        AnalyticsService.shared.track(
            "intent_invoked",
            properties: ["intent_name": "end_lock_in"]
        )
    }

    // MARK: - Read-only accessors (cross-process safe)

    public func currentStreak() -> Int {
        let snapshot = WidgetDataPublisher.shared.loadSnapshot()
        // `track` is @MainActor — hop the analytics call so the read
        // itself stays nonisolated and Siri-friendly.
        Task { @MainActor in
            AnalyticsService.shared.track(
                "intent_invoked",
                properties: ["intent_name": "query_streak"]
            )
        }
        return snapshot?.consecutiveStreak ?? 0
    }

    public func todayFocusMinutes() -> Int {
        let snapshot = WidgetDataPublisher.shared.loadSnapshot()
        Task { @MainActor in
            AnalyticsService.shared.track(
                "intent_invoked",
                properties: ["intent_name": "query_today_focus"]
            )
        }
        return snapshot?.dailyFocusedMinutes ?? 0
    }

    public var familyControlsAuthorized: Bool {
        ScreenTimeModule.shared.getAuthorizationStatus() == .approved
    }
}

/// Errors raised by the concrete intent service. Internal to the main app —
/// the AppIntent layer translates these into `IntentError` dialogs.
enum IntentServiceError: Error {
    case notAuthorized
    case sessionStartFailed
}
