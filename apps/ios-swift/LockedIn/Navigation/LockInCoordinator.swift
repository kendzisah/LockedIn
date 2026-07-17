//
//  LockInCoordinator.swift
//  LockedIn
//
//  Coordinates the LockIn tab interaction:
//   1. Tap the raised center "Lock In" tab.
//   2. If the user is NOT subscribed → present `HUDPaywallScreen` (hard gate).
//      On subscribe, fall through to step 3.
//   3. Present `DurationPickerSheet` (modal).
//   4. On confirm, call `LockModeService.beginSession(durationMinutes:)`,
//      then route to `ExecutionBlockScreen`.
//   5. On finish, route to `SessionCompleteScreen` (handled inside the
//      `MainNavigator` modal sheet flow).
//
//  Mirrors `apps/mobile/src/navigation/MainNavigator.tsx`:
//    handleLockInPress → setShowDurationModal(true) (when subscribed)
//    handleLockInPress → navigation.navigate('PaywallOffer') (when not).
//

import Foundation
import SwiftUI

/// Modal state owned by the MainNavigator. The LockInCoordinator decides
/// which one fires when the tab is tapped, and the navigator presents the
/// matching SwiftUI sheet.
public enum LockInModal: Identifiable, Equatable {
    case paywallOffer
    case durationPicker
    /// Pre-start gate: the session can't actually block anything yet — either
    /// Family Controls auth is missing or the allowlist is empty. Presents
    /// `LockInSetupSheet` with the concrete unmet requirement so the user
    /// fixes it in place instead of "locking in" a session that blocks nothing,
    /// silently.
    case setupRequired(LockInCoordinator.LockInReadiness)
    /// Full-screen view of the active manual session (state lives in
    /// `ActiveSessionStore`, so this carries no payload).
    case executionBlock
    case sessionComplete(durationMinutes: Int, streak: Int)

    public var id: String {
        switch self {
        case .paywallOffer: return "PaywallOffer"
        case .durationPicker: return "DurationPicker"
        // Deliberately payload-independent: swapping auth → app-selection
        // keeps the same identity so the fullScreenCover updates in place
        // instead of dismissing + re-presenting.
        case .setupRequired: return "SetupRequired"
        case .executionBlock: return "ExecutionBlock"
        case .sessionComplete: return "SessionComplete"
        }
    }
}

@MainActor
public final class LockInCoordinator: ObservableObject {

    /// Whether a Lock-In can actually block apps right now. Checked before
    /// every manual start (tab tap + post-paywall + setup-sheet resolution) —
    /// without it, a session started with no Family Controls auth or an empty
    /// allowlist "runs" while blocking nothing, and the user only finds out
    /// when the distraction apps keep opening.
    public enum LockInReadiness: Equatable, Sendable {
        case ready
        /// Family Controls authorization is not `.approved`.
        case needsScreenTimeAuth
        /// Authorized, but the allowlist is empty → `SharedShieldApplier`
        /// treats it as "not configured" and applies NO shield (deliberately —
        /// `.all(except: [])` would lock the whole device).
        case needsAppSelection
    }

    /// Evaluate the pre-start gate. Order matters: auth first (the picker is
    /// useless without it), then a non-empty allowlist —
    /// `getSelectedAppCount()` counts exactly the tokens the shield applier
    /// keys on, so `> 0` ⇔ a shield will actually be applied.
    public static func checkReadiness() -> LockInReadiness {
        guard LockModeService.shared.currentAuthorizationStatus == .approved else {
            return .needsScreenTimeAuth
        }
        guard LockModeService.shared.getSelectedAppCount() > 0 else {
            return .needsAppSelection
        }
        return .ready
    }

    @Published public var activeModal: LockInModal?

    public init() {}

    /// Called when the user taps the raised LockIn tab. Mirrors RN's
    /// `handleLockInPress`. Reads `SubscriptionState` to gate the paywall,
    /// then the Screen-Time readiness gate (auth + non-empty allowlist)
    /// before offering the duration picker.
    public func openLockInFlow(isSubscribed: Bool) {
        guard isSubscribed else {
            activeModal = .paywallOffer
            return
        }
        let readiness = Self.checkReadiness()
        if readiness == .ready {
            activeModal = .durationPicker
        } else {
            AnalyticsService.shared.track("Lock In Setup Required", properties: [
                "reason": readiness == .needsScreenTimeAuth ? "screen_time_auth" : "app_selection",
            ])
            activeModal = .setupRequired(readiness)
        }
    }

    /// Called when the execution block ends. `wasNatural == true` indicates
    /// the timer hit zero; otherwise the user held to end early.
    public func finishSession(durationMinutes: Int, wasNatural: Bool, streak: Int) {
        AnalyticsService.shared.track(
            wasNatural ? "Session Completed" : "Session Abandoned",
            properties: [
                "duration_minutes": durationMinutes,
                "natural": wasNatural,
            ]
        )
        NotificationService.shared.onSessionCompletedToday()

        // Only present the celebration when the user actually completed (or
        // ended after the 60s minimum). The 0-minute case from
        // ExecutionBlockScreen short-circuits back to the tabs.
        if durationMinutes <= 0 {
            activeModal = nil
            return
        }
        activeModal = .sessionComplete(durationMinutes: durationMinutes, streak: streak)
    }

    /// User dismissed the session-complete screen (auto-dismiss or tap).
    public func dismissAll() {
        activeModal = nil
    }
}
