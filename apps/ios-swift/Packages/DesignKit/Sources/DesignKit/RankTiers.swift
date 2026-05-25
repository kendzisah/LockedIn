import SwiftUI

/// Rank progression — 9 tiers driven by current_streak_days.
///
/// Mirrors the SQL CASE in `00011_user_stats.sql` `recompute_user_stats()`.
/// Colors reuse the existing streakTiers palette for visual continuity.
///
/// Ported 1:1 from `apps/mobile/src/design/rankTiers.ts`.
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
    public let minDays: Int
    public let color: Color
    public let colorHex: String

    public init(id: RankId, name: String, minDays: Int, colorHex: String) {
        self.id = id
        self.name = name
        self.minDays = minDays
        self.colorHex = colorHex
        self.color = Color(hex: colorHex)
    }
}

public enum RankTiers {
    public static let all: [RankTier] = [
        RankTier(id: .npc,      name: "NPC",       minDays: 0,   colorHex: "#8B8B8B"),
        RankTier(id: .grinder,  name: "RECRUIT",   minDays: 3,   colorHex: "#4A7FB5"),
        RankTier(id: .rising,   name: "RISING",    minDays: 7,   colorHex: "#00C2FF"),
        RankTier(id: .chosen,   name: "CHOSEN",    minDays: 14,  colorHex: "#00D68F"),
        RankTier(id: .elite,    name: "ELITE",     minDays: 30,  colorHex: "#FFC857"),
        RankTier(id: .phantom,  name: "PHANTOM",   minDays: 60,  colorHex: "#FF4757"),
        RankTier(id: .legend,   name: "LEGEND",    minDays: 90,  colorHex: "#A855F7"),
        RankTier(id: .goat,     name: "GOAT",      minDays: 180, colorHex: "#E0E7FF"),
        RankTier(id: .lockedIn, name: "LOCKED IN", minDays: 365, colorHex: "#FF006E"),
    ]

    public static let byId: [RankId: RankTier] = {
        Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })
    }()
}
