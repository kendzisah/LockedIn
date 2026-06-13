import Foundation
import Observation
import DesignKit

// MARK: - Persisted shape

/// Persisted-only subset of `SessionState`. Stored as JSON at
/// `@lockedin/session_state` in `Defaults.standard`.
///
/// Matches `PersistedSessionState` in
/// `apps/mobile/src/features/home/state/types.ts`. Optionals exist to absorb
/// older shapes (`startDayKey`, `completedDayKeys`, etc.) on first decode —
/// `HomeState.hydrate(...)` collapses them down to the current shape.
public struct PersistedSessionState: Codable, Equatable, Sendable {
    public var programStartDate: String?
    public var maxCompletedDay: Int?
    public var lastSessionDayKey: String?
    public var consecutiveStreak: Int

    public var lifetimeTotalMinutes: Int?
    public var lifetimeLongestStreak: Int?
    public var lifetimeRunsCompleted: Int?

    public var lifetimeExecutionBlocks: Int?
    public var lifetimeExecutionMinutes: Int?

    public var lastLockInCompletedDate: String?

    public var dailyFocusedMinutes: Int?
    public var dailyFocusDate: String?
    public var dailyGoalMetDate: String?
    public var weekCompletedDays: [String]?

    /// FOC XP already credited today — backs the unified per-stat XP daily
    /// cap (180 XP / 3 hrs). Reset implicitly when `dailyFocusXpDate` rolls.
    public var dailyFocusXpAwarded: Int?
    public var dailyFocusXpDate: String?

    // Legacy migration fields
    public var startDayKey: String?
    public var completedDayKeys: [String]?
    public var longestStreak: Int?
    public var totalMinutes: Int?

    public init(
        programStartDate: String? = nil,
        maxCompletedDay: Int? = nil,
        lastSessionDayKey: String? = nil,
        consecutiveStreak: Int = 0,
        lifetimeTotalMinutes: Int? = nil,
        lifetimeLongestStreak: Int? = nil,
        lifetimeRunsCompleted: Int? = nil,
        lifetimeExecutionBlocks: Int? = nil,
        lifetimeExecutionMinutes: Int? = nil,
        lastLockInCompletedDate: String? = nil,
        dailyFocusedMinutes: Int? = nil,
        dailyFocusDate: String? = nil,
        dailyGoalMetDate: String? = nil,
        weekCompletedDays: [String]? = nil,
        dailyFocusXpAwarded: Int? = nil,
        dailyFocusXpDate: String? = nil
    ) {
        self.programStartDate = programStartDate
        self.maxCompletedDay = maxCompletedDay
        self.lastSessionDayKey = lastSessionDayKey
        self.consecutiveStreak = consecutiveStreak
        self.lifetimeTotalMinutes = lifetimeTotalMinutes
        self.lifetimeLongestStreak = lifetimeLongestStreak
        self.lifetimeRunsCompleted = lifetimeRunsCompleted
        self.lifetimeExecutionBlocks = lifetimeExecutionBlocks
        self.lifetimeExecutionMinutes = lifetimeExecutionMinutes
        self.lastLockInCompletedDate = lastLockInCompletedDate
        self.dailyFocusedMinutes = dailyFocusedMinutes
        self.dailyFocusDate = dailyFocusDate
        self.dailyGoalMetDate = dailyGoalMetDate
        self.weekCompletedDays = weekCompletedDays
        self.dailyFocusXpAwarded = dailyFocusXpAwarded
        self.dailyFocusXpDate = dailyFocusXpDate
    }
}

/// Active execution-block descriptor persisted at `@lockedin/active_execution_block`.
///
/// W11 (Session) is the canonical writer; HomeState reads it on tab focus to
/// drive auto-resume into `ExecutionBlock`.
public struct ActiveExecutionBlock: Codable, Equatable, Sendable {
    public let startTimestamp: TimeInterval
    public let endTimestamp: TimeInterval
    public let durationMinutes: Int

    public init(startTimestamp: TimeInterval, endTimestamp: TimeInterval, durationMinutes: Int) {
        self.startTimestamp = startTimestamp
        self.endTimestamp = endTimestamp
        self.durationMinutes = durationMinutes
    }
}

