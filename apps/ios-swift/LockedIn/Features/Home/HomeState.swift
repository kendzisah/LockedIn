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
        weekCompletedDays: [String]? = nil
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

    // ── Hydration / phase ──
    public var isHydrated: Bool = false

    /// Streak-break overlay payload. Set when streak transitions `>0 → 0`.
    public struct StreakBreak: Equatable {
        public let previousStreakDays: Int
        public let previousRankId: RankId

        public init(previousStreakDays: Int, previousRankId: RankId) {
            self.previousStreakDays = previousStreakDays
            self.previousRankId = previousRankId
        }
    }
    public var streakBreak: StreakBreak?

    public init() {}

    // MARK: - Hydration

    /// Load persisted state from `Defaults.standard` and replay it into the
    /// observable. Called once on app launch.
    public func hydrate() {
        defer { isHydrated = true }
        guard let persisted = Defaults.codable(PersistedSessionState.self, HomeStorageKeys.sessionState) else {
            return
        }
        apply(persisted)
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
    }

    // MARK: - Persistence

    /// Persist the current state under `@lockedin/session_state`. Called by
    /// every mutator. Cheap — `UserDefaults` writes are kernel-buffered.
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
            weekCompletedDays: weekCompletedDays
        )
        Defaults.setCodable(snapshot, HomeStorageKeys.sessionState)
    }

    // MARK: - Derived helpers (used by HomeTabScreen)

    /// Minutes already focused today. Returns 0 when `dailyFocusDate` is stale.
    public func dailyFocused(todayKey: String) -> Int {
        if dailyFocusDate == todayKey { return dailyFocusedMinutes }
        return 0
    }

    /// Streak is "at risk" when the user has a non-zero streak but hasn't
    /// met today's goal yet.
    public func streakAtRisk(todayKey: String, dailyGoal: Int) -> Bool {
        let focused = dailyFocused(todayKey: todayKey)
        let met = focused >= dailyGoal
        return !met && consecutiveStreak > 0 && dailyGoalMetDate != todayKey
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

        let prevStreak = consecutiveStreak
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

        // Mirror RN: detect a streak-broken transition (prev > 0, next == 0).
        // dailyGoalMet doesn't normally cause this, but the explicit reset on
        // future "missed day" logic does — keep symmetry for safety.
        if prevStreak > 0 && newStreak == 0 {
            streakBreak = StreakBreak(
                previousStreakDays: prevStreak,
                previousRankId: rankIdFromStreak(prevStreak)
            )
        }
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

    // MARK: - Streak helpers

    /// Mirrors `RankService.rankFromStreak` (`apps/mobile/src/services/RankService.ts`).
    /// Walks descending through `RankTiers.all` until `streak >= tier.minDays`.
    private func rankIdFromStreak(_ streak: Int) -> RankId {
        let sorted = RankTiers.all.sorted { $0.minDays > $1.minDays }
        for tier in sorted where streak >= tier.minDays {
            return tier.id
        }
        return .npc
    }
}

// MARK: - Convenience: rank helpers exposed for HomeTabScreen

public enum RankHelpers {
    /// Current rank tier for a given streak length.
    public static func rankFromStreak(_ streak: Int) -> RankTier {
        let sorted = RankTiers.all.sorted { $0.minDays > $1.minDays }
        for tier in sorted where streak >= tier.minDays {
            return tier
        }
        return RankTiers.all.first { $0.id == .npc } ?? RankTiers.all[0]
    }

    /// Next rank above the current one (nil at MAX RANK).
    public static func nextRank(streak: Int) -> RankTier? {
        let asc = RankTiers.all.sorted { $0.minDays < $1.minDays }
        return asc.first { $0.minDays > streak }
    }

    /// Progress 0…1 toward the next rank threshold.
    public static func progressToNext(streak: Int) -> Double {
        let current = rankFromStreak(streak)
        guard let next = nextRank(streak: streak) else { return 1.0 }
        let span = Double(next.minDays - current.minDays)
        guard span > 0 else { return 1.0 }
        return min(1.0, max(0.0, Double(streak - current.minDays) / span))
    }
}

// `HomeState.StreakBreak` is `Equatable` via compiler synthesis — both fields
// are already `Equatable` (`Int`, `RankId`).
