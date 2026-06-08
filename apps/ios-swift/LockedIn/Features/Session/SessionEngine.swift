//
//  SessionEngine.swift
//  LockedIn — Worker W11 (Session / Lock-In feature)
//
//  Pure logic + timer driver for an active Lock-In session. Mirrors the
//  RN `ExecutionBlockScreen` timer logic but as a UI-agnostic
//  `@Observable` so the screen view can simply bind to `remainingSeconds`
//  and `isComplete`.
//
//  Timing is wall-clock based (matches RN): the engine stores
//  `endTimestamp` and the tick recomputes remaining = end − now. This
//  prevents drift when the app backgrounds or the system goes to sleep.
//
//  Idle-timer disable (`UIApplication.shared.isIdleTimerDisabled`) is
//  driven from `ExecutionBlockScreen.onAppear/onDisappear`, NOT here —
//  the engine has no opinion on screen presentation.
//

import Foundation
import Observation
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

// MARK: - Phase text (mirror engine/SessionEngine.getPhaseText)

public enum SessionPhaseText {
    /// Returns the phase text for the active ExecutionBlock. Mirrors the
    /// RN file `ExecutionBlockScreen.tsx` `PHASE_TEXTS` table (NOT the
    /// `engine/SessionEngine.ts` table — the on-screen text uses the
    /// shorter array in `ExecutionBlockScreen.tsx`).
    public static func text(elapsedSeconds: Int, totalSeconds: Int) -> String {
        let pct: Double = totalSeconds > 0 ? Double(elapsedSeconds) / Double(totalSeconds) : 0
        switch pct {
        case ..<0.2: return "You are now Locked In."
        case ..<0.4: return "Stay Locked In."
        case ..<0.6: return "Execute."
        case ..<0.8: return "No distractions."
        default:     return "Build the standard."
        }
    }
}

// MARK: - Engine

/// Owns the timer / state machine for a single active execution block.
/// One instance per session — recreate when starting a new block.
@MainActor
@Observable
public final class SessionEngine {
    public enum Status: Equatable {
        case idle
        case running
        case completedNaturally       // hit zero
        case endedEarly(actualMinutes: Int) // hold-to-unlock
    }

    public private(set) var status: Status = .idle
    public private(set) var remainingSeconds: Int
    public let totalSeconds: Int
    public let durationMinutes: Int
    public let endTimestamp: Date

    // Internal plumbing — not UI state, so excluded from observation tracking.
    // `Timer` is thread-safe to invalidate from any context; `nonisolated(unsafe)`
    // lets `deinit` (nonisolated by default) clean it up without a main-actor hop.
    @ObservationIgnored private nonisolated(unsafe) var timer: Timer?
    private let onComplete: (Status) -> Void

    // MARK: - Live Activity plumbing (Agent 2)

    /// Throttle the `Activity.update(...)` cadence to once per wall-clock
    /// second even though the engine ticks 4× per second. Live Activities
    /// are budget-throttled by the system; per-tick updates risk hitting
    /// the throttle and dropping renders.
    @ObservationIgnored private var lastLiveActivityUpdateSecond: Int = -1

    /// Type-erased storage for the associated `Activity<...>` reference.
    /// Boxed as `AnyObject` so the parent `SessionEngine` does not need
    /// a top-level `@available(iOS 16.2, *)` constraint — the concrete
    /// type (`LiveActivityHandle`) is iOS-16.2-only and declared in the
    /// availability-gated extension below.
    #if canImport(ActivityKit)
    @ObservationIgnored fileprivate var _liveActivityStorage: AnyObject?
    #endif

    /// - Parameters:
    ///   - durationMinutes: requested block length.
    ///   - resumeEndTimestamp: when non-nil, treat this as a resume from a
    ///     persisted active block (matches `resumeEndTimestamp` route
    ///     param). Otherwise compute `now + duration`.
    ///   - onComplete: fired when the engine resolves (natural finish or
    ///     hold-to-unlock). Called on the main actor.
    public init(
        durationMinutes: Int,
        resumeEndTimestamp: Date? = nil,
        onComplete: @escaping (Status) -> Void
    ) {
        self.durationMinutes = durationMinutes
        self.totalSeconds = durationMinutes * 60
        let end = resumeEndTimestamp ?? Date().addingTimeInterval(TimeInterval(totalSeconds))
        self.endTimestamp = end
        self.remainingSeconds = max(0, Int(ceil(end.timeIntervalSinceNow)))
        self.onComplete = onComplete
    }