// MARK: - Storage keys

/// Persistence keys owned (read or written) by the Home feature. Every key is
/// preserved by exact name from the RN AsyncStorage inventory — see
/// `apps/ios-swift/MIGRATION_FRONTEND_INVENTORY.md` §4.
public enum HomeStorageKeys {
    /// Full `PersistedSessionState` JSON. (`SessionProvider.tsx:38`).
    public static let sessionState = "@lockedin/session_state"

    /// `{startTimestamp,endTimestamp,durationMinutes}` JSON. Written by W11's
    /// `ExecutionBlockScreen`; HomeState only reads it to recover orphaned
    /// sessions and route back into the timer.
    public static let activeExecutionBlock = "@lockedin/active_execution_block"

    /// AppsFlyer dedupe — first program day completed. (`SessionProvider.tsx:39`).
    public static let afFirstSessionSent = "@lockedin/af_first_session_sent"

    /// AppsFlyer dedupe — streak milestones already reported (JSON `[Int]`).
    /// (`SessionProvider.tsx:40`).
    public static let afStreakMilestonesSent = "@lockedin/af_streak_milestones_sent"

    /// AppsFlyer dedupe — home guide first-time dismissal.
    /// (`HomeTab.tsx:47`).
    public static let afTutorialHomeGuideSent = "@lockedin/af_tutorial_home_guide_sent"

    /// Deferred sign-up routing flag. (`HomeTab.tsx:45`).
    public static let pendingSignup = "@lockedin/pending_signup"

    /// One-shot guard — `SKStoreReviewController` request after first guide.
    /// (`HomeTab.tsx:48`).
    public static let storeReviewAfterGuide = "@lockedin/store_review_after_guide"

    /// One-shot signup-nudge gate at streak 3. (`HomeTab.tsx:237`).
    public static let signupNudgeStreak3Shown = "@lockedin/signup_nudge_streak3_shown"
}

/// Streak milestones emitted to AppsFlyer + PostHog.
/// Mirror of `STREAK_MILESTONES` (`SessionProvider.tsx:41`).
public enum StreakMilestones {
    public static let all: [Int] = [3, 7, 14, 30, 60, 90]
}

// MARK: - HomeState (Observable)

/// Steady-state observable model for the Home tab.
///
/// Mirrors the RN `SessionProvider` shape. The reducer-driven mutations
/// (`COMPLETE_EXECUTION_BLOCK`, `ADD_DAILY_FOCUS`, etc.) are exposed as
/// methods. Persistence is handled inline — every public mutator either
/// updates `@Published`-equivalent state and re-persists the
/// `PersistedSessionState`, or kicks off a `Task` for async side-effects.
///
/// W11 (Session) is expected to call the mutators after each execution
/// block completes / daily goal is met — `HomeState` is shared via the
/// coordinator wired by the W3/W11 integration step.
@Observable
@MainActor
public final class HomeState {
    // ── Program tracking ──
    public var programStartDate: String?
    public var maxCompletedDay: Int = 0

    // ── Streak ──
    public var lastSessionDayKey: String?
    public var consecutiveStreak: Int = 0

    // ── Lifetime stats ──
    public var lifetimeTotalMinutes: Int = 0
    public var lifetimeLongestStreak: Int = 0
    public var lifetimeRunsCompleted: Int = 0
    public var lifetimeExecutionBlocks: Int = 0
    public var lifetimeExecutionMinutes: Int = 0

    // ── Date-keyed completion ──
    public var lastLockInCompletedDate: String?

    // ── Daily focus tracking ──
    public var dailyFocusedMinutes: Int = 0
    public var dailyFocusDate: String?

    // ── Daily goal ──
    public var dailyGoalMetDate: String?

    // ── Weekly completion history (day keys where daily goal was met) ──
    public var weekCompletedDays: [String] = []

    // ── Daily FOC XP cap tracking ──
    //
    // Source of truth for the 180-XP/day cap on focus minutes. `awarded`
    // resets implicitly whenever `date` doesn't match `todayKey()`.
    public var dailyFocusXpAwarded: Int = 0
    public var dailyFocusXpDate: String?

