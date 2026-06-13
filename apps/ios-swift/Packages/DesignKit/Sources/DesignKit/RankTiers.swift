import SwiftUI

/// Rank progression — 9 tiers driven by **total rank XP** (sum of the five
/// per-stat XP buckets). Streaks no longer gate rank-ups directly; they
/// accelerate XP earn instead, so consistency is rewarded without making
/// "miss a day, lose a rank" the gameplay.
///
/// Calibration target: a consistent user (hits daily focus goal + completes
/// missions every day, accumulates a multi-month streak) reaches LOCKED IN
/// around month 10 (~300 days). At ~280 XP/day baseline plus the streak
/// multiplier in `RankHelpers.streakXpMultiplier`, this lands in the
/// 270-330 day window.
public enum RankId: String, CaseIterable, Codable, Sendable {
    case npc
    case grinder
    case rising
    case chosen
    case elite
    case phantom
    case legend
    case goat
    case lockedIn = "locked_in"
}

public struct RankTier: Equatable, Sendable, Identifiable {
    public let id: RankId
    public let name: String
    /// Minimum total rank XP required to reach this tier. XP is computed
    /// client-side as `focus_xp + discipline_xp + execution_xp + consistency_xp + social_xp`.
    public let minXp: Int
    public let color: Color
    public let colorHex: String

    public init(id: RankId, name: String, minXp: Int, colorHex: String) {
        self.id = id
        self.name = name
        self.minXp = minXp
        self.colorHex = colorHex
        self.color = Color(hex: colorHex)
    }
}

public enum RankTiers {
    public static let all: [RankTier] = [
        RankTier(id: .npc,      name: "NPC",       minXp: 0,      colorHex: "#8B8B8B"),
        RankTier(id: .grinder,  name: "RECRUIT",   minXp: 100,    colorHex: "#4A7FB5"),
        RankTier(id: .rising,   name: "RISING",    minXp: 800,    colorHex: "#00C2FF"),
        RankTier(id: .chosen,   name: "CHOSEN",    minXp: 3_000,  colorHex: "#00D68F"),
        RankTier(id: .elite,    name: "ELITE",     minXp: 10_000, colorHex: "#FFC857"),
        RankTier(id: .phantom,  name: "PHANTOM",   minXp: 22_000, colorHex: "#FF4757"),
        RankTier(id: .legend,   name: "LEGEND",    minXp: 42_000, colorHex: "#A855F7"),
        RankTier(id: .goat,     name: "GOAT",      minXp: 65_000, colorHex: "#E0E7FF"),
        RankTier(id: .lockedIn, name: "LOCKED IN", minXp: 90_000, colorHex: "#FF006E"),
    ]

    public static let byId: [RankId: RankTier] = {
        Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })
    }()
}
