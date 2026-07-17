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
//   - Write paths are gated defense-in-depth: `StartLockInIntent` already
//     pre-checks subscription + active-session via `LockInAppGroupGate`,
//     but this impl re-runs the same guards because it is ALSO reachable
//     from the pending-start handoff (`RootView`) and any future caller —
//     the intent's pre-check must never be the only gate. Failures throw
//     `IntentServiceError`, which conforms to
//     `CustomLocalizedStringResourceConvertible` so Siri / Shortcuts read
//     a concrete dialog instead of the generic "Something went wrong".
//   - Analytics fires on every successful entry so we can grade Siri
//     adoption in PostHog under the `intent_invoked` event; refusals fire
//     `intent_refused` with a reason so gate friction is visible too.
//

import AppIntentsKit
import Foundation

public final class LockInIntentServiceImpl: LockInIntentService, @unchecked Sendable {

    public init() {}

    // MARK: - Live-engine bridge (Fix 13, contract C5)

    /// Routes an intent-driven "end session" into the LIVE in-app engine.
    /// Wired by `RootView` to `ActiveSessionStore`: returns `true` when a
    /// running engine handled the end (store tears down shield, timers,
    /// notifications, and runs the early-end credit path), `false` when no
    /// engine is live so `endActiveSession()` falls back to a persisted-state
    /// teardown. Without this hook the intent only cleared the shield while
    /// the engine kept counting — crediting a full "natural" completion for
    /// a session the user explicitly killed.
    ///
    /// `@MainActor` on the property keeps reads/writes serialized (the class
    /// itself is `@unchecked Sendable`); it is set once at boot and only read
    /// from `endActiveSession()`, which is main-actor. The closure type is
    /// `@MainActor` too so its body can synchronously touch the main-actor
    /// `ActiveSessionStore`. Throwing: the hook REFUSES (rather than falls
    /// back) for a hardcore session — `IntentServiceError.hardcoreLocked` —
    /// because falling back would tear the persisted state down anyway.
    @MainActor
    public var endActiveSessionHook: (@MainActor () throws -> Bool)?

    /// Reports whether a session is live in THIS process's engine. Wired by
    /// `RootView` to `ActiveSessionStore.isActive`. Complements the App
    /// Group gate: a PROMOTED scheduled session deliberately persists no
    /// manual block/timestamp, and a fresh start's block lands on an async
    /// hop — both invisible to `LockInAppGroupGate` alone.
    @MainActor
    public var isSessionLiveHook: (@MainActor () -> Bool)?

    // MARK: - Mutators

    @MainActor
    public func startSession(durationMinutes: Int) async throws {
        // Subscription gate (defense in depth — the intent pre-checked the
        // same App Group mirror, but this path is also entered from the
        // widget pending-start handoff where nothing has been verified in
        // this process yet). Missing mirror key = not subscribed.
        guard LockInAppGroupGate.isSubscribed else {
            AnalyticsService.shared.track(
                "intent_refused",
                properties: ["intent_name": "start_lock_in", "reason": "not_subscribed"]
            )
            throw IntentServiceError.notSubscribed
        }

        // Active-session gate — starting on top of a live session would
        // overwrite its persisted block and re-arm the monitor mid-run.
        // The App Group gate covers persisted signals (manual block / break
        // state / fail-safe timestamp / live scheduled window); the hook
        // covers this process's in-memory engine, which those signals can't
        // always prove (promoted scheduled sessions persist no block).
        guard !LockInAppGroupGate.isSessionActive(now: Date()),
              isSessionLiveHook?() != true else {
            AnalyticsService.shared.track(
                "intent_refused",
                properties: ["intent_name": "start_lock_in", "reason": "session_active"]
            )
            throw IntentServiceError.sessionAlreadyActive
        }

        // Family Controls gate. The intent already pre-checked
        // `familyControlsAuthorized` but that lookup races against
        // user-driven revocation; re-check here for safety.
        guard ScreenTimeModule.shared.getAuthorizationStatus() == .approved else {
            throw IntentServiceError.notAuthorized
        }

        // Readiness gate (defect #5 parity with the in-app flow): authorized
        // but with an EMPTY allowlist, `SharedShieldApplier.apply`
        // deliberately no-ops — the session would "run" while blocking
        // nothing, silently. Refuse with a concrete fix-it dialog instead.
        guard ScreenTimeModule.shared.getSelectedAppCount() > 0 else {
            AnalyticsService.shared.track(
                "intent_refused",
                properties: ["intent_name": "start_lock_in", "reason": "no_app_selection"]
            )
            throw IntentServiceError.setupRequired
        }

        // Pin the hardcore flag OFF for every externally started session.
        // The key is written only by the in-app duration picker and cleared
        // by `endSession()` / the app-side expired-block sweep — a hardcore
        // session whose process died mid-run (monitor un-shielded it, app
        // never reopened) leaves the key stranded `true`. Without this
        // reset, the fresh Siri/widget session rehydrates as HARDCORE
        // (no breaks, no hold-to-end, end-intent refuses) — a no-exit
        // lockout of a session the user never asked to be hardcore.
        Defaults.setBool(false, SessionState.activeBlockHardcoreKey)

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

        // Contract C4: tell the (foregrounded) app a session just started
        // OUTSIDE the normal in-app flow so the navigator can present the
        // live timer instead of leaving the user on a stale Home screen.
        // Name literal is frozen cross-workstream; the shared constant
        // (declared next to MainNavigator's observer) keeps the two sides
        // from drifting.
        NotificationCenter.default.post(
            name: .lockedInSessionExternallyStarted,
            object: nil,
            userInfo: ["durationMinutes": durationMinutes]
        )

        AnalyticsService.shared.track(
            "intent_invoked",
            properties: ["intent_name": "start_lock_in"]
        )
    }