    // ── Hydration / phase ──
    public var isHydrated: Bool = false

    /// Streak-break overlay payload. Set by `reconcileStreak()` when a missed
    /// day is detected on launch/foreground (streak transitions `>0 → 0`).
    public struct StreakBreak: Equatable {
        public let previousStreakDays: Int
        /// True when exactly one day was missed AND the user still has a
        /// recovery token this week — the overlay offers a one-tap restore.
        public let recoverable: Bool
        /// Recovery tokens left this week, surfaced in the restore button copy.
        public let recoveriesRemaining: Int

        public init(
            previousStreakDays: Int,
            recoverable: Bool = false,
            recoveriesRemaining: Int = 0
        ) {
            self.previousStreakDays = previousStreakDays
            self.recoverable = recoverable
            self.recoveriesRemaining = recoveriesRemaining
        }
    }
    public var streakBreak: StreakBreak?

    public init() {}

    // MARK: - Hydration

    /// Load persisted state from `Defaults.standard` and replay it into the
    /// observable. Called once on app launch.
    ///
    /// Hydration also triggers an initial widget snapshot publish so a fresh
    /// install (or post-update boot) populates the App Group store before any
    /// mutator fires.
    public func hydrate() {
        defer {
            isHydrated = true
            publishWidgetSnapshot()
        }
        guard let persisted = Defaults.codable(PersistedSessionState.self, HomeStorageKeys.sessionState) else {
            return
        }
        apply(persisted)
        // Resolve any streak broken while the app was closed before the first
        // widget snapshot publishes a stale streak value.
        reconcileStreak()
    }

    /// Map a `PersistedSessionState` (possibly with legacy fields) into the
    /// current shape — same migration logic as the RN `HYDRATE` reducer case.
    private func apply(_ p: PersistedSessionState) {
        let migratedMaxDay = p.maxCompletedDay ?? p.completedDayKeys.map { Set($0).count } ?? 0
        let migratedStartDate = p.programStartDate ?? p.startDayKey
        let migratedLifetimeMinutes = p.lifetimeTotalMinutes ?? p.totalMinutes ?? 0
        let migratedLifetimeLongest = p.lifetimeLongestStreak ?? p.longestStreak ?? 0
        let migratedRunsCompleted = p.lifetimeRunsCompleted ?? 0

        programStartDate = migratedStartDate
        maxCompletedDay = migratedMaxDay
        lastSessionDayKey = p.lastSessionDayKey
        consecutiveStreak = p.consecutiveStreak
        lifetimeTotalMinutes = migratedLifetimeMinutes
        lifetimeLongestStreak = migratedLifetimeLongest
        lifetimeRunsCompleted = migratedRunsCompleted
        lifetimeExecutionBlocks = p.lifetimeExecutionBlocks ?? 0
        lifetimeExecutionMinutes = p.lifetimeExecutionMinutes ?? 0
        lastLockInCompletedDate = p.lastLockInCompletedDate
        dailyFocusedMinutes = p.dailyFocusedMinutes ?? 0
        dailyFocusDate = p.dailyFocusDate
        dailyGoalMetDate = p.dailyGoalMetDate
        weekCompletedDays = p.weekCompletedDays ?? []
        dailyFocusXpAwarded = p.dailyFocusXpAwarded ?? 0
        dailyFocusXpDate = p.dailyFocusXpDate
    }

    // MARK: - Persistence

    /// Persist the current state under `@lockedin/session_state`. Called by
    /// every mutator. Cheap — `UserDefaults` writes are kernel-buffered.
    ///
    /// Also calls `publishWidgetSnapshot()` so the LockedInWidgets extension
    /// and AppIntents see the new numbers within one WidgetKit refresh tick.
    public func persist() {
        guard isHydrated else { return }
        let snapshot = PersistedSessionState(
            programStartDate: programStartDate,
            maxCompletedDay: maxCompletedDay,
            lastSessionDayKey: lastSessionDayKey,
            consecutiveStreak: consecutiveStreak,
            lifetimeTotalMinutes: lifetimeTotalMinutes,
            lifetimeLongestStreak: lifetimeLongestStreak,
            lifetimeRunsCompleted: lifetimeRunsCompleted,
            lifetimeExecutionBlocks: lifetimeExecutionBlocks,
            lifetimeExecutionMinutes: lifetimeExecutionMinutes,
            lastLockInCompletedDate: lastLockInCompletedDate,
            dailyFocusedMinutes: dailyFocusedMinutes,
            dailyFocusDate: dailyFocusDate,
            dailyGoalMetDate: dailyGoalMetDate,
            weekCompletedDays: weekCompletedDays,
            dailyFocusXpAwarded: dailyFocusXpAwarded,
            dailyFocusXpDate: dailyFocusXpDate
        )
        Defaults.setCodable(snapshot, HomeStorageKeys.sessionState)
        publishWidgetSnapshot()
    }

