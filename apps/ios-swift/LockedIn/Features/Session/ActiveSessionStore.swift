//
//  ActiveSessionStore.swift
//  LockedIn — Session / Lock-In feature
//
//  Shared owner of the *manual* lock-in session. The timer (`SessionEngine`)
//  used to live inside `ExecutionBlockScreen` and died when the screen was
//  dismissed (minimize) — so the Home tracker couldn't drive pause/break.
//  Lifting it here lets both the full timer screen AND the minimized Home
//  tracker observe one live session and call the same pause/break/end actions.
//
//  Scheduled (auto-block) sessions are NOT owned here — they run on the OS
//  DeviceActivity schedule and have their own short-lived engine.
//

import Foundation
import Observation

@MainActor
@Observable
public final class ActiveSessionStore {

    /// The live engine. Non-nil while a manual session is running or paused.
    public private(set) var engine: SessionEngine?
    public private(set) var hardcore = false
    public private(set) var goal: String?
    public private(set) var streak: Int = 0

    /// True from the instant the engine resolves (set SYNCHRONOUSLY in the
    /// completion closure, BEFORE the deferred `complete()` Task hop) until
    /// `complete()` finishes. The single-credit choke point: while the hop is
    /// in flight, `isActive` is already false and the persisted block still
    /// exists — the synchronous resume/credit paths (`start`,
    /// `resumeActiveExecutionBlockIfNeeded`, `resumeScheduledLiveIfNeeded`)
    /// could otherwise read that limbo state and credit the same session a
    /// second time (or stomp the engine before it finishes tearing down).
    /// Everything that starts or credits a session must bail while this is set.
    public private(set) var isFinishing = false

    /// Non-nil when this session was promoted from a scheduled auto-block
    /// window. Threaded back through `onFinish` so `MainNavigator` can mark the
    /// occurrence credited — deduping the DAM extension's background completion
    /// queue (single-credit guarantee across both paths).
    public private(set) var scheduledOccurrenceId: String?

    /// Set by `MainNavigator` — routes a finished session into the shared
    /// `handleSessionFinish` credit fan-out (+ SessionComplete celebration).
    public var onFinish: ((_ actualMinutes: Int, _ wasNatural: Bool, _ scheduledOccurrenceId: String?) -> Void)?

    /// Set by `MainNavigator` — reports whether this scheduled session's fixed OS
    /// window is still active (`ScheduledSessionsStore.currentActiveOccurrence()`).
    /// Used on a scheduled break-end so we don't re-block apps after the window has
    /// already closed (a break that ran past the boundary). Nil for manual sessions.
    public var isScheduledWindowActive: (() -> Bool)?

    public init() {}

    // MARK: - Derived

    public var isActive: Bool {
        switch engine?.status {
        case .running, .paused: return true
        default: return false
        }
    }
    public var isOnBreak: Bool { engine?.onBreak ?? false }
    public var breakRemainingSeconds: Int { engine?.breakRemainingSeconds ?? 0 }
    public var remainingSeconds: Int { engine?.remainingSeconds ?? 0 }
    public var totalSeconds: Int { engine?.totalSeconds ?? 0 }
    public var durationMinutes: Int { engine?.durationMinutes ?? 0 }
    public var elapsedSeconds: Int { max(0, totalSeconds - remainingSeconds) }
    public var progress: Double {
        totalSeconds > 0 ? min(1.0, Double(elapsedSeconds) / Double(totalSeconds)) : 0
    }

    // MARK: - Daily break budget

    /// Max breaks a user may take per calendar day across all sessions.
    public static let maxBreaksPerDay = 3
    /// Preset break lengths (seconds) offered in the break picker.
    public static let breakOptions: [Int] = [15, 30, 60, 120, 300]

    private static let breaksCountKey = "@lockedin/breaks_today_count"
    private static let breaksDateKey  = "@lockedin/breaks_today_date"

    public var breaksTakenToday: Int {
        guard Defaults.string(Self.breaksDateKey) == SessionDayKey.today() else { return 0 }
        return Defaults.int(Self.breaksCountKey)
    }
    public var breaksRemainingToday: Int { max(0, Self.maxBreaksPerDay - breaksTakenToday) }
    public var canTakeBreak: Bool {
        isActive && !isOnBreak && breaksRemainingToday > 0
    }