    @MainActor
    public func endActiveSession() async throws {
        // Prefer the live engine (Fix 13): the store ends the running
        // session through its normal early-end path — engine stops, shield
        // drops, notifications cancel, and the partial credit is computed
        // from actual elapsed time. The hook THROWS `hardcoreLocked` for a
        // live hardcore session — a voice command must not be the one entry
        // point that bypasses "no early exit".
        let handledByEngine: Bool
        do {
            handledByEngine = try endActiveSessionHook?() ?? false
        } catch {
            AnalyticsService.shared.track(
                "intent_refused",
                properties: ["intent_name": "end_lock_in", "reason": "hardcore"]
            )
            throw error
        }

        if handledByEngine {
            // Store owns the full teardown — nothing else to do here.
        } else {
            // Fallback — no live engine in this process (cold start, or the
            // hook isn't wired yet). Hardcore guard first: a persisted
            // hardcore session must survive the voice command too (the
            // in-app UI hides hold-to-end for it; contract of Fix 2).
            let persistedBreak = LockModeService.shared.loadActiveBreakState()
            let hasPersistedSession = LockModeService.shared.loadActiveExecutionBlock() != nil
                || persistedBreak != nil
            // Live SCHEDULED auto-block window: the extension applied the
            // shield and its still-armed monitor records a FULL
            // natural-completion at window end. `endSession()` here would only
            // drop the shield / persisted state (it stops the MANUAL activity,
            // not the scheduled one) — the window would then credit in full
            // for time that ran unshielded, and the per-occurrence "Session
            // Complete" notification would still fire. Refuse instead: the
            // shield stays up, the monitor stays the single owner of the
            // window-end clear, and the credit stays honest. (This also
            // mirrors the START gate, which treats this exact state as an
            // active session — "You're already locked in".)
            //
            // Two ways into this state:
            //  - no persisted manual state at all (a promoted window with the
            //    app since killed), or
            //  - a persisted BREAK belonging to the scheduled occurrence (a
            //    promoted session on a break when the app died). Tearing that
            //    down would clear the break state and stop the break-resume
            //    monitor while the scheduled monitor stays armed — the shield
            //    (already down for the break) never re-applies and the window
            //    still mints a full credit: the break-state door into the same
            //    defect this refusal exists for.
            // A persisted MANUAL block still falls through to the teardown —
            // that session genuinely belongs to the manual machinery.
            let scheduledBreakPersisted = persistedBreak?.scheduledOccurrenceId != nil
            if !hasPersistedSession || scheduledBreakPersisted,
               LockInAppGroupGate.liveScheduledWindowEnd(now: Date()) != nil {
                AnalyticsService.shared.track(
                    "intent_refused",
                    properties: ["intent_name": "end_lock_in", "reason": "scheduled_window"]
                )
                throw IntentServiceError.scheduledWindowActive
            }
            if hasPersistedSession, Defaults.bool(SessionState.activeBlockHardcoreKey) {
                AnalyticsService.shared.track(
                    "intent_refused",
                    properties: ["intent_name": "end_lock_in", "reason": "hardcore"]
                )
                throw IntentServiceError.hardcoreLocked
            }
            // Tear down the persisted state directly so the shield lifts and
            // no stale "session done" / "break over" notification fires for
            // a session that no longer exists.
            LockModeService.shared.endSession()
            NotificationService.shared.cancelExecutionBlockDone()
            NotificationService.shared.cancelBreakEnded()
            // No live engine owns a Live Activity in this process, and the
            // cold-start sweep (if it ran at all on this background launch)
            // executed BEFORE the block was cleared above — it saw the block
            // and bailed. Sweep now: the Dynamic Island countdown hosting the
            // very "End early" button must not keep ticking after the session
            // it shows is gone.
            if #available(iOS 16.2, *) {
                SessionEngine.performColdStartLiveActivitySweep()
            }
        }
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

/// Errors raised by the concrete intent service. Internal to the main app;
/// conforms to `CustomLocalizedStringResourceConvertible` so a throw that
/// escapes an `AppIntent.perform()` surfaces as a concrete Siri / Shortcuts
/// dialog (matching the copy `StartLockInIntent` uses for the same gates)
/// instead of the generic failure banner.
enum IntentServiceError: Error, CustomLocalizedStringResourceConvertible {
    case notAuthorized
    case sessionStartFailed
    /// No active entitlement in the App Group mirror (Pro gate).
    case notSubscribed
    /// A session already owns the shield — refuse rather than overwrite.
    case sessionAlreadyActive
    /// Authorized but the allowlist is empty — the shield would no-op and
    /// the session would silently block nothing (defect #5).
    case setupRequired
    /// Hardcore session — no early exit, by the user's own choice. Voice
    /// commands must not be a bypass (Fix 2's contract).
    case hardcoreLocked
    /// A live scheduled auto-block window owns the shield and there is no
    /// in-app engine to end it through — ending it here would lift the shield
    /// while the scheduled monitor still mints a full-window credit. Open the
    /// app to end it (the promoted timer's hold-to-end credits honestly).
    case scheduledWindowActive

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .notAuthorized:
            return "Open LockedIn to enable Screen Time access first."
        case .sessionStartFailed:
            return "Couldn't start the session. Open LockedIn to try again."
        case .notSubscribed:
            return "LockedIn Pro is required — open LockedIn to subscribe."
        case .sessionAlreadyActive:
            return "You're already locked in."
        case .setupRequired:
            return "Open LockedIn and choose which apps to block first."
        case .hardcoreLocked:
            return "Hardcore mode is on — this session can't be ended early."
        case .scheduledWindowActive:
            return "This is a scheduled lock-in — open LockedIn to end it early."
        }
    }
}