    // MARK: - Widget snapshot publishing

    /// External hook used by `MissionsProvider` to inject the recommended
    /// next mission title into the App Group snapshot without HomeState
    /// taking a hard dependency on `MissionsState`. Optional — when nil,
    /// `publishWidgetSnapshot()` writes `nil` for the mission title.
    public var nextMissionTitleProvider: (() -> String?)?

    /// External hook used by the coordinator to inject the user's
    /// daily-focus commitment from `OnboardingState.dailyMinutes` without
    /// HomeState taking a hard dependency on the Onboarding feature.
    /// Defaults to 60 when nil (matches `HomeTabScreen.dailyCommitmentMinutes`
    /// fallback).
    public var dailyGoalMinutesProvider: (() -> Int)?

    /// Build a fresh `WidgetSnapshot` from the current observable state and
    /// forward it to `WidgetDataPublisher.shared.publish(...)`. Called by
    /// every mutator that touches a field the widgets render.
    ///
    /// `currentSessionEndsAtMs` is owned by `SessionEngine` (it has the
    /// canonical end timestamp). To avoid stomping that field on every
    /// HomeState write, we read whatever the publisher already persisted
    /// and preserve it unless it's stale (>1h old, which always means an
    /// orphaned writer).
    public func publishWidgetSnapshot() {
        let dailyGoalMinutes = dailyGoalMinutesProvider?() ?? 60
        let dailyGoalMet = dailyGoalMetDate == SessionDayEngine.todayKey()
        // Widget snapshot rank: derived from cached server stats when
        // available; falls back to NPC for fresh installs / pre-hydration.
        let rankXp = HomeService.shared.getCachedStats()?.totalRankXp ?? 0
        let rankTierId = RankHelpers.rankFromXp(rankXp).id.rawValue

        // Read the previous snapshot to preserve fields owned by other
        // features (Missions: today's mission progress + XP; Session: the
        // active session end timestamp).
        let prev = WidgetDataPublisher.shared.loadSnapshot()

        // Preserve the publisher's existing `currentSessionEndsAtMs` when it's
        // still fresh — SessionEngine writes it on session start and clears
        // on session end. HomeState shouldn't override that.
        let previousEndsMs: Double? = {
            guard let endsMs = prev?.currentSessionEndsAtMs else { return nil }
            // Drop the value once we're past the end timestamp (timer ran
            // to completion but engine never cleared) — a 60s grace covers
            // the gap between natural finish and the SessionEngine publish.
            let nowMs = Date().timeIntervalSince1970 * 1000
            return endsMs + 60_000 > nowMs ? endsMs : nil
        }()

        let snapshot = WidgetSnapshot(
            consecutiveStreak: consecutiveStreak,
            dailyFocusedMinutes: dailyFocusedMinutes,
            dailyGoalMinutes: dailyGoalMinutes,
            dailyGoalMet: dailyGoalMet,
            lifetimeLongestStreak: lifetimeLongestStreak,
            currentSessionEndsAtMs: previousEndsMs,
            rankTierId: rankTierId,
            nextMissionTitle: nextMissionTitleProvider?(),
            // Missions-owned fields. Carry forward whatever MissionsState
            // last published; safe defaults (0/3/0) match a fresh install
            // before the missions tab has hydrated.
            todayMissionsCompleted: prev?.todayMissionsCompleted ?? 0,
            todayMissionsTotal: prev?.todayMissionsTotal ?? 3,
            todayXpEarned: prev?.todayXpEarned ?? 0,
            lifetimeFocusedMinutes: lifetimeTotalMinutes,
            publishedAtMs: Date().timeIntervalSince1970 * 1000
        )
        WidgetDataPublisher.shared.publish(snapshot)
    }

