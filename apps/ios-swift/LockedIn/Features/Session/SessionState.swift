//
//  SessionState.swift
//  LockedIn — Worker W11 (Session / Lock-In feature)
//
//  @Observable port of the RN `SessionProvider` reducer state. Mirrors the
//  RN action types as method calls so the resulting state transitions are
//  byte-for-byte identical to the React Native source.
//
//  RN source: `apps/mobile/src/features/home/state/SessionProvider.tsx`,
//  `apps/mobile/src/features/home/state/types.ts`.
//
//  Persistence key: `@lockedin/session_state` (standard `UserDefaults`).
//  AppsFlyer dedupe keys: `@lockedin/af_first_session_sent`,
//  `@lockedin/af_streak_milestones_sent` — owned here.
//
//  Concurrency: `@MainActor`. Mutations come from UI callbacks and the
//  session engine timer, which both run on the main actor.
//

import Foundation
import Observation

// MARK: - Day key utilities (mirror engine/SessionEngine.ts)

/// Timezone-safe local day key: "YYYY-MM-DD".
public typealias DayKey = String

public enum SessionDayKey {
    /// Today's local day key.
    public static func today(now: Date = Date()) -> DayKey {
        format(now)
    }

    /// Yesterday's local day key.
    public static func yesterday(now: Date = Date()) -> DayKey {
        format(Calendar.current.date(byAdding: .day, value: -1, to: now) ?? now)
    }

    /// Monday of the current ISO-style week (matches the RN
    /// `weekCompletedDays` prune logic in `DAILY_GOAL_MET`).
    public static func mondayOfWeek(now: Date = Date()) -> DayKey {
        var calendar = Calendar.current
        calendar.firstWeekday = 2 // Monday
        let weekday = Calendar.current.component(.weekday, from: now) // Sun=1…Sat=7
        let offset = weekday == 1 ? -6 : 2 - weekday
        let monday = Calendar.current.date(byAdding: .day, value: offset, to: now) ?? now
        return format(monday)
    }

    /// Streak-rule mirror of `engine/SessionEngine.computeNewStreak`.
    public static func computeNewStreak(
        lastSessionDayKey: DayKey?,
        currentStreak: Int,
        todayKey: DayKey,
        now: Date = Date()
    ) -> Int {
        if lastSessionDayKey == todayKey { return currentStreak }
        if lastSessionDayKey == yesterday(now: now) { return currentStreak + 1 }
        return 1
    }

    static func format(_ date: Date) -> DayKey {
        let year = Calendar.current.component(.year, from: date)
        let month = Calendar.current.component(.month, from: date)
        let day = Calendar.current.component(.day, from: date)
        return String(format: "%04d-%02d-%02d", year, month, day)
    }
}

// MARK: - Persisted state shape

/// Session-feature local persisted shape. Mirrors RN `PersistedSessionState`
/// (including legacy migration fields). The Home feature also declares a
/// `PersistedSessionState` (its own variant with different optionality); we
/// disambiguate by namespacing this one with the `SessionState` prefix.
/// Both encode/decode the same JSON written to `@lockedin/session_state`.
public struct SessionStatePersistedShape: Codable, Equatable {
    public var programStartDate: DayKey?
    public var maxCompletedDay: Int
    public var lastSessionDayKey: DayKey?
    public var consecutiveStreak: Int
    public var lifetimeTotalMinutes: Int
    public var lifetimeLongestStreak: Int
    public var lifetimeRunsCompleted: Int
    public var lifetimeExecutionBlocks: Int
    public var lifetimeExecutionMinutes: Int
    public var lastLockInCompletedDate: DayKey?
    public var dailyFocusedMinutes: Int?
    public var dailyFocusDate: DayKey?
    public var dailyGoalMetDate: DayKey?
    public var weekCompletedDays: [DayKey]?

    // Legacy fields kept for migration parity with RN HYDRATE.
    public var startDayKey: DayKey?
    public var completedDayKeys: [DayKey]?
    public var longestStreak: Int?
    public var totalMinutes: Int?

    public init(
        programStartDate: DayKey? = nil,
        maxCompletedDay: Int = 0,
        lastSessionDayKey: DayKey? = nil,
        consecutiveStreak: Int = 0,
        lifetimeTotalMinutes: Int = 0,
        lifetimeLongestStreak: Int = 0,
        lifetimeRunsCompleted: Int = 0,
        lifetimeExecutionBlocks: Int = 0,
        lifetimeExecutionMinutes: Int = 0,
        lastLockInCompletedDate: DayKey? = nil,
        dailyFocusedMinutes: Int? = nil,
        dailyFocusDate: DayKey? = nil,
        dailyGoalMetDate: DayKey? = nil,
        weekCompletedDays: [DayKey]? = nil,
        startDayKey: DayKey? = nil,
        completedDayKeys: [DayKey]? = nil,
        longestStreak: Int? = nil,
        totalMinutes: Int? = nil
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
        self.startDayKey = startDayKey
        self.completedDayKeys = completedDayKeys
        self.longestStreak = longestStreak
        self.totalMinutes = totalMinutes
    }
}

