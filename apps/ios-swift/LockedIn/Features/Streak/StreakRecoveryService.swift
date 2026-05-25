//
//  StreakRecoveryService.swift
//  LockedIn — Worker W7 (Streak feature)
//
//  Port of `apps/mobile/src/features/streak/StreakRecoveryService.ts`.
//
//  Manages the "recover broken streak" budget: the user gets at most
//  2 recoveries per local-time week, and at most one per local-time day.
//  A recovery requires completing a 15-minute focus session — this service
//  only owns the budgeting; the session itself is driven by W11 (Session).
//
//  Storage: `@lockedin/streak_recovery` JSON in standard `UserDefaults`
//  (NOT the App Group suite — DAM extension does not need this state).
//

import Foundation

/// Persisted shape under `@lockedin/streak_recovery`. Mirrors the
/// `StreakRecoveryState` TS interface.
public struct StreakRecoveryState: Codable, Equatable, Sendable {
    /// `YYYY-MM-DD` local-time key of the most recent recovery, or `nil`.
    public var lastRecoveryDate: String?
    /// Number of recoveries used in the current week (Mon-anchored).
    public var recoveriesUsedThisWeek: Int
    /// `YYYY-MM-DD` Monday of the current week. Used to detect week rollover
    /// so the counter resets at the start of every new week.
    public var weekStartDate: String

    public init(
        lastRecoveryDate: String? = nil,
        recoveriesUsedThisWeek: Int = 0,
        weekStartDate: String
    ) {
        self.lastRecoveryDate = lastRecoveryDate
        self.recoveriesUsedThisWeek = recoveriesUsedThisWeek
        self.weekStartDate = weekStartDate
    }
}

/// Result of `useRecovery(currentStreak:)`. Mirrors the
/// `{ newStreak, recovered }` TS return shape.
public struct StreakRecoveryResult: Equatable, Sendable {
    public let newStreak: Int
    public let recovered: Bool
}

/// Snapshot for the UI / banner — mirrors `getRecoveryStatus()` return.
public struct StreakRecoveryStatus: Equatable, Sendable {
    public let available: Bool
    public let usedThisWeek: Int
    public let maxPerWeek: Int

    public var remaining: Int { max(0, maxPerWeek - usedThisWeek) }
}

/// Streak-recovery budget owner.
///
/// All methods are static — the service has no instance state, only what's
/// persisted in `UserDefaults`. Lock-free: every read/write is short and
/// `UserDefaults` ops are atomic enough for this single-user state.
public enum StreakRecoveryService {
    /// Storage key — preserved exactly from the RN port
    /// (`apps/mobile/src/features/streak/StreakRecoveryService.ts:9`).
    public static let storageKey = "@lockedin/streak_recovery"

    /// Hard cap — mirrors RN `MAX_RECOVERIES_PER_WEEK` constant
    /// (`StreakRecoveryService.ts:10`).
    public static let maxRecoveriesPerWeek: Int = 2

    /// Minutes a user must focus to trigger a recovery — surface this to UI
    /// (`StreakRecoveryModal`). Mirror of RN `REQUIRED_SESSION_MINUTES`
    /// (`StreakRecoveryService.ts:11`).
    public static let requiredSessionMinutes: Int = 15

    // MARK: - Public API

    /// True iff the user hasn't already used a recovery today AND is under
    /// the weekly cap.
    @discardableResult
    public static func canRecover() -> Bool {
        let state = getState()
        let today = todayKey()
        if state.lastRecoveryDate == today { return false }
        if state.recoveriesUsedThisWeek >= maxRecoveriesPerWeek { return false }
        return true
    }