    private func recordBreakTaken() {
        let today = SessionDayKey.today()
        let count = (Defaults.string(Self.breaksDateKey) == today) ? Defaults.int(Self.breaksCountKey) : 0
        Defaults.setString(today, Self.breaksDateKey)
        Defaults.setInt(count + 1, Self.breaksCountKey)
    }

    // MARK: - Lifecycle

    /// Start (or resume) a manual session. `resumeEndTimestamp == nil` is a
    /// fresh start (applies the shield); non-nil is a cold-start resume from a
    /// persisted block (shield already up). Idempotent while already active.
    public func start(
        durationMinutes: Int,
        hardcore: Bool,
        resumeEndTimestamp: Date?,
        goal: String?,
        streak: Int,
        scheduledOccurrenceId: String? = nil
    ) {
        guard !isActive else { return }
        // A just-resolved engine is still crediting on a deferred Task hop —
        // starting now would race its teardown (and the resume paths that call
        // `start` could re-credit the limbo block). Callers retry on the next
        // foreground pass, so dropping the call is safe.
        guard !isFinishing else { return }
        self.hardcore = hardcore
        self.goal = goal
        self.streak = streak
        self.scheduledOccurrenceId = scheduledOccurrenceId

        // A scheduled session is hard-bounded by its fixed OS window end (the
        // resume timestamp is the window end) so a break can't extend it past the
        // window; manual sessions are unbounded (`hardEnd == nil`).
        let hardEnd: Date? = (scheduledOccurrenceId != nil) ? resumeEndTimestamp : nil

        let e = SessionEngine(
            durationMinutes: durationMinutes,
            resumeEndTimestamp: resumeEndTimestamp,
            hardEnd: hardEnd
        ) { [weak self] status in
            // Flag the finish SYNCHRONOUSLY, before the Task hop defers the
            // actual crediting: anything else running in this runloop turn
            // (foreground resume sweep, drain) must see the store as
            // finishing, not idle — that gap is the double-credit race.
            self?.isFinishing = true
            // The hop itself stays: `onComplete` fires from inside a SwiftUI
            // view-update cycle (tick → observation), and mutating
            // presentation state synchronously there is undefined behavior.
            Task { @MainActor in self?.complete(status: status) }
        }
        // A break ending (auto at zero, or early) re-arms the shield for the
        // remaining focus time.
        e.onBreakEnded = { [weak self] focusRemaining in
            Task { @MainActor in self?.handleBreakEnded(focusRemaining: focusRemaining) }
        }
        engine = e
        e.start()

        if resumeEndTimestamp == nil {
            // Fresh start → apply the shield + persist the active block.
            Task { _ = await LockModeService.shared.beginSession(durationMinutes: durationMinutes) }
        }
        // Manual sessions get their completion notification here. Scheduled ones
        // are covered by the proactive per-occurrence "Session Complete" notif
        // (`resyncScheduledSessionNotifications`), so skip it to avoid a duplicate.
        if scheduledOccurrenceId == nil {
            let endsAt = resumeEndTimestamp
                ?? Date().addingTimeInterval(TimeInterval(durationMinutes * 60))
            NotificationService.shared.scheduleExecutionBlockDone(endsAt: endsAt)
        }
    }

    /// Re-sync the wall-clock timer after a foreground transition.
    public func syncOnForeground() {
        engine?.sync()
    }

    // MARK: - Pause Protocol (timed break)

