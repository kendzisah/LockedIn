//
//  AchievementCatalog.swift
//  LockedIn
//
//  Typed list of achievement definitions + their unlock predicates.
//  `AchievementService.evaluate(_:)` walks this catalog after each session
//  / mission completion, checks predicates against the cached
//  `HomeService.UserStatsRow`, and calls `unlock_achievements` for the
//  newly-satisfied set.
//

import SwiftUI
import DesignKit

/// One achievement definition. `predicate` is evaluated against the
/// `AchievementEvalSnapshot` passed to `AchievementService.evaluate`.
public struct AchievementDefinition: Identifiable, Sendable {
    public let id: String
    public let name: String
    public let description: String
    public let category: AchievementCategory
    public let predicate: @Sendable (AchievementEvalSnapshot) -> Bool

    public init(
        id: String,
        name: String,
        description: String,
        category: AchievementCategory,
        predicate: @escaping @Sendable (AchievementEvalSnapshot) -> Bool
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.category = category
        self.predicate = predicate
    }
}

/// Categories — used for badge tint in `AchievementsRow`.
public enum AchievementCategory: String, Sendable {
    case focus
    case discipline
    case execution
    case consistency
    case social
    case rank

    public var color: Color {
        switch self {
        case .focus:       return Color(hex: "#FFC857") // gold
        case .discipline:  return AppColors.primary    // Discipline Blue
        case .execution:   return AppColors.success    // green
        case .consistency: return Color(hex: "#A855F7") // purple
        case .social:      return Color(hex: "#00C2FF") // cyan
        case .rank:        return Color(hex: "#FF006E") // pink
        }
    }
}

/// All inputs the catalog's predicates can read. Built fresh on every
/// `AchievementService.evaluate(_:)` call from `HomeService.shared
/// .getCachedStats()` + the `HomeState.consecutiveStreak`.
public struct AchievementEvalSnapshot: Sendable {
    public let consecutiveStreak: Int
    public let totalRankXp: Int
    public let totalFocusMinutes: Int
    public let totalSessions: Int
    public let totalCompletedSessions: Int
    public let totalMissionsCompleted: Int
    public let totalDistractionsResisted: Int
    public let totalPerfectDays: Int
    public let totalStreakDays: Int
    public let invitesUsed: Int
    public let guildCheckIns: Int

    public init(
        consecutiveStreak: Int = 0,
        totalRankXp: Int = 0,
        totalFocusMinutes: Int = 0,
        totalSessions: Int = 0,
        totalCompletedSessions: Int = 0,
        totalMissionsCompleted: Int = 0,
        totalDistractionsResisted: Int = 0,
        totalPerfectDays: Int = 0,
        totalStreakDays: Int = 0,
        invitesUsed: Int = 0,
        guildCheckIns: Int = 0
    ) {
        self.consecutiveStreak = consecutiveStreak
        self.totalRankXp = totalRankXp
        self.totalFocusMinutes = totalFocusMinutes
        self.totalSessions = totalSessions
        self.totalCompletedSessions = totalCompletedSessions
        self.totalMissionsCompleted = totalMissionsCompleted
        self.totalDistractionsResisted = totalDistractionsResisted
        self.totalPerfectDays = totalPerfectDays
        self.totalStreakDays = totalStreakDays
        self.invitesUsed = invitesUsed
        self.guildCheckIns = guildCheckIns
    }
}