    // MARK: - Derived helpers (used by HomeTabScreen)

    /// Minutes already focused today. Returns 0 when `dailyFocusDate` is stale.
    public func dailyFocused(todayKey: String) -> Int {
        if dailyFocusDate == todayKey { return dailyFocusedMinutes }
        return 0
    }

    /// Streak is "at risk" when it's genuinely one missed day from breaking:
    /// a live streak whose last goal-met was *yesterday* and where today's
    /// goal hasn't been met yet. Requiring `lastSessionDayKey == yesterday`
    /// (rather than just "not met today") stops the banner from firing every
    /// day — once the streak has already broken, `reconcileStreak()` has zeroed
    /// it, so `consecutiveStreak > 0` is false and this returns false.
    public func streakAtRisk(todayKey: String, dailyGoal: Int) -> Bool {
        guard consecutiveStreak > 0 else { return false }
        let met = dailyFocused(todayKey: todayKey) >= dailyGoal || dailyGoalMetDate == todayKey
        guard !met else { return false }
        return lastSessionDayKey == SessionDayEngine.yesterdayKey()
    }

    // MARK: - Daily FOC XP cap (unified per-stat XP model)

    /// Daily cap on FOC XP earned from focus minutes. Tuned so a 24-hour
    /// lock-in yields the same XP as a 3-hour one — focus-time abuse is
    /// the primary game-able vector this cap defends.
    public static let dailyFocusXpCap: Int = 180

    /// FOC XP already credited today. Returns 0 when `dailyFocusXpDate` is
    /// stale (day rolled).
    public func dailyFocusXpAwardedToday(todayKey: String) -> Int {
        guard dailyFocusXpDate == todayKey else { return 0 }
        return dailyFocusXpAwarded
    }

    /// Compute the XP eligible to credit for `minutes` of focus today,
    /// after applying the daily cap. Does NOT mutate state.
    public func eligibleFocusXp(for minutes: Int, todayKey: String) -> Int {
        let alreadyToday = dailyFocusXpAwardedToday(todayKey: todayKey)
        let remaining = max(0, Self.dailyFocusXpCap - alreadyToday)
        return max(0, min(minutes, remaining))
    }

    /// Record that `xp` FOC XP was awarded for today. Resets the counter
    /// when the day key rolls. Caller is responsible for the server bump —
    /// this only tracks the local cap.
    public func recordFocusXpAwarded(_ xp: Int, todayKey: String) {
        guard xp > 0 else { return }
        if dailyFocusXpDate != todayKey {
            dailyFocusXpAwarded = 0
            dailyFocusXpDate = todayKey
        }
        dailyFocusXpAwarded += xp
        persist()
    }

    // MARK: - Mutators (mirror the RN reducer actions)

    /// `COMPLETE_EXECUTION_BLOCK` — called by W11 after a session completes.
    public func completeExecutionBlock(durationMinutes: Int) {
        let mins = max(0, durationMinutes)
        let today = SessionDayEngine.todayKey()
        let alreadyAdvancedToday = lastLockInCompletedDate == today
        let newMaxDay = alreadyAdvancedToday ? maxCompletedDay : maxCompletedDay + 1
        let focusBase = (dailyFocusDate == today) ? dailyFocusedMinutes : 0

        maxCompletedDay = newMaxDay
        lastLockInCompletedDate = today
        lifetimeExecutionBlocks += 1
        lifetimeExecutionMinutes += mins
        lifetimeTotalMinutes += mins
        dailyFocusedMinutes = focusBase + mins
        dailyFocusDate = today
        persist()
    }

    /// `ADD_DAILY_FOCUS` — bump the daily-focus counter without affecting
    /// completion-day tracking.
    public func addDailyFocus(minutes: Int) {
        let today = SessionDayEngine.todayKey()
        let base = (dailyFocusDate == today) ? dailyFocusedMinutes : 0
        dailyFocusedMinutes = base + minutes
        dailyFocusDate = today
        persist()
    }

