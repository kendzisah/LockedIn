//
//  StatTiers.swift
//  DesignKit
//
//  Letter-tier rank (F- through S+) for the five primary character stats.
//  Threshold tables and helpers are LOCKED per the Wave 0 fleet briefing —
//  do not edit without coordinating the rollout (changing a threshold here
//  silently re-ranks every existing user).
//
//  Color palette mirrors the rank tier colors so the same gray→purple
//  progression carries across the rank and the per-stat letter tiers.
//

import SwiftUI

/// Letter tier rank for a single character stat (DIS, FOC, EXE, CON, SOC).
/// 17 tiers, F- through S+. Comparable by ordinal index.
public enum StatTier: String, CaseIterable, Sendable, Comparable {
    case fMinus = "F-"
    case f = "F"
    case fPlus = "F+"
    case dMinus = "D-"
    case d = "D"
    case dPlus = "D+"
    case cMinus = "C-"
    case c = "C"
    case cPlus = "C+"
    case bMinus = "B-"
    case b = "B"
    case bPlus = "B+"
    case aMinus = "A-"
    case a = "A"
    case aPlus = "A+"
    case s = "S"
    case sPlus = "S+"

    /// 0-based index in ascending order.
    public var ordinal: Int {
        Self.allCases.firstIndex(of: self) ?? 0
    }

    public static func < (lhs: StatTier, rhs: StatTier) -> Bool {
        lhs.ordinal < rhs.ordinal
    }

    /// Per-tier accent color used by the bar fill + letter label.
    /// Mirrors the rank tier palette.
    public var color: Color {
        switch self {
        case .fMinus, .f, .fPlus:   return Color(hex: "#8B8B8B")
        case .dMinus, .d, .dPlus:   return Color(hex: "#4A7FB5")
        case .cMinus, .c, .cPlus:   return Color(hex: "#00C2FF")
        case .bMinus, .b, .bPlus:   return Color(hex: "#00D68F")
        case .aMinus, .a, .aPlus:   return Color(hex: "#FFC857")
        case .s:                    return Color(hex: "#A855F7")
        case .sPlus:                return Color(hex: "#FF006E") // base color; S+ also gets shimmer overlay
        }
    }

    /// True when at peak tier — UI should layer the multi-color shimmer.
    public var isPeak: Bool { self == .sPlus }

    /// True for the "specialty" band — B+ and up. These tiers render with a
    /// luminous colored glow so reaching them visibly stands out from the
    /// flat F–B grades.
    public var isLuminous: Bool { self >= .bPlus }
}

public extension View {
    /// Apply a luminous colored glow to a letter-tier label, but only for
    /// "specialty" tiers (B+ and up). A no-op for lower tiers, so the glow
    /// itself signals achievement. `strength` scales the radius for hero
    /// elements (e.g. the big Day-90 grade).
    @ViewBuilder
    func luminousTierGlow(_ tier: StatTier, strength: CGFloat = 1.0) -> some View {
        if tier.isLuminous {
            self
                .shadow(color: tier.color.opacity(0.9), radius: 9 * strength)
                .shadow(color: tier.color.opacity(0.5), radius: 4 * strength)
        } else {
            self
        }
    }
}

/// Counter source identifier — one per stat axis.
public enum StatCounterKind: Sendable, CaseIterable {
    case focus
    case discipline
    case execution
    case consistency
    case social
}

/// Static threshold tables and helpers for mapping raw `user_stats` counter
/// values to letter tiers.
///
/// Thresholds are LOCKED per the fleet briefing. Each table has exactly 17
/// entries (one per `StatTier.allCases`), ascending.
public enum StatTierTable {

    /// Unified XP threshold table — identical across all 5 stats. Each
    /// stat owns its own XP bucket on the server (`focus_xp`, `discipline_xp`,
    /// etc.), and earn rates are tuned per stat to balance progression speed.
    ///
    /// S+ ceiling = 35,000 XP. Calibration targets:
    ///  - Casual user (avg ~75 XP/day per active stat): S+ at ~1.3 years.
    ///  - Max-grind FOC (180 XP/day daily cap): S+ at ~195 days.
    ///  - First rank-up (F- → F): 50 XP — one daily-goal-met (CON) or
    ///    two Pomodoros (FOC).
    private static let unifiedThresholds: [Int] = [
        0, 50, 150, 350, 700, 1300, 2100, 3200, 4600,
        6400, 8500, 11000, 14000, 17500, 22000, 28000, 35000
    ]

    /// Threshold values for each tier, indexed by `StatTier.ordinal`.
    /// All 5 stats share the same XP curve — captions read identically
    /// ("0/50 to F") across every stat axis.
    public static func thresholds(for kind: StatCounterKind) -> [Int] {
        // `kind` retained on the signature for forward-compat (in case
        // per-stat curves return). Today every kind resolves to the same
        // unified XP table.
        _ = kind
        return unifiedThresholds
    }

    /// Returns the current tier for a raw counter value.
    public static func tier(for counter: Int, kind: StatCounterKind) -> StatTier {
        let t = thresholds(for: kind)
        // Walk from highest to lowest, return first tier whose threshold ≤ counter.
        for (idx, threshold) in t.enumerated().reversed() {
            if counter >= threshold {
                return StatTier.allCases[idx]
            }
        }
        return .fMinus
    }

    /// Returns the inclusive counter range for the current tier:
    /// `(currentTierStart, nextTierStart)`. `next` is `nil` if at S+.
    public static func progress(for counter: Int, kind: StatCounterKind)
        -> (current: Int, next: Int?)
    {
        let t = thresholds(for: kind)
        let currentTier = tier(for: counter, kind: kind)
        let idx = currentTier.ordinal
        let currentStart = t[idx]
        let nextStart = idx + 1 < t.count ? t[idx + 1] : nil
        return (currentStart, nextStart)
    }

    /// Fraction of the way through the current tier (0.0–1.0). At S+, always 1.0.
    public static func fractionWithinTier(counter: Int, kind: StatCounterKind) -> Double {
        let p = progress(for: counter, kind: kind)
        guard let next = p.next else { return 1.0 }
        let span = next - p.current
        guard span > 0 else { return 1.0 }
        let progressIn = counter - p.current
        return min(1.0, max(0.0, Double(progressIn) / Double(span)))
    }

    /// Text label for the "x/y to NEXT" caption, or "MAX" at S+.
    public static func progressLabel(counter: Int, kind: StatCounterKind) -> String {
        let p = progress(for: counter, kind: kind)
        guard let next = p.next else { return "MAX" }
        let current = tier(for: counter, kind: kind)
        let nextTierIdx = current.ordinal + 1
        guard nextTierIdx < StatTier.allCases.count else { return "MAX" }
        let nextTier = StatTier.allCases[nextTierIdx]
        let progressIn = counter - p.current
        let span = next - p.current
        return "\(progressIn)/\(span) to \(nextTier.rawValue)"
    }
}

/// OVR letter tier — average of the 5 stat tiers' ordinals, floored.
public enum OvrTier {
    public static func compute(_ tiers: [StatTier]) -> StatTier {
        guard !tiers.isEmpty else { return .fMinus }
        let sum = tiers.map { $0.ordinal }.reduce(0, +)
        let avg = sum / tiers.count // integer floor
        let clamped = max(0, min(StatTier.allCases.count - 1, avg))
        return StatTier.allCases[clamped]
    }
}
