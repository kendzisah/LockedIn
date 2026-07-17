//
//  LockInAppGroupGate.swift
//  AppIntentsKit
//
//  Self-contained App Group reader for the gating data the intents need in
//  ANY process — Siri / Shortcuts (app process) and interactive widgets
//  (widget-extension process, where `LockInIntentServiceLocator.shared` is
//  nil and none of the main app's services exist).
//
//  Everything here is read/written straight through `UserDefaults(suiteName:)`
//  because this package deliberately has zero dependencies: it cannot see
//  `Shared/SharedScreenTimeConstants.swift` or the app's `Defaults` wrapper,
//  so the suite name and key strings are DOCUMENTED DUPLICATES (frozen
//  cross-workstream contract C4 — change them only in lockstep with the
//  writers listed per key below).
//
//  Gates served:
//   - Subscription: `isSubscribed` mirrors the RevenueCat entitlement
//     (`SubscriptionState.setSubscribed`). Missing key = NOT subscribed —
//     fail-closed, so a fresh install / never-booted app can't start
//     sessions from the widget.
//   - Active session: `isSessionActive(now:)` unions every persisted
//     "a session owns the shield" signal so an intent start can't stomp a
//     running session's block (the pre-fix behavior silently overwrote
//     `@lockedin/active_execution_block` and re-armed the monitor).
//   - Widget → app handoff: `writePendingStart` / `consumePendingStart`
//     park a requested start in the App Group when the intent runs in the
//     widget process (which cannot reach the session machinery), so the
//     foregrounded app can pick it up and run the FULL gate stack again.
//

import Foundation

/// Cross-process gating reads for the LockedIn App Intents. See the file
/// header for the contract; every key string below is a frozen duplicate of
/// the app-side constant it names.
public enum LockInAppGroupGate {

    // MARK: - Suite / keys (contract C4 — frozen strings)

    /// Documented duplicate of `SharedScreenTime.appGroupId` — this package
    /// cannot depend on `Shared/`, and the App Group id must match the
    /// entitlement on the app, widget, and DAM-extension targets.
    public static let appGroupId = "group.com.flocktechnologies.lockedin"

    /// Entitlement mirror written by `SubscriptionState.setSubscribed(_:)`.
    static let isSubscribedKey = "@lockedin/is_subscribed"

    /// Expiry horizon for the entitlement mirror (epoch ms, Double), written
    /// alongside `isSubscribedKey` by `SubscriptionState.setSubscribed`. The
    /// boolean alone has NO horizon: a subscription that lapses while the app
    /// stays closed leaves the mirror `true` indefinitely, and the direct
    /// Siri / Shortcuts start path reads only this gate. Missing key =
    /// no known horizon (lifetime entitlement, or a pre-horizon install) —
    /// the boolean stands alone, matching the old behavior.
    static let subscriptionExpiresAtKey = "@lockedin/subscription_expires_at_ms"

    /// Slack past the mirrored expiry before the gate fails closed. Covers
    /// billing-retry renewals landing slightly after the period end. A renewal
    /// normally refreshes the mirror the next time the app runs — and every
    /// Siri start foregrounds the app (`openAppWhenRun`), so a false refusal
    /// self-heals on the spot.
    static let subscriptionExpiryGraceSeconds: TimeInterval = 72 * 60 * 60

    /// Active manual-session block written by `LockModeService.beginSession`
    /// (duplicate of `SessionState.activeExecutionBlockKey`). JSON payload;
    /// we only care about `endTimestamp` (epoch **milliseconds**).
    static let activeExecutionBlockKey = "@lockedin/active_execution_block"

    /// Persisted mid-break state written by the session core while the
    /// shield is lifted for a break (the execution block alone can be
    /// rewritten around breaks, so this is a separate liveness signal).
    /// JSON payload; we only care about `sessionEndsAtMs` (epoch ms).
    static let activeBreakStateKey = "@lockedin/active_break_state"

    /// Manual-session fail-safe end timestamp (epoch ms, stored as Double) —
    /// duplicate of `SharedScreenTime.Keys.sessionEndTimestamp`. Written by
    /// `ScreenTimeModule`; the DAM extension uses the same "still in the
    /// future ⇒ a session owns the shield" semantic (`manualSessionActive`).
    static let sessionEndTimestampKey = "com.lockedin.screentime.sessionEndTimestamp"

    /// One-shot widget → app start handoff. JSON `PendingStart` payload.
    static let pendingStartKey = "@lockedin/pending_intent_start"

    /// Scheduled auto-block activity map written by `ScheduledLockService`
    /// (duplicate of `SharedScreenTime.Keys.scheduledActivityMap`). JSON
    /// `[activityName: meta]`; we only care about `weekdays` +
    /// `startMinutesOfDay`/`endMinutesOfDay` — enough to tell whether a
    /// scheduled window contains `now`. A LIVE scheduled window persists
    /// none of the manual-session signals above (the extension only applies
    /// the shield; a promoted in-app run deliberately writes no block), so
    /// without this scan an intent start would stack a manual session on
    /// top of it and double-credit the overlapping time.
    static let scheduledActivityMapKey = "@lockedin/scheduled_activity_map"