/// Static catalog. Order = display order in `AchievementsRow`.
///
/// Thresholds are tuned alongside the unified XP curve in `RankTiers`:
///   - Early entries unlock in the first few days.
///   - Mid-range targets cross with the ELITE / PHANTOM rank window
///     (~month 1 / month 2-3).
///   - The capstone "Locked In" matches the LOCKED IN rank ceiling
///     (~month 10 for a consistent user).
public enum AchievementCatalog {
    public static let all: [AchievementDefinition] = [
        // ── Focus ──
        .init(
            id: "first_session",
            name: "FIRST W",
            description: "Complete your first lock-in session.",
            category: .focus,
            predicate: { $0.totalSessions >= 1 }
        ),
        .init(
            id: "focus_hour",
            name: "COOKED",
            description: "Lock in for 60 lifetime minutes.",
            category: .focus,
            predicate: { $0.totalFocusMinutes >= 60 }
        ),
        .init(
            id: "deep_focus",
            name: "DEMON TIME",
            description: "Reach 1,000 lifetime focus minutes (~16 hours of grind).",
            category: .focus,
            predicate: { $0.totalFocusMinutes >= 1_000 }
        ),
        .init(
            id: "total_concentration",
            name: "TOTAL CONCENTRATION",
            description: "Reach 5,000 lifetime focus minutes (~83 hours).",
            category: .focus,
            predicate: { $0.totalFocusMinutes >= 5_000 }
        ),
        .init(
            id: "master_focus",
            name: "DIFFERENT BREED",
            description: "Reach 10,000 lifetime focus minutes (~166 hours).",
            category: .focus,
            predicate: { $0.totalFocusMinutes >= 10_000 }
        ),

        // ── Discipline ──
        .init(
            id: "temptation_resisted",
            name: "UNFAZED",
            description: "Complete 5 discipline missions — temptation got nothing on you.",
            category: .discipline,
            predicate: { $0.totalDistractionsResisted >= 5 }
        ),
        .init(
            id: "super_saiyan",
            name: "SUPER SAIYAN",
            description: "Complete 25 discipline missions — power level rising.",
            category: .discipline,
            predicate: { $0.totalDistractionsResisted >= 25 }
        ),
        .init(
            id: "iron_will",
            name: "BUILT DIFFERENT",
            description: "Complete 50 discipline missions.",
            category: .discipline,
            predicate: { $0.totalDistractionsResisted >= 50 }
        ),

        // ── Execution ──
        .init(
            id: "getting_started",
            name: "WARMING UP",
            description: "Complete 5 missions.",
            category: .execution,
            predicate: { $0.totalMissionsCompleted >= 5 }
        ),
        .init(
            id: "mission_machine",
            name: "GRINDSET",
            description: "Complete 100 missions.",
            category: .execution,
            predicate: { $0.totalMissionsCompleted >= 100 }
        ),

        // ── Consistency ──
        .init(
            id: "three_day_streak",
            name: "ON A ROLL",
            description: "Maintain a 3-day streak.",
            category: .consistency,
            predicate: { $0.consecutiveStreak >= 3 }
        ),
        .init(
            id: "week_warrior",
            name: "FULL WEEK",
            description: "Maintain a 7-day streak.",
            category: .consistency,
            predicate: { $0.consecutiveStreak >= 7 }
        ),
        .init(
            id: "plus_ultra",
            name: "PLUS ULTRA",
            description: "Maintain a 14-day streak — going beyond the first-week barrier.",
            category: .consistency,
            predicate: { $0.consecutiveStreak >= 14 }
        ),
        .init(
            id: "month_runner",
            name: "AURA FARMER",
            description: "Maintain a 30-day streak — aura points secured.",
            category: .consistency,
            predicate: { $0.consecutiveStreak >= 30 }
        ),
        .init(
            id: "legend_streak",
            name: "UNDEFEATED",
            description: "Maintain a 90-day streak.",
            category: .consistency,
            predicate: { $0.consecutiveStreak >= 90 }
        ),
        .init(
            id: "perfect_w",
            name: "PERFECT W",
            description: "Stack your first perfect day — all 3 missions + focus goal cleared.",
            category: .consistency,
            predicate: { $0.totalPerfectDays >= 1 }
        ),
        .init(
            id: "perfect_week",
            name: "PERFECT WEEK",
            description: "Stack 7 perfect days lifetime.",
            category: .consistency,
            predicate: { $0.totalPerfectDays >= 7 }
        ),

        // ── Social ──
        .init(
            id: "guild_member",
            name: "REAL ONE",
            description: "Check in to your guild for the first time.",
            category: .social,
            predicate: { $0.guildCheckIns >= 1 }
        ),
        .init(
            id: "inviter",
            name: "GROUP LEADER",
            description: "Have someone redeem your guild invite code.",
            category: .social,
            predicate: { $0.invitesUsed >= 1 }
        ),
        .init(
            id: "certified_plug",
            name: "CERTIFIED PLUG",
            description: "Have 5 people redeem your guild invite code.",
            category: .social,
            predicate: { $0.invitesUsed >= 5 }
        ),

        // ── Rank ──
        .init(
            id: "rank_elite",
            name: "DIALED IN",
            description: "Reach the ELITE rank (10,000 XP).",
            category: .rank,
            predicate: { $0.totalRankXp >= 10_000 }
        ),
        .init(
            id: "domain_expansion",
            name: "DOMAIN EXPANSION",
            description: "Reach the PHANTOM rank (22,000 XP) — your focus domain has expanded.",
            category: .rank,
            predicate: { $0.totalRankXp >= 22_000 }
        ),
        .init(
            id: "rank_legend",
            name: "GOATED",
            description: "Reach the LEGEND rank (42,000 XP).",
            category: .rank,
            predicate: { $0.totalRankXp >= 42_000 }
        ),
        .init(
            id: "rank_locked_in",
            name: "FINAL FORM",
            description: "Reach the LOCKED IN rank (90,000 XP) — the peak.",
            category: .rank,
            predicate: { $0.totalRankXp >= 90_000 }
        ),
    ]

    public static let byId: [String: AchievementDefinition] = {
        Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })
    }()
}
