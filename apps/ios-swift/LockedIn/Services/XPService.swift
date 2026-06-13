//
//  XPService.swift
//  LockedIn
//
//  Lightweight XP awarder. Mirrors `apps/mobile/src/services/XPService.ts`.
//  - Stores cumulative XP per local user in `UserDefaults`
//    (`@lockedin/cumulative_xp`, already owned by the Missions feature).
//  - Emits a PostHog `XP Awarded` event per call.
//
//  Server-side mirror lives in `user_stats.total_xp` via the
//  `bump_user_stat('total_xp', ...)` RPC — fire that alongside the local
//  bump for parity.
//

import Foundation

/// XP event kinds. Mirrors `XPEvent` from the RN `XPService`.
public enum XPEvent: String, Sendable {
    case session
    case mission
    case perfectDay = "perfect_day"
    case streakMilestone = "streak_milestone"
    case guildJoin = "guild_join"
}

@MainActor
public enum XPService {
    public static let cumulativeKey = "@lockedin/cumulative_xp"

    /// Award XP for the given event. The amount is fixed per event kind to
    /// match RN — see `apps/mobile/src/services/XPService.ts:14-22`.
    public static func award(_ event: XPEvent) {
        let amount = xpAmount(for: event)
        let rawStr = Defaults.string(cumulativeKey) ?? "0"
        let current = Int(rawStr) ?? 0
        let next = current + amount
        Defaults.setString(String(next), cumulativeKey)

        // Server-side mirror.
        StatsService.bumpCounter(.totalXp, delta: amount)

        AnalyticsService.shared.track("XP Awarded", properties: [
            "event": event.rawValue,
            "amount": amount,
            "total": next,
        ])
    }

    /// Read current cumulative XP from local storage.
    public static func current() -> Int {
        let raw = Defaults.string(cumulativeKey) ?? "0"
        return Int(raw) ?? 0
    }

    private static func xpAmount(for event: XPEvent) -> Int {
        switch event {
        case .session:          return 10
        case .mission:          return 25
        case .perfectDay:       return 50
        case .streakMilestone:  return 100
        case .guildJoin:        return 30
        }
    }
}