    // MARK: - Storage

    /// The shared suite, or nil when the entitlement is missing. Every read
    /// below fails CLOSED (not subscribed / no active session / no pending
    /// start) when the suite is unavailable — a misconfigured build should
    /// refuse widget starts, not grant them.
    static var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    // MARK: - Subscription gate

    /// `true` only when the app has mirrored an active entitlement into the
    /// App Group. A missing key reads as `false` (fail-closed) — the mirror
    /// is written on every entitlement evaluation, so "missing" means the
    /// app has never seen a subscription on this install.
    ///
    /// When the writer also mirrored the entitlement's expiration date, the
    /// gate additionally fails once that horizon (plus a grace window) is
    /// past: the boolean is only rewritten when the app re-evaluates the
    /// entitlement, so without the horizon an expired subscriber could keep
    /// starting Pro sessions from Siri / Shortcuts until they next open the
    /// app.
    public static var isSubscribed: Bool {
        guard let defaults = sharedDefaults, defaults.bool(forKey: isSubscribedKey) else {
            return false
        }
        if let expiresAtMs = defaults.object(forKey: subscriptionExpiresAtKey) as? Double {
            let horizon = expiresAtMs / 1000.0 + subscriptionExpiryGraceSeconds
            guard Date().timeIntervalSince1970 <= horizon else { return false }
        }
        return true
    }

    // MARK: - Active-session gate

    /// Lenient partial decode of the persisted execution block — extra
    /// fields in the writer's payload are ignored, and a malformed payload
    /// decodes as nil (treated as "no session") rather than throwing.
    private struct ExecutionBlockEnd: Decodable {
        /// Epoch milliseconds (matches `ActiveExecutionBlock.endTimestamp`).
        let endTimestamp: Double
    }

    /// Lenient partial decode of the persisted break state.
    private struct BreakStateEnd: Decodable {
        /// Fixed post-break session end, epoch milliseconds.
        let sessionEndsAtMs: Double
    }

    /// Lenient partial decode of a scheduled activity's metadata — only the
    /// window fields the liveness check needs. Entries persisted by older
    /// builds (no window times) decode with nils and are treated as not
    /// provably live, matching the extension's own fallback.
    private struct ScheduledWindowMeta: Decodable {
        /// Calendar weekdays (1 = Sun … 7 = Sat); empty/absent = one-off,
        /// pinned to the single date in `occurrenceYMD`.
        let weekdays: [Int]?
        let startMinutesOfDay: Int?
        let endMinutesOfDay: Int?
        /// One-offs only: the concrete `yyyy-MM-dd` local date the single
        /// occurrence is registered for. Empty-weekday entries whose date
        /// isn't TODAY are not live — a stale one-off entry (the map is only
        /// pruned when the app next foregrounds) must not read as "already
        /// locked in" on every later day whose time-of-day matches.
        let occurrenceYMD: String?
    }

    /// `true` while ANY persisted session signal says a lock-in is live:
    /// the manual execution block, the mid-break state, the fail-safe end
    /// timestamp, or a scheduled auto-block window containing `now`. The
    /// first three are end-instant checks (`end > now`), so a stale record
    /// from a crashed session that already expired does not block new
    /// starts.
    public static func isSessionActive(now: Date = Date()) -> Bool {
        activeSessionEndDate(now: now) != nil
    }

    /// The latest known end of the currently-active session, or nil when no
    /// signal is live. Used by `isSessionActive` and by the QuickStart
    /// widget's timeline so it can schedule a refresh right after the
    /// session ends (flipping the widget back to its tap target without
    /// waiting for an app-side reload).
    public static func activeSessionEndDate(now: Date = Date()) -> Date? {
        guard let defaults = sharedDefaults else { return nil }
        let nowMs = now.timeIntervalSince1970 * 1000.0
        var latestEndMs: Double?

        func consider(_ endMs: Double) {
            guard endMs > nowMs else { return }
            latestEndMs = max(latestEndMs ?? endMs, endMs)
        }

        if let data = defaults.data(forKey: activeExecutionBlockKey),
           let block = try? JSONDecoder().decode(ExecutionBlockEnd.self, from: data) {
            consider(block.endTimestamp)
        }
        if let data = defaults.data(forKey: activeBreakStateKey),
           let breakState = try? JSONDecoder().decode(BreakStateEnd.self, from: data) {
            consider(breakState.sessionEndsAtMs)
        }
        if let endMs = defaults.object(forKey: sessionEndTimestampKey) as? Double {
            consider(endMs)
        }
        if let end = liveScheduledWindowEnd(defaults: defaults, now: now) {
            consider(end.timeIntervalSince1970 * 1000.0)
        }

        return latestEndMs.map { Date(timeIntervalSince1970: $0 / 1000.0) }
    }