    deinit {
        timer?.invalidate()
    }

    // MARK: - Lifecycle

    /// Begin ticking. Idempotent.
    public func start() {
        guard status == .idle else { return }
        status = .running
        scheduleTick()

        // Spin up (or attach to) the Live Activity. Wrapped in an
        // availability gate because ActivityKit is iOS 16.1+ and our
        // own Live Activity views require iOS 16.2 for `containerBackground`.
        if #available(iOS 16.2, *) {
            beginOrAttachLiveActivity()
        }

        // Tell the widget extension a session is now active so the Today /
        // Streak widgets (and any iOS 16.0 fallback for Live Activity)
        // can show a countdown until `currentSessionEndsAtMs`.
        publishWidgetSessionState(active: true)
    }

    /// Snapshot the current state without ticking — used by views that need
    /// to sync after AppState foreground transitions.
    public func sync(now: Date = Date()) {
        let r = max(0, Int(ceil(endTimestamp.timeIntervalSince(now))))
        remainingSeconds = r
        if r <= 0, status == .running {
            finishNaturally()
        }
    }

    /// Hold-to-unlock path. Computes the actual minutes the user ran for and
    /// transitions to `endedEarly`.
    public func endEarly(now: Date = Date()) {
        guard status == .running else { return }
        timer?.invalidate()
        timer = nil

        let elapsedSeconds = totalSeconds - max(0, Int(ceil(endTimestamp.timeIntervalSince(now))))
        let actualMinutes = max(1, Int(ceil(Double(elapsedSeconds) / 60.0)))
        status = .endedEarly(actualMinutes: actualMinutes)

        if #available(iOS 16.2, *) {
            endLiveActivity(reason: "ended_early")
        }
        publishWidgetSessionState(active: false)
        onComplete(status)
    }

    /// External cancel (e.g. forced sign-out / FULL_RESET). Stops ticking
    /// without firing `onComplete`.
    public func cancel() {
        timer?.invalidate()
        timer = nil
        status = .idle

        if #available(iOS 16.2, *) {
            endLiveActivity(reason: "cleanup")
        }
        publishWidgetSessionState(active: false)
    }

    // MARK: - Internals

    private func scheduleTick() {
        timer?.invalidate()
        // 250ms tick matches RN `setInterval(..., 250)`.
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.tick()
            }
        }
    }

    private func tick() {
        let now = Date()
        let r = max(0, Int(ceil(endTimestamp.timeIntervalSince(now))))
        remainingSeconds = r

        // Drive the Live Activity update at 1Hz. The engine ticks at 4Hz
        // but ActivityKit budgets updates aggressively — coalescing here
        // keeps the budget healthy without sacrificing perceived smoothness
        // (timer text is whole-second granularity anyway).
        if #available(iOS 16.2, *) {
            updateLiveActivityIfNeeded(now: now)
        }

        if r <= 0 {
            finishNaturally()
        }
    }

    private func finishNaturally() {
        timer?.invalidate()
        timer = nil
        status = .completedNaturally

        if #available(iOS 16.2, *) {
            endLiveActivity(reason: "natural")
        }
        publishWidgetSessionState(active: false)
        onComplete(status)
    }

    // MARK: - Widget snapshot publishing

    /// Re-publish the App Group `WidgetSnapshot` with `currentSessionEndsAtMs`
    /// either set (session start) or cleared (session end). Reads the current
    /// snapshot to preserve every other field — HomeState owns the streak /
    /// focus counters and we don't want to stomp them here.
    ///
    /// No-ops when no prior snapshot exists yet (the App Group store will be
    /// populated on the next HomeState.persist() pass).
    private func publishWidgetSessionState(active: Bool) {
        guard let prev = WidgetDataPublisher.shared.loadSnapshot() else { return }
        let endsMs: Double? = active ? endTimestamp.timeIntervalSince1970 * 1000.0 : nil
        let snapshot = WidgetSnapshot(
            consecutiveStreak: prev.consecutiveStreak,
            dailyFocusedMinutes: prev.dailyFocusedMinutes,
            dailyGoalMinutes: prev.dailyGoalMinutes,
            dailyGoalMet: prev.dailyGoalMet,
            lifetimeLongestStreak: prev.lifetimeLongestStreak,
            currentSessionEndsAtMs: endsMs,
            rankTierId: prev.rankTierId,
            nextMissionTitle: prev.nextMissionTitle,
            todayMissionsCompleted: prev.todayMissionsCompleted,
            todayMissionsTotal: prev.todayMissionsTotal,
            todayXpEarned: prev.todayXpEarned,
            lifetimeFocusedMinutes: prev.lifetimeFocusedMinutes,
            publishedAtMs: Date().timeIntervalSince1970 * 1000.0
        )
        WidgetDataPublisher.shared.publish(snapshot)
    }
}

