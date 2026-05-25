//
//  AchievementService.swift
//  LockedIn
//
//  Stub for the post-launch achievements pipeline. The RN app emits
//  PostHog `Achievement Unlocked` events from the session-complete
//  pipeline (`apps/mobile/src/services/AchievementService.ts`); the Swift
//  port keeps the call surface in place so callers compile, but the
//  actual unlock rules are deferred until after the cutover.
//

import Foundation

/// Achievement evaluation context. Mirrors the RN `evaluate(...)` arg
/// bundle.
public struct AchievementContext {
    public let consecutiveStreak: Int
    public let lifetimeRunsCompleted: Int
    public let lifetimeTotalMinutes: Int
    public let dailyGoalMet: Bool

    public init(
        consecutiveStreak: Int,
        lifetimeRunsCompleted: Int,
        lifetimeTotalMinutes: Int,
        dailyGoalMet: Bool
    ) {
        self.consecutiveStreak = consecutiveStreak
        self.lifetimeRunsCompleted = lifetimeRunsCompleted
        self.lifetimeTotalMinutes = lifetimeTotalMinutes
        self.dailyGoalMet = dailyGoalMet
    }
}

@MainActor
public enum AchievementService {
    /// Evaluate unlock rules for the supplied context. Currently a no-op —
    /// the RN rules are recomputed server-side and the iOS app does not own
    /// the canonical list of badges. Wired into session/missions pipelines
    /// so the future implementation can drop in without touching call sites.
    public static func evaluate(_ ctx: AchievementContext) {
        // TODO(post-launch): port the RN AchievementService rules. For now
        // we simply forward the streak count so the analytics pipeline gets
        // *some* signal during integration testing.
        _ = ctx
        AnalyticsService.shared.track("Achievement Eval", properties: [
            "consecutive_streak": ctx.consecutiveStreak,
            "lifetime_runs": ctx.lifetimeRunsCompleted,
            "lifetime_minutes": ctx.lifetimeTotalMinutes,
            "daily_goal_met": ctx.dailyGoalMet,
        ])
    }
}