    /// Start a timed break of `seconds`. Freezes the focus clock, lifts the
    /// shield, and counts the break down on the Live Activity — auto-resumes at
    /// zero. No-op if the daily break budget is spent or a break is in progress.
    public func startBreak(seconds: Int) {
        // Hardcore = no early exit AND no breaks. The FocusRing / timer screen
        // disable the button, but guard here too so no other entry point can
        // lift the shield mid-hardcore-session.
        guard !hardcore else { return }
        // `seconds > 0` mirrors the engine's own guard — checking it here too
        // keeps `recordBreakTaken()` from burning a daily break on a call the
        // engine would silently drop.
        guard let e = engine, e.status == .running, !e.onBreak, canTakeBreak, seconds > 0 else { return }
        recordBreakTaken()
        e.startBreak(seconds: seconds)
        HapticsService.shared.warning()

        // The engine just computed the FIXED post-break end (`breakEnd +
        // frozenRemaining`, clamped to a scheduled window's hard end) and moved
        // `endTimestamp` to it — the session will resume against that instant
        // no matter what happens to the app during the break.
        guard let breakEnd = e.breakEndsAt else { return } // set by startBreak above
        let fixedEnd = e.endTimestamp

        // Lift the shield WITHOUT tearing the session down: the persisted
        // block + hardcore flag survive the break (an app kill mid-break must
        // resume, not destroy, the session), the block's end is rewritten to
        // the fixed end, an `ActiveBreakState` is persisted for cold-start
        // recovery, and the OS re-applies the shield AT break end via the
        // break-resume DeviceActivity monitor — even if the app never returns.
        LockModeService.shared.beginBreak(
            breakEnd: breakEnd,
            sessionEnd: fixedEnd,
            durationMinutes: durationMinutes,
            hardcore: hardcore,
            scheduledOccurrenceId: scheduledOccurrenceId
        )

        // Manual sessions: re-arm the completion notification for the fixed
        // end NOW (not at break end) so it still fires if the app dies
        // mid-break. Scheduled sessions keep their proactive per-occurrence
        // "Session Complete" notification instead (avoids a duplicate).
        if scheduledOccurrenceId == nil {
            NotificationService.shared.scheduleExecutionBlockDone(endsAt: fixedEnd)
        }

        // The OS re-blocks at break end on its own now, but the user still
        // needs pulling back — schedule the "break over" nudge. Cleared on
        // every in-app break-exit path (`handleBreakEnded` / `complete`).
        NotificationService.shared.scheduleBreakEnded(endsAt: breakEnd)

        AnalyticsService.shared.track("Session Break Started", properties: [
            "duration_minutes": durationMinutes,
            "break_seconds": seconds,
            "breaks_taken_today": breaksTakenToday,
        ])
    }

    /// Cold-start resume of a persisted break (app killed mid-break). Restores
    /// the engine's break countdown against the persisted break end WITHOUT
    /// spending a daily break — it was budgeted when it originally started —
    /// and WITHOUT moving the fixed session end (already baked into the
    /// engine via the resume path's `resumeEndTimestamp`).
    public func resumeBreak(until breakEnd: Date) {
        guard let e = engine, e.status == .running, !e.onBreak else { return }
        e.resumeBreak(until: breakEnd)
        // Defensive re-arm: the nudge scheduled at the original break start
        // normally survives a process kill, but re-arming is idempotent and
        // covers a cleared notification center.
        NotificationService.shared.scheduleBreakEnded(endsAt: breakEnd)
    }

    /// End the current break immediately (resume focus now).
    public func endBreakEarly() {
        engine?.endBreakEarly()
    }

    /// Break ended (auto or early) → re-arm the shield + completion notification
    /// for the remaining focus time.
    private func handleBreakEnded(focusRemaining: Int) {
        HapticsService.shared.rigid()
        // Break is resolving in-app (auto or early) → drop the pending "break over"
        // nudge; the shield re-applies below. Covers auto break-end + endBreakEarly.
        NotificationService.shared.cancelBreakEnded()
        // The break is no longer live — the persisted snapshot must go on every
        // in-app exit path so a later launch can't resurrect a finished break.
        LockModeService.shared.clearActiveBreakState()

        if scheduledOccurrenceId != nil {
            // Scheduled session: the scheduled DeviceActivity monitor is the SINGLE
            // owner of the window-end un-shield. Re-arm the shield WITHOUT
            // `beginSession` — that would register a competing manual monitor +
            // `sessionEndTimestamp`, which makes the scheduled `intervalDidEnd`
            // defer (`manualSessionActive()`) and strand the shield past the window.
            //
            // A scheduled session is bounded by its FIXED OS window. If the window
            // already closed (a break that ran past the boundary), the extension has
            // already un-shielded — don't re-block; complete the session instead.
            //
            // Default to `true` (re-block) when the closure is unset: it's the safe
            // side — the scheduled monitor still owns the real window-end un-shield,
            // so a redundant re-block clears itself, whereas a wrong `false` would
            // prematurely END a live session.
            guard isScheduledWindowActive?() ?? true else {
                engine?.endEarly()
                return
            }
            ScreenTimeModule.shared.shieldApps()
            // Tear down the break-resume monitor (registered under the MANUAL
            // activity name at break start) + its future `sessionEndTimestamp`:
            // the scheduled window's own monitor must stay the SINGLE owner of
            // the window-end un-shield, and a lingering future manual timestamp
            // would make the scheduled `intervalDidEnd` defer and strand the
            // shield past the window. The extension keeps the shield up through
            // the stale stop callback because this window is still active.
            ScreenTimeModule.shared.cancelBreakResume()
        } else {
            // Manual session: re-arm the manual monitor + fail-safe timestamp
            // for the remaining focus time (replacing the break-resume monitor
            // — the module stops the activity name before re-registering),
            // and its completion notification (scheduled sessions use the
            // proactive per-occurrence "Session Complete" notif instead).
            // `focusRemaining` is measured against the fixed post-break end, so
            // this lands within a second of the end armed at break start.
            // `resumeSessionAfterBreak` (NOT `beginSession`) so the persisted
            // block keeps describing the ORIGINAL session — rewriting it to
            // the remainder would under-credit a later kill+expire.
            Task { _ = await LockModeService.shared.resumeSessionAfterBreak(remainingSeconds: focusRemaining) }
            NotificationService.shared.scheduleExecutionBlockDone(
                endsAt: Date().addingTimeInterval(TimeInterval(focusRemaining))
            )
        }

        AnalyticsService.shared.track("Session Break Ended", properties: [
            "duration_minutes": durationMinutes,
            "remaining_seconds": focusRemaining,
        ])
    }

