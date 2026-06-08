//
//  WidgetSnapshot.swift
//  Shared
//
//  Codable snapshot of the data that widgets and App Intents need to render
//  state WITHOUT launching the main app. Written by `WidgetDataPublisher`
//  from the main app on any HomeState / SessionEngine / MissionsState
//  change; read by the LockedInWidgets extension and AppIntentsKit
//  intents from the App Group `UserDefaults` suite.
//
//  Lives in `Shared/` so both the publisher (main app) and the consumers
//  (widget extension, intents) compile the same shape — drift here causes
//  silent decode failures across processes.
//
//  Versioning: this is the v1 shape. App Group key is
//  `SharedScreenTime.WidgetKeys.snapshotV1`. If we ever need a breaking
//  change, introduce a v2 key alongside and migrate readers in lockstep.
//
//  Note (Wave 0): new fields below (`todayMissionsCompleted`,
//  `todayMissionsTotal`, `todayXpEarned`, `lifetimeFocusedMinutes`) are
//  decoded with safe defaults via custom `init(from:)` so older snapshots
//  written before Wave 0 still decode without forcing a v2 break.
//

import Foundation

/// Snapshot of LockedIn user state that the widget extension + App Intents
/// can read directly. Plain `Codable` — intentionally no ActivityKit
/// dependency so the widget extension can decode this without pulling in
/// ActivityKit (which would force iOS 16.1 on every consumer).
public struct WidgetSnapshot: Codable, Sendable {
    /// Current consecutive-day streak.
    public let consecutiveStreak: Int

    /// Today's focused minutes (resets at local midnight per HomeState).
    public let dailyFocusedMinutes: Int

    /// Denominator for the progress bar in the Today widget.
    public let dailyGoalMinutes: Int

    /// True once `dailyFocusedMinutes >= dailyGoalMinutes`.
    public let dailyGoalMet: Bool

    /// Lifetime longest streak — useful for "personal best" callouts.
    public let lifetimeLongestStreak: Int

    /// Epoch ms when the current session is scheduled to end, if a session
    /// is active. Nil when idle. The widget uses this for countdown
    /// rendering when no Live Activity is available (e.g. iOS 16.0).
    public let currentSessionEndsAtMs: Double?

    /// Rank tier id (e.g. "elite") — used to resolve colors via
    /// `DesignKit.RankTiers` without serializing the color value itself.
    public let rankTierId: String

    /// Title of the next recommended mission, if any.
    /// Deprecation deferred — widgets that still render "Next:" use this.
    /// New HUD surfaces should prefer the explicit `todayMissions*` /
    /// `todayXpEarned` fields.
    public let nextMissionTitle: String?

    /// Number of daily missions completed today (0–3 normally).
    /// Source: `MissionsState.completedCount`.
    public let todayMissionsCompleted: Int

    /// Denominator for today's mission progress (typically 3).
    /// Source: `MissionsState.missions.count`, falling back to 3 when the
    /// generator hasn't run yet (fresh install before first hydrate).
    public let todayMissionsTotal: Int

    /// XP earned today across missions and bonuses.
    /// Source: `MissionsState.dailyXP`.
    public let todayXpEarned: Int

    /// Lifetime cumulative focused minutes (never resets).
    /// Source: `HomeState.lifetimeTotalMinutes`.
    public let lifetimeFocusedMinutes: Int

    /// Epoch ms the snapshot was written. Widgets compare against now() for
    /// staleness handling (e.g. dim the surface if older than ~1 hour).
    public let publishedAtMs: Double

    public init(
        consecutiveStreak: Int,
        dailyFocusedMinutes: Int,
        dailyGoalMinutes: Int,
        dailyGoalMet: Bool,
        lifetimeLongestStreak: Int,
        currentSessionEndsAtMs: Double?,
        rankTierId: String,
        nextMissionTitle: String?,
        todayMissionsCompleted: Int = 0,
        todayMissionsTotal: Int = 3,
        todayXpEarned: Int = 0,
        lifetimeFocusedMinutes: Int = 0,
        publishedAtMs: Double
    ) {
        self.consecutiveStreak = consecutiveStreak
        self.dailyFocusedMinutes = dailyFocusedMinutes
        self.dailyGoalMinutes = dailyGoalMinutes
        self.dailyGoalMet = dailyGoalMet
        self.lifetimeLongestStreak = lifetimeLongestStreak
        self.currentSessionEndsAtMs = currentSessionEndsAtMs
        self.rankTierId = rankTierId
        self.nextMissionTitle = nextMissionTitle
        self.todayMissionsCompleted = todayMissionsCompleted
        self.todayMissionsTotal = todayMissionsTotal
        self.todayXpEarned = todayXpEarned
        self.lifetimeFocusedMinutes = lifetimeFocusedMinutes
        self.publishedAtMs = publishedAtMs
    }

    // MARK: - Backward-compatible Codable
    //
    // Older builds wrote snapshots without the four Wave 0 fields. When the
    // widget extension upgrades before the host app re-runs, the existing
    // App Group blob must still decode. We give the new fields safe defaults
    // matching the no-op state (no missions complete, 3 mission slots, no XP
    // earned, no lifetime focus). The publisher overwrites them on the very
    // next `publish()` call.

    private enum CodingKeys: String, CodingKey {
        case consecutiveStreak
        case dailyFocusedMinutes
        case dailyGoalMinutes
        case dailyGoalMet
        case lifetimeLongestStreak
        case currentSessionEndsAtMs
        case rankTierId
        case nextMissionTitle
        case todayMissionsCompleted
        case todayMissionsTotal
        case todayXpEarned
        case lifetimeFocusedMinutes
        case publishedAtMs
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.consecutiveStreak = try c.decode(Int.self, forKey: .consecutiveStreak)
        self.dailyFocusedMinutes = try c.decode(Int.self, forKey: .dailyFocusedMinutes)
        self.dailyGoalMinutes = try c.decode(Int.self, forKey: .dailyGoalMinutes)
        self.dailyGoalMet = try c.decode(Bool.self, forKey: .dailyGoalMet)
        self.lifetimeLongestStreak = try c.decode(Int.self, forKey: .lifetimeLongestStreak)
        self.currentSessionEndsAtMs = try c.decodeIfPresent(Double.self, forKey: .currentSessionEndsAtMs)
        self.rankTierId = try c.decode(String.self, forKey: .rankTierId)
        self.nextMissionTitle = try c.decodeIfPresent(String.self, forKey: .nextMissionTitle)
        self.todayMissionsCompleted = try c.decodeIfPresent(Int.self, forKey: .todayMissionsCompleted) ?? 0
        self.todayMissionsTotal = try c.decodeIfPresent(Int.self, forKey: .todayMissionsTotal) ?? 3
        self.todayXpEarned = try c.decodeIfPresent(Int.self, forKey: .todayXpEarned) ?? 0
        self.lifetimeFocusedMinutes = try c.decodeIfPresent(Int.self, forKey: .lifetimeFocusedMinutes) ?? 0
        self.publishedAtMs = try c.decode(Double.self, forKey: .publishedAtMs)
    }
}