// MARK: - Formatting helper

public enum SessionTimeFormatter {
    /// Mirrors `ExecutionBlockScreen.formatTime` — H:MM:SS when ≥ 1h,
    /// MM:SS otherwise.
    public static func format(seconds: Int) -> String {
        let s = max(0, seconds)
        let h = s / 3600
        let m = (s % 3600) / 60
        let sec = s % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, sec)
        } else {
            return String(format: "%d:%02d", m, sec)
        }
    }
}

// `CompletionCopy` is declared canonically by
// `Features/Home/Engine/CompletionCopy.swift`. The Session feature references
// it directly to avoid module-level redeclaration. `SessionCompleteScreen`
// callers below use `CompletionCopy.completionMessage(for: .executionBlock)`
// instead of the legacy `executionBlockMessage()` helper.

// MARK: - Live Activity (Agent 2)

#if canImport(ActivityKit)

@available(iOS 16.2, *)
extension SessionEngine {
    /// Reference-type box around `Activity<SessionActivityAttributes>` so the
    /// non-`@available` `SessionEngine` can store it as `AnyObject`. Boxing
    /// is the cleanest way to escape Swift's availability rules — we
    /// can't put `Activity<...>` directly in a stored property without
    /// hoisting the whole class to iOS 16.2.
    final class LiveActivityHandle {
        let activity: Activity<SessionActivityAttributes>
        init(_ activity: Activity<SessionActivityAttributes>) {
            self.activity = activity
        }
    }

    /// Either request a fresh Activity or attach to an in-flight one that
    /// survived a process restart. The session id stored in the App Group
    /// is the resume signal — if `activeExecutionBlockKey` was set and the
    /// app cold-started, `Activity.activities` will still contain the
    /// matching activity and we can rebind to it instead of stacking a
    /// second one.
    func beginOrAttachLiveActivity() {
        // Build the attributes + content state up front.
        let nowMs = Date().timeIntervalSince1970 * 1000.0
        let startMs = endTimestamp.timeIntervalSince1970 * 1000.0 - Double(totalSeconds) * 1000.0
        let attributes = SessionActivityAttributes(
            startTimestampMs: startMs,
            durationMinutes: durationMinutes,
            userId: nil // userId is sourced from snapshot on the widget side; the engine has no auth ref by design.
        )
        let initial = SessionActivityAttributes.ContentState(
            remainingSeconds: remainingSeconds,
            phaseLabel: SessionPhaseText.text(
                elapsedSeconds: totalSeconds - remainingSeconds,
                totalSeconds: totalSeconds
            ),
            isPaused: false,
            lastTickMs: nowMs,
            endTimestampMs: endTimestamp.timeIntervalSince1970 * 1000.0
        )

        // Resume path: see if there's already an Activity matching the
        // App Group session id (set on the prior fresh-start).
        let existingId = Defaults.appGroup.string(forKey: SharedScreenTime.WidgetKeys.liveActivitySessionId)
        if let existingId, let existing = Activity<SessionActivityAttributes>.activities.first(where: { $0.id == existingId }) {
            self._liveActivityStorage = LiveActivityHandle(existing)
            // Refresh state to the latest tick so the UI doesn't show
            // stale numbers from before the restart.
            let staleDate = Date().addingTimeInterval(Double(remainingSeconds) + 300)
            let content = ActivityContent(state: initial, staleDate: staleDate)
            Task { @MainActor [weak self] in
                await existing.update(content)
                self?.lastLiveActivityUpdateSecond = Int(Date().timeIntervalSince1970)
            }
            return
        }

        // Fresh-start path. `Activity.request` is throwing — wrap with
        // structured error capture per the no-silent-catch rule.
        do {
            let staleDate = Date().addingTimeInterval(Double(remainingSeconds) + 300)
            let content = ActivityContent(state: initial, staleDate: staleDate)
            let activity = try Activity<SessionActivityAttributes>.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
            self._liveActivityStorage = LiveActivityHandle(activity)
            self.lastLiveActivityUpdateSecond = Int(Date().timeIntervalSince1970)

            // Persist the session id so cold-start cleanup can find this
            // activity if the app dies mid-session.
            Defaults.setString(activity.id, SharedScreenTime.WidgetKeys.liveActivitySessionId, scope: .appGroup)

            AnalyticsService.shared.track(
                "live_activity_started",
                properties: ["duration_minutes": durationMinutes]
            )
        } catch {
            AnalyticsService.shared.captureException(error, properties: ["context": "live_activity_start"])
        }
    }