// `ActiveExecutionBlock` is declared canonically by `Features/Home/HomeState.swift`.
// Same JSON shape (`@lockedin/active_execution_block`); the Session feature
// references that single type to avoid module-level redeclaration.

// MARK: - SessionState (Observable)

/// Lock button lifecycle phase. Matches RN `SessionPhase`.
public enum SessionPhase: String, Sendable {
    case idle
    case animating
}

/// Mirrors the RN `SessionProvider` state object + reducer. The methods
/// (`completeExecutionBlock`, `dailyGoalMet`, `addDailyFocus`, etc.) are
/// 1-for-1 ports of the RN reducer cases.
///
/// Side effects (analytics, stats, achievement evaluation) are NOT inlined
/// here — Worker W3 (Home) and the engine layer fire those. This struct only
/// owns the persisted in-memory state.
@MainActor
@Observable
public final class SessionState {
    // MARK: - Persisted key names (match RN exactly)

    /// Persistence key for the entire `PersistedSessionState` blob.
    public static let storageKey = "@lockedin/session_state"
    /// AppsFlyer "first program day completed" dedupe flag.
    public static let afFirstSessionKey = "@lockedin/af_first_session_sent"
    /// AppsFlyer streak-milestone dedupe set (JSON-encoded Int array).
    public static let afStreakMilestonesKey = "@lockedin/af_streak_milestones_sent"
    /// AsyncStorage key the active execution block is persisted under so the
    /// HomeTab can resume after a kill.
    public static let activeExecutionBlockKey = "@lockedin/active_execution_block"
    /// Whether the active block is a Hardcore session (no early exit / breaks).
    /// Persisted so a minimize / cold-resume re-presents with hardcore intact.
    public static let activeBlockHardcoreKey = "@lockedin/active_block_hardcore"

    // MARK: - Phase

    public var phase: SessionPhase = .idle

    // MARK: - Program tracking

    public var programStartDate: DayKey?
    public var maxCompletedDay: Int = 0

    // MARK: - Streak

    public var lastSessionDayKey: DayKey?
    public var consecutiveStreak: Int = 0

    // MARK: - Lifetime stats

    public var lifetimeTotalMinutes: Int = 0
    public var lifetimeLongestStreak: Int = 0
    public var lifetimeRunsCompleted: Int = 0

    public var lifetimeExecutionBlocks: Int = 0
    public var lifetimeExecutionMinutes: Int = 0

    // MARK: - Daily / weekly

    public var lastLockInCompletedDate: DayKey?
    public var dailyFocusedMinutes: Int = 0
    public var dailyFocusDate: DayKey?
    public var dailyGoalMetDate: DayKey?
    public var weekCompletedDays: [DayKey] = []

    // MARK: - Hydration flag

    public private(set) var isHydrated: Bool = false

    public init() {}

    // MARK: - Hydration (HYDRATE action)

    /// Load the persisted blob from standard `UserDefaults`. Tolerates legacy
    /// shapes per the RN HYDRATE migration.
    public func hydrateFromDefaults() {
        defer { isHydrated = true }
        guard let persisted = Defaults.codable(SessionStatePersistedShape.self, Self.storageKey) else {
            return
        }
        applyHydrate(persisted)
    }

    /// Mirror of the RN HYDRATE reducer case. Public so tests / one-off
    /// migrations can drive it.
    public func applyHydrate(_ p: SessionStatePersistedShape) {
        let migratedMaxDay = p.maxCompletedDay != 0
            ? p.maxCompletedDay
            : (p.completedDayKeys.map { Set($0).count } ?? 0)
        let migratedStartDate = p.programStartDate ?? p.startDayKey
        let migratedLifetimeMinutes = p.lifetimeTotalMinutes != 0
            ? p.lifetimeTotalMinutes
            : (p.totalMinutes ?? 0)
        let migratedLifetimeLongest = p.lifetimeLongestStreak != 0
            ? p.lifetimeLongestStreak
            : (p.longestStreak ?? 0)

        programStartDate = migratedStartDate
        maxCompletedDay = migratedMaxDay
        lastSessionDayKey = p.lastSessionDayKey
        consecutiveStreak = p.consecutiveStreak
        lifetimeTotalMinutes = migratedLifetimeMinutes
        lifetimeLongestStreak = migratedLifetimeLongest
        lifetimeRunsCompleted = p.lifetimeRunsCompleted
        lifetimeExecutionBlocks = p.lifetimeExecutionBlocks
        lifetimeExecutionMinutes = p.lifetimeExecutionMinutes
        lastLockInCompletedDate = p.lastLockInCompletedDate
        dailyFocusedMinutes = p.dailyFocusedMinutes ?? 0
        dailyFocusDate = p.dailyFocusDate
        dailyGoalMetDate = p.dailyGoalMetDate
        weekCompletedDays = p.weekCompletedDays ?? []
        phase = .idle
    }

