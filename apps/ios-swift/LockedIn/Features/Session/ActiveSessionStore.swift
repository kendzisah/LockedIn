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

    /// Set by `MainNavigator` — routes a finished session into the shared
    /// `handleSessionFinish` credit fan-out (+ SessionComplete celebration).
    public var onFinish: ((_ actualMinutes: Int, _ wasNatural: Bool) -> Void)?

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
        streak: Int
    ) {
        guard !isActive else { return }
        self.hardcore = hardcore
        self.goal = goal
        self.streak = streak

        let e = SessionEngine(
            durationMinutes: durationMinutes,
            resumeEndTimestamp: resumeEndTimestamp
        ) { [weak self] status in
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
        let endsAt = resumeEndTimestamp
            ?? Date().addingTimeInterval(TimeInterval(durationMinutes * 60))
        NotificationService.shared.scheduleExecutionBlockDone(endsAt: endsAt)
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
        guard let e = engine, e.status == .running, !e.onBreak, canTakeBreak else { return }
        recordBreakTaken()
        e.startBreak(seconds: seconds)
        HapticsService.shared.warning()
        // Lift the shield for the break (tears down the focus DAM schedule so it
        // doesn't auto-unshield at the original end). Re-armed on break end.
        LockModeService.shared.endSession()
        NotificationService.shared.cancelExecutionBlockDone()
        AnalyticsService.shared.track("Session Break Started", properties: [
            "duration_minutes": durationMinutes,
            "break_seconds": seconds,
            "breaks_taken_today": breaksTakenToday,
        ])
    }

    /// End the current break immediately (resume focus now).
    public func endBreakEarly() {
        engine?.endBreakEarly()
    }

    /// Break ended (auto or early) → re-arm the shield + completion notification
    /// for the remaining focus time.
    private func handleBreakEnded(focusRemaining: Int) {
        HapticsService.shared.rigid()
        Task { _ = await LockModeService.shared.beginSession(durationSeconds: focusRemaining) }
        NotificationService.shared.scheduleExecutionBlockDone(
            endsAt: Date().addingTimeInterval(TimeInterval(focusRemaining))
        )
        AnalyticsService.shared.track("Session Break Ended", properties: [
            "duration_minutes": durationMinutes,
            "remaining_seconds": focusRemaining,
        ])
    }

    /// Hold-to-end / cool-down exit.
    public func endEarly() {
        engine?.endEarly()
    }

    // MARK: - Completion

    private func complete(status: SessionEngine.Status) {
        // Capture before tearing down.
        let dur = durationMinutes
        let rem = remainingSeconds
        let cb = onFinish

        HapticsService.shared.success()
        LockModeService.shared.endSession() // un-shield + clear block + hardcore flag
        NotificationService.shared.cancelExecutionBlockDone()
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

        switch status {
        case .completedNaturally:
            cb?(dur, true)
        case .endedEarly(let actualMinutes):
            // RN parity: < 60s elapsed earns nothing.
            let elapsed = (dur * 60) - rem
            if elapsed < 60 { cb?(0, false) } else { cb?(actualMinutes, false) }
        case .idle, .running, .paused:
            break
        }
    }
}