    /// End of a scheduled auto-block window containing `now`, or nil.
    /// Public so the intent END path can distinguish "no session at all"
    /// from "a live scheduled window owns the shield" — tearing the shield
    /// down for the latter would leave the still-armed scheduled monitor to
    /// mint a full natural-completion credit for a mostly-unshielded window.
    public static func liveScheduledWindowEnd(now: Date = Date()) -> Date? {
        guard let defaults = sharedDefaults else { return nil }
        return liveScheduledWindowEnd(defaults: defaults, now: now)
    }

    /// Mirrors the DAM extension's `anotherScheduledWindowActive` logic:
    /// recurring windows count only on a selected weekday; empty-weekday
    /// entries (one-offs) only on their registered `occurrenceYMD` date;
    /// windows never cross midnight (editor-validated), so same-day instants
    /// are exact. Entries without window times — or date-less one-off
    /// entries — (older builds) can't be proven live and are skipped: when
    /// in doubt the gate prefers allowing a start over a false "already
    /// locked in".
    private static func liveScheduledWindowEnd(defaults: UserDefaults, now: Date) -> Date? {
        guard let data = defaults.data(forKey: scheduledActivityMapKey),
              let map = try? JSONDecoder().decode([String: ScheduledWindowMeta].self, from: data)
        else { return nil }

        let cal = Calendar.current
        for meta in map.values {
            guard let startMin = meta.startMinutesOfDay, let endMin = meta.endMinutesOfDay else { continue }
            if let weekdays = meta.weekdays, !weekdays.isEmpty {
                if !weekdays.contains(cal.component(.weekday, from: now)) { continue }
            } else {
                guard meta.occurrenceYMD == localYMD(now) else { continue }
            }
            guard let start = cal.date(bySettingHour: startMin / 60, minute: startMin % 60, second: 0, of: now),
                  let end = cal.date(bySettingHour: endMin / 60, minute: endMin % 60, second: 0, of: now)
            else { continue }
            if now >= start, now < end { return end }
        }
        return nil
    }

    /// Local-calendar `yyyy-MM-dd`. Documented duplicate of
    /// `ScheduledCompletionRecord.localYMD` (this package cannot depend on
    /// `Shared/`) — must stay format-identical so one-off date pins agree
    /// across processes.
    private static func localYMD(_ date: Date) -> String {
        let c = Calendar.current
        let y = c.component(.year, from: date)
        let m = c.component(.month, from: date)
        let d = c.component(.day, from: date)
        return String(format: "%04d-%02d-%02d", y, m, d)
    }

    // MARK: - Widget → app pending-start handoff

    /// Persisted handoff payload. Epoch-ms request time lets the consumer
    /// drop stale taps (user tapped the widget, never opened the app, then
    /// foregrounded hours later — surprise-starting a session then would be
    /// hostile).
    struct PendingStart: Codable {
        let minutes: Int
        let requestedAtMs: Double
    }

    /// Park a start request for the main app. Called from the widget
    /// process where the session machinery is unreachable; the intent then
    /// asks the OS to foreground the app, and `RootView` consumes this on
    /// the next `.active` scene phase. Last-write-wins on repeated taps —
    /// only one pending start ever exists.
    public static func writePendingStart(minutes: Int) {
        let payload = PendingStart(
            minutes: minutes,
            requestedAtMs: Date().timeIntervalSince1970 * 1000.0
        )
        guard let data = try? JSONEncoder().encode(payload) else { return }
        sharedDefaults?.set(data, forKey: pendingStartKey)
    }

    /// Consume (and always clear) the pending start. Returns the requested
    /// minutes only when the request is fresh — within `maxAgeSeconds` of
    /// being written — and well-formed; everything else returns nil. The key
    /// is removed unconditionally BEFORE validation so a malformed or stale
    /// payload can never be retried on a later foreground.
    ///
    /// The consumer must re-run every start gate (subscription / active
    /// session / Family Controls) — this is a handoff, not an authorization.
    @discardableResult
    public static func consumePendingStart(maxAgeSeconds: TimeInterval = 120) -> Int? {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: pendingStartKey) else { return nil }
        defaults.removeObject(forKey: pendingStartKey)

        guard let pending = try? JSONDecoder().decode(PendingStart.self, from: data) else { return nil }
        let ageSeconds = Date().timeIntervalSince1970 - (pending.requestedAtMs / 1000.0)
        // Negative age means the device clock moved backwards after the
        // write — treat as stale rather than trusting an unbounded future
        // timestamp.
        guard ageSeconds >= 0, ageSeconds <= maxAgeSeconds else { return nil }
        guard pending.minutes >= 1 else { return nil }
        return pending.minutes
    }
}