    /// `DAILY_GOAL_MET` — fires once per day when daily focus crosses the
    /// daily commitment. Increments streak, updates weekly check-ins.
    public func dailyGoalMet() {
        let today = SessionDayEngine.todayKey()
        if dailyGoalMetDate == today { return }

        let newStreak = SessionDayEngine.computeNewStreak(
            lastSessionDayKey: lastSessionDayKey,
            currentStreak: consecutiveStreak,
            todayKey: today
        )
        let newLifetimeLongest = max(lifetimeLongestStreak, newStreak)

        // Prune weekCompletedDays to the current week, then add today.
        let mondayKey = SessionDayEngine.currentWeekMondayKey()
        var updated = weekCompletedDays.filter { $0 >= mondayKey }
        if !updated.contains(today) { updated.append(today) }

        consecutiveStreak = newStreak
        lifetimeLongestStreak = newLifetimeLongest
        lastSessionDayKey = today
        dailyGoalMetDate = today
        weekCompletedDays = Array(Set(updated)).sorted()
        // Meeting a goal can only grow or hold the streak (never break it), so
        // there's no break detection here. Missed-day breaks are caught by
        // `reconcileStreak()` on launch/foreground.
        persist()
    }

    /// `FULL_RESET` — called on sign-out / logout cleanup.
    public func fullReset() {
        programStartDate = nil
        maxCompletedDay = 0
        lastSessionDayKey = nil
        consecutiveStreak = 0
        lifetimeTotalMinutes = 0
        lifetimeLongestStreak = 0
        lifetimeRunsCompleted = 0
        lifetimeExecutionBlocks = 0
        lifetimeExecutionMinutes = 0
        lastLockInCompletedDate = nil
        dailyFocusedMinutes = 0
        dailyFocusDate = nil
        dailyGoalMetDate = nil
        weekCompletedDays = []
        streakBreak = nil
        persist()
    }

    /// Clear the streak-break overlay payload once the user dismisses it.
    public func dismissStreakBreak() {
        streakBreak = nil
    }

    // MARK: - Missed-day reconciliation

    /// Detect a broken streak on launch / foreground and reset it.
    ///
    /// The streak only advances when the daily goal is met (`dailyGoalMet()`),
    /// which can't run while the app is closed — so a missed day has to be
    /// caught lazily the next time we're foregrounded. Without this the streak
    /// would sit at its stale value until the user's *next* goal-met, silently
    /// masking the break.
    ///
    /// Rule: `gap = days(lastSessionDayKey → today)`.
    ///   - `gap <= 1` → last goal-met was today or yesterday → streak intact.
    ///   - `gap >= 2` → at least one full day missed → break (reset to 0).
    ///     A `gap == 2` (exactly yesterday missed) with budget left is flagged
    ///     `recoverable` so the overlay can offer a restore.
    ///
    /// Idempotent: once the streak is 0 the guard short-circuits, so repeated
    /// foreground calls won't re-fire the break overlay.
    public func reconcileStreak() {
        guard consecutiveStreak > 0, let last = lastSessionDayKey else { return }
        let today = SessionDayEngine.todayKey()
        let gap = SessionDayEngine.delta(start: last, end: today)
        guard gap >= 2 else { return }

        let prev = consecutiveStreak
        let status = StreakRecoveryService.getRecoveryStatus()
        let canRestore = (gap == 2) && status.available

        consecutiveStreak = 0
        streakBreak = StreakBreak(
            previousStreakDays: prev,
            recoverable: canRestore,
            recoveriesRemaining: status.remaining
        )
        persist()
        // Streak broke → push 0 + recompute so the guild rank name drops back
        // to NPC in step with Home.
        Task { await StatsService.setStreakAndRecompute(0) }
    }