    /// Hold-to-end / cool-down exit.
    public func endEarly() {
        engine?.endEarly()
    }

    /// Logout / account-delete cleanup. Cancels the engine WITHOUT crediting
    /// (`cancel()` never fires `onComplete`, so nothing lands on the
    /// freshly-reset state or the next account) and tears down every session
    /// artifact that could act after sign-out: `endSession()` lifts the
    /// shield, clears the persisted block / break / hardcore keys, removes
    /// the fail-safe timestamp, AND stops the manual-named DeviceActivity
    /// monitor — which is also the break-resume monitor, so a logout taken
    /// mid-break can no longer have the OS re-shield a signed-out user at
    /// break end. Session notifications are cancelled for the same reason
    /// (the bus's blanket `cancelAllNotifications` also runs, but this store
    /// must be safe standalone).
    public func fullReset() {
        engine?.cancel()
        engine = nil
        hardcore = false
        goal = nil
        streak = 0
        scheduledOccurrenceId = nil
        isFinishing = false
        LockModeService.shared.endSession()
        NotificationService.shared.cancelExecutionBlockDone()
        NotificationService.shared.cancelBreakEnded()
    }

    // MARK: - Completion

    private func complete(status: SessionEngine.Status) {
        // `isFinishing` was set synchronously when the engine resolved; it
        // covers the whole teardown + credit fan-out below. Cleared LAST so a
        // re-entrant resume triggered by anything in between still bails.
        defer { isFinishing = false }

        // Capture before tearing down.
        let dur = durationMinutes
        let rem = remainingSeconds
        let cb = onFinish
        let occ = scheduledOccurrenceId

        HapticsService.shared.success()
        LockModeService.shared.endSession() // un-shield + clear block/break state + hardcore flag
        NotificationService.shared.cancelExecutionBlockDone()
        // A session can complete while on a break (e.g. hold-to-end, or a scheduled
        // window closing mid-break) — clear any pending "break over" nudge.
        NotificationService.shared.cancelBreakEnded()
        NotificationService.shared.onSessionCompletedToday()

        let isNatural: Bool = {
            if case .completedNaturally = status { return true }
            return false
        }()
        AnalyticsService.shared.track(
            isNatural ? "Session Completed" : "Session Abandoned",
            properties: ["duration_minutes": dur]
        )

        engine = nil
        hardcore = false
        goal = nil
        scheduledOccurrenceId = nil

        switch status {
        case .completedNaturally:
            cb?(dur, true, occ)
        case .endedEarly(let actualMinutes):
            // RN parity: < 60s elapsed earns nothing.
            let elapsed = (dur * 60) - rem
            if elapsed < 60 { cb?(0, false, occ) } else { cb?(actualMinutes, false, occ) }
        case .idle, .running, .paused:
            break
        }
    }
}