    /// Coalesced state push. Called from the 250ms tick but only forwards
    /// when the integer second changes, capping system traffic at 1Hz.
    func updateLiveActivityIfNeeded(now: Date) {
        guard let handle = self._liveActivityStorage as? LiveActivityHandle else { return }
        let sec = Int(now.timeIntervalSince1970)
        guard sec != lastLiveActivityUpdateSecond else { return }
        lastLiveActivityUpdateSecond = sec

        let nowMs = now.timeIntervalSince1970 * 1000.0
        let state = SessionActivityAttributes.ContentState(
            remainingSeconds: remainingSeconds,
            phaseLabel: SessionPhaseText.text(
                elapsedSeconds: totalSeconds - remainingSeconds,
                totalSeconds: totalSeconds
            ),
            isPaused: false,
            lastTickMs: nowMs,
            endTimestampMs: endTimestamp.timeIntervalSince1970 * 1000.0
        )
        let staleDate = now.addingTimeInterval(Double(remainingSeconds) + 300)
        let content = ActivityContent(state: state, staleDate: staleDate)

        let activity = handle.activity
        Task { @MainActor in
            await activity.update(content)
        }
    }

    /// Post-launch cleanup sweep. Called from `RootView.bootIfNeeded()`.
    ///
    /// If the app was killed mid-session we may have left an
    /// `Activity<SessionActivityAttributes>` running on the Lock Screen.
    /// On the next launch we detect this by checking whether the
    /// App Group `liveActivitySessionId` key is set BUT no
    /// `activeExecutionBlock` exists in storage (the session was either
    /// torn down without clearing the activity id, or the user killed
    /// the app and `ExecutionBlockScreen.handleEngineFinish` never ran).
    ///
    /// In that state we end every live `SessionActivityAttributes`
    /// activity with `.immediate` dismissal and emit a
    /// `live_activity_dismissed` event with `reason: "cleanup"` for
    /// each. Cheap to call — exits early when no activities exist.
    @MainActor
    static func performColdStartLiveActivitySweep() {
        let staleId = Defaults.appGroup.string(forKey: SharedScreenTime.WidgetKeys.liveActivitySessionId)
        let activeBlock = Defaults.codable(
            ActiveExecutionBlock.self,
            SessionState.activeExecutionBlockKey,
            scope: .appGroup
        ) ?? Defaults.codable(
            ActiveExecutionBlock.self,
            SessionState.activeExecutionBlockKey,
            scope: .standard
        )

        // If there's a live execution block, do NOT sweep — the user
        // will land on the resume path and we want the existing
        // Activity to remain visible while we reattach.
        if activeBlock != nil { return }

        // No active block → any Activity left over is orphaned. End
        // every matching activity.
        let activities = Activity<SessionActivityAttributes>.activities
        guard !activities.isEmpty || staleId != nil else { return }

        for activity in activities {
            let captured = activity
            Task { @MainActor in
                await captured.end(nil, dismissalPolicy: .immediate)
            }
            AnalyticsService.shared.track(
                "live_activity_dismissed",
                properties: ["reason": "cleanup"]
            )
        }
        Defaults.remove(SharedScreenTime.WidgetKeys.liveActivitySessionId, scope: .appGroup)
    }

    /// Tear the activity down with `.immediate` dismissal so the Lock
    /// Screen surface disappears the moment the session ends — no idle
    /// banner lingering after `Session Completed`.
    func endLiveActivity(reason: String) {
        guard let handle = self._liveActivityStorage as? LiveActivityHandle else { return }
        let activity = handle.activity
        self._liveActivityStorage = nil
        Defaults.remove(SharedScreenTime.WidgetKeys.liveActivitySessionId, scope: .appGroup)

        Task { @MainActor in
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        AnalyticsService.shared.track(
            "live_activity_dismissed",
            properties: ["reason": reason]
        )
    }
}

#endif