    /// Consume a recovery token to restore a just-broken streak.
    ///
    /// Called from the streak-break overlay's restore button. On success the
    /// streak is restored to its pre-break length and `lastSessionDayKey` is
    /// re-anchored to yesterday — the missed day is forgiven, but the user
    /// still has to meet today's goal to continue (so recovery saves the
    /// streak without also gifting today's progress).
    ///
    /// Returns `true` when a token was actually spent and the streak restored.
    @discardableResult
    public func recoverStreak() -> Bool {
        guard let brk = streakBreak, brk.recoverable else { return false }
        let result = StreakRecoveryService.useRecovery(currentStreak: brk.previousStreakDays)
        guard result.recovered else {
            // Budget was exhausted between reconcile and tap — drop the offer.
            streakBreak = nil
            return false
        }

        consecutiveStreak = result.newStreak
        lastSessionDayKey = SessionDayEngine.yesterdayKey()
        streakBreak = nil
        persist()
        let restored = consecutiveStreak
        Task { await StatsService.setStreakAndRecompute(restored) }
        AnalyticsService.shared.track("Streak Recovered", properties: [
            "streak_days": result.newStreak,
        ])
        return true
    }
}

// MARK: - Convenience: rank helpers exposed for HomeTabScreen
//
// Ranks are driven by **total rank XP** (the sum of the five per-stat XP
// buckets). Streaks no longer gate rank-ups — they act as an XP earning
// multiplier instead (`streakXpMultiplier`), so consistency accelerates
// progression without the "lose a day, lose your rank" cliff.

public enum RankHelpers {
    /// Current rank tier for a given total rank XP value. Walks descending
    /// through `RankTiers.all` until `xp >= tier.minXp`.
    public static func rankFromXp(_ xp: Int) -> RankTier {
        let sorted = RankTiers.all.sorted { $0.minXp > $1.minXp }
        for tier in sorted where xp >= tier.minXp {
            return tier
        }
        return RankTiers.all.first { $0.id == .npc } ?? RankTiers.all[0]
    }

    /// Next rank above the current one (nil at MAX RANK).
    public static func nextRankByXp(_ xp: Int) -> RankTier? {
        let asc = RankTiers.all.sorted { $0.minXp < $1.minXp }
        return asc.first { $0.minXp > xp }
    }

    /// Progress 0…1 toward the next rank threshold.
    public static func progressToNextByXp(_ xp: Int) -> Double {
        let current = rankFromXp(xp)
        guard let next = nextRankByXp(xp) else { return 1.0 }
        let span = Double(next.minXp - current.minXp)
        guard span > 0 else { return 1.0 }
        return min(1.0, max(0.0, Double(xp - current.minXp) / span))
    }

    /// XP remaining until the next rank threshold. 0 at MAX RANK.
    public static func xpToNext(_ xp: Int) -> Int {
        guard let next = nextRankByXp(xp) else { return 0 }
        return max(0, next.minXp - xp)
    }

    // MARK: - Streak XP multiplier
    //
    // Streaks reward consistency by multiplying mission XP and the daily-goal /
    // perfect-day XP bumps. Capped at 1.5× so it's meaningful (and noticeable
    // when you cross a milestone) but never absurd — the user explicitly asked
    // for "not too much".
    //
    // **NOT** applied to:
    //   - Focus minute XP (already daily-capped at 180; multiplying defeats
    //     the cap's purpose).
    //   - +5 DIS per-session reward (rounding swallows it anyway).

    /// Returns the XP multiplier for a given consecutive-streak length.
    /// `1.0` (no bonus) for streaks under 3 days; ramps up through milestones
    /// to a `1.5×` cap at 180+ days.
    public static func streakXpMultiplier(currentStreak: Int) -> Double {
        switch currentStreak {
        case ..<3:      return 1.00
        case 3..<7:     return 1.05
        case 7..<30:    return 1.10
        case 30..<60:   return 1.20
        case 60..<90:   return 1.30
        case 90..<180:  return 1.40
        default:        return 1.50
        }
    }

    /// Apply the streak multiplier to a base XP amount. Rounds to the
    /// nearest int so we never write fractional XP to the server.
    public static func applyStreakMultiplier(baseXp: Int, streak: Int) -> Int {
        let raw = Double(baseXp) * streakXpMultiplier(currentStreak: streak)
        return Int(raw.rounded())
    }
}

// `HomeState.StreakBreak` is `Equatable` via compiler synthesis — both fields
// are already `Equatable` (`Int`, `RankId`).