    // MARK: - Persistence

    /// Snapshot the live state into a persistable blob.
    public func snapshot() -> SessionStatePersistedShape {
        SessionStatePersistedShape(
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
    }

    /// Persist to standard `UserDefaults`. Mirror of the RN
    /// `AsyncStorage.setItem(STORAGE_KEY, ...)` effect.
    public func persistToDefaults() {
        guard isHydrated else { return }
        Defaults.setCodable(snapshot(), Self.storageKey)
    }

    // MARK: - Reducer-equivalent mutations

    /// SET_ANIMATING. No-op when not idle, exactly like the RN reducer.
    public func setAnimating() {
        guard phase == .idle else { return }
        phase = .animating
    }

    /// RESET_PHASE.
    public func resetPhase() {
        phase = .idle
    }

    /// FULL_RESET — used by the RN logout cleanup bus.
    public func fullReset() {
        phase = .idle
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
    }

    /// COMPLETE_EXECUTION_BLOCK. `mins` is the session length in minutes.
    @discardableResult
    public func completeExecutionBlock(durationMinutes mins: Int, now: Date = Date()) -> CompleteExecutionBlockOutcome {
        let todayKey = SessionDayKey.today(now: now)
        let alreadyAdvancedToday = lastLockInCompletedDate == todayKey
        let newMaxDay = alreadyAdvancedToday ? maxCompletedDay : maxCompletedDay + 1
        let focusBase = (dailyFocusDate == todayKey) ? dailyFocusedMinutes : 0

        maxCompletedDay = newMaxDay
        lastLockInCompletedDate = todayKey
        lifetimeExecutionBlocks += 1
        lifetimeExecutionMinutes += mins
        lifetimeTotalMinutes += mins
        dailyFocusedMinutes = focusBase + mins
        dailyFocusDate = todayKey

        return CompleteExecutionBlockOutcome(
            todayKey: todayKey,
            newMaxCompletedDay: newMaxDay,
            newDailyFocusedMinutes: dailyFocusedMinutes
        )
    }

    /// ADD_DAILY_FOCUS.
    public func addDailyFocus(minutes: Int, now: Date = Date()) {
        let todayKey = SessionDayKey.today(now: now)
        let base = (dailyFocusDate == todayKey) ? dailyFocusedMinutes : 0
        dailyFocusedMinutes = base + minutes
        dailyFocusDate = todayKey
    }

    /// DAILY_GOAL_MET — returns the new streak (or current streak when no-op).
    @discardableResult
    public func dailyGoalMet(now: Date = Date()) -> Int {
        let todayKey = SessionDayKey.today(now: now)
        if dailyGoalMetDate == todayKey { return consecutiveStreak }

        let newStreak = SessionDayKey.computeNewStreak(
            lastSessionDayKey: lastSessionDayKey,
            currentStreak: consecutiveStreak,
            todayKey: todayKey,
            now: now
        )
        let newLifetimeLongest = max(lifetimeLongestStreak, newStreak)

        // Prune week-completed days to current week, append today.
        let mondayKey = SessionDayKey.mondayOfWeek(now: now)
        var pruned = weekCompletedDays.filter { $0 >= mondayKey }
        pruned.append(todayKey)
        let deduped = Array(NSOrderedSet(array: pruned)) as? [DayKey] ?? pruned

        consecutiveStreak = newStreak
        lifetimeLongestStreak = newLifetimeLongest
        lastSessionDayKey = todayKey
        dailyGoalMetDate = todayKey
        weekCompletedDays = deduped

        return newStreak
    }
}

/// Result of `completeExecutionBlock` — surfaces values callers need to
/// drive the streak-met / analytics fan-out without poking at state mid-flight.
public struct CompleteExecutionBlockOutcome: Equatable {
    public let todayKey: DayKey
    public let newMaxCompletedDay: Int
    public let newDailyFocusedMinutes: Int
}
