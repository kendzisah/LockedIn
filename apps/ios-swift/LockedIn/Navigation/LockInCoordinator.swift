//
//  LockInCoordinator.swift
//  LockedIn
//
//  Coordinates the LockIn tab interaction:
//   1. Tap the raised center "Lock In" tab.
//   2. If the user is NOT subscribed → present `PaywallOfferScreen` (modal).
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
    /// Full-screen view of the active manual session (state lives in
    /// `ActiveSessionStore`, so this carries no payload).
    case executionBlock
    case sessionComplete(durationMinutes: Int, streak: Int)
    /// Live view of an in-progress auto-block scheduled session.
    case scheduledLive(occurrenceId: String, durationMinutes: Int, endTimestamp: Date)

    public var id: String {
        switch self {
        case .paywallOffer: return "PaywallOffer"
        case .durationPicker: return "DurationPicker"
        case .executionBlock: return "ExecutionBlock"
        case .sessionComplete: return "SessionComplete"
        case .scheduledLive: return "ScheduledLive"
        }
    }
}

@MainActor
public final class LockInCoordinator: ObservableObject {
    @Published public var activeModal: LockInModal?

    public init() {}

    /// Called when the user taps the raised LockIn tab. Mirrors RN's
    /// `handleLockInPress`. Reads `SubscriptionState` to gate the paywall.
    public func openLockInFlow(isSubscribed: Bool) {
        if isSubscribed {
            activeModal = .durationPicker
        } else {
            activeModal = .paywallOffer
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
