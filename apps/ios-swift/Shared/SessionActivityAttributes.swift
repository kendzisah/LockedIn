//
//  SessionActivityAttributes.swift
//  Shared
//
//  ActivityKit attributes describing a LockedIn focus session. Lives in
//  `Shared/` so it is compiled into BOTH the main app target (which calls
//  `Activity.request(...)` from `SessionEngine`) and the widget extension
//  target (which renders the Live Activity UI via `ActivityConfiguration`).
//
//  Available iOS 16.1+ — the same floor as ActivityKit itself.
//

import Foundation
import ActivityKit

/// Attributes for a single LockedIn session's Live Activity.
///
/// Static (immutable) fields:
///  - `startTimestampMs`: epoch ms when the session started.
///  - `durationMinutes`: total session length, used by views that need to
///    compute progress without tracking it in `ContentState`.
///  - `userId`: Supabase auth user id, if the session was started while
///    signed in. Nil for anonymous sessions.
///
/// Dynamic (`ContentState`) fields update on every tick:
///  - `remainingSeconds`: monotonically-decreasing countdown.
///  - `phaseLabel`: short human label rendered next to the timer (e.g.
///    "Locked in", "Break").
///  - `isPaused`: ticks pause when the user pauses the session.
///  - `lastTickMs`: epoch ms of the last `activity.update(...)` — lets the
///    widget surface a stale indicator if Live Activity throttling delays
///    updates beyond a few seconds.
@available(iOS 16.1, *)
public struct SessionActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var remainingSeconds: Int
        public var phaseLabel: String
        public var isPaused: Bool
        public var lastTickMs: Double
        /// Epoch ms at which the session is scheduled to end. Drives the
        /// `Text(timerInterval:)` self-rendering countdown in the widget —
        /// without this the visible timer freezes the moment the host app
        /// is backgrounded (the engine's 250ms tick pauses, so `.update(...)`
        /// stops firing). With it, iOS keeps the countdown ticking on the
        /// Lock Screen / Dynamic Island for free.
        ///
        /// Optional for backwards-compat with already-running activities
        /// started by an older app version — those fall back to the static
        /// `remainingSeconds` path.
        public var endTimestampMs: Double?

        public init(
            remainingSeconds: Int,
            phaseLabel: String,
            isPaused: Bool,
            lastTickMs: Double,
            endTimestampMs: Double? = nil
        ) {
            self.remainingSeconds = remainingSeconds
            self.phaseLabel = phaseLabel
            self.isPaused = isPaused
            self.lastTickMs = lastTickMs
            self.endTimestampMs = endTimestampMs
        }
    }

    public let startTimestampMs: Double
    public let durationMinutes: Int
    public let userId: String?

    public init(
        startTimestampMs: Double,
        durationMinutes: Int,
        userId: String?
    ) {
        self.startTimestampMs = startTimestampMs
        self.durationMinutes = durationMinutes
        self.userId = userId
    }
}