    /// Consume a recovery — atomic read-check-mutate-write. Returns the
    /// (possibly unchanged) streak alongside a `recovered` flag indicating
    /// whether the budget actually permitted the recovery. If `recovered` is
    /// `false` the caller MUST NOT advance the streak.
    ///
    /// - Parameter currentStreak: the streak prior to the missed day. On
    ///   success the streak is preserved at this value.
    @discardableResult
    public static func useRecovery(currentStreak: Int) -> StreakRecoveryResult {
        var state = getState()
        let today = todayKey()

        if state.lastRecoveryDate == today {
            return StreakRecoveryResult(newStreak: currentStreak, recovered: false)
        }
        if state.recoveriesUsedThisWeek >= maxRecoveriesPerWeek {
            return StreakRecoveryResult(newStreak: currentStreak, recovered: false)
        }

        state.lastRecoveryDate = today
        state.recoveriesUsedThisWeek += 1
        persist(state)

        return StreakRecoveryResult(newStreak: currentStreak, recovered: true)
    }

    /// Status snapshot for the UI.
    public static func getRecoveryStatus() -> StreakRecoveryStatus {
        let available = canRecover()
        let state = getState()
        return StreakRecoveryStatus(
            available: available,
            usedThisWeek: state.recoveriesUsedThisWeek,
            maxPerWeek: maxRecoveriesPerWeek
        )
    }

    /// Clear all recovery bookkeeping. Called during app initialization /
    /// `fullReset()` paths.
    public static func resetState() {
        let initial = StreakRecoveryState(
            lastRecoveryDate: nil,
            recoveriesUsedThisWeek: 0,
            weekStartDate: weekStartKey()
        )
        persist(initial)
    }

    // MARK: - Internals

    /// Read + auto-migrate the persisted state. If the stored `weekStartDate`
    /// lags behind the current week, the weekly counter is reset (matching
    /// the RN `getState()` behavior).
    private static func getState() -> StreakRecoveryState {
        guard let stored = Defaults.codable(StreakRecoveryState.self, storageKey) else {
            let initial = StreakRecoveryState(weekStartDate: weekStartKey())
            persist(initial)
            return initial
        }

        var state = stored
        let weekStart = weekStartKey()
        if state.weekStartDate != weekStart {
            state.weekStartDate = weekStart
            state.recoveriesUsedThisWeek = 0
            // Don't persist the auto-migration here — `useRecovery` will
            // persist the full mutation. Keeping `getState` pure (read-only
            // except for first-time init) matches the RN service's actual
            // behaviour: it returns the migrated state without writing.
        }
        return state
    }

    private static func persist(_ state: StreakRecoveryState) {
        Defaults.setCodable(state, storageKey)
    }

    /// `YYYY-MM-DD` for today in local time. Matches RN
    /// `ClockService.getLocalDateKey()` shape.
    private static func todayKey() -> String {
        let now = Date()
        let cal = Calendar.current
        let comps = cal.dateComponents([.year, .month, .day], from: now)
        return String(
            format: "%04d-%02d-%02d",
            comps.year ?? 1970,
            comps.month ?? 1,
            comps.day ?? 1
        )
    }

    /// `YYYY-MM-DD` for the Monday-anchored start of the current local week.
    /// Mirrors the RN `getWeekStartDate()` helper which treats Monday as day 0
    /// even though JS `getDay()` returns 0 for Sunday — the RN code maps
    /// Sunday → 6 days back, otherwise `dayOfWeek - 1`.
    private static func weekStartKey() -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let today = Date()

        // Calendar.component(.weekday) → 1 == Sunday … 7 == Saturday.
        let weekday = cal.component(.weekday, from: today)
        // Days back to Monday: Sunday→6, Monday→0, Tuesday→1, … Saturday→5.
        let daysBack = (weekday == 1) ? 6 : (weekday - 2)
        guard let monday = cal.date(byAdding: .day, value: -daysBack, to: today) else {
            return todayKey()
        }
        let comps = cal.dateComponents([.year, .month, .day], from: monday)
        return String(
            format: "%04d-%02d-%02d",
            comps.year ?? 1970,
            comps.month ?? 1,
            comps.day ?? 1
        )
    }
}
