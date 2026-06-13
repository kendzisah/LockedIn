//
//  StatsService.swift
//  LockedIn
//
//  Thin wrapper around `HomeService` for the cross-feature stat surface.
//  W4 (Missions) and W11 (Session) reference `StatsService.bumpCounter(...)` /
//  `StatsService.recompute(userId:)`; this file just forwards to the W3-owned
//  service so callers don't have to import HomeService directly.
//
//  RN parity: `apps/mobile/src/services/StatsService.ts` is a thin wrapper
//  over the same RPCs (`bump_user_stat`, `recompute_user_stats`), so this
//  Swift port stays equally thin.
//

import Foundation

@MainActor
public enum StatsService {
    /// Re-exports `HomeService.CounterField` so call sites can write
    /// `StatsService.CounterField.totalFocusMinutes` without depending on
    /// HomeService directly.
    public typealias CounterField = HomeService.CounterField
    public typealias StatXpKind = HomeService.StatXpKind

    /// Bump a `user_stats` counter via the `bump_user_stat` RPC. Errors are
    /// logged and swallowed — the RN service treats these as fire-and-forget.
    public static func bumpCounter(_ field: CounterField, delta: Int = 1) {
        Task {
            do {
                try await HomeService.shared.bumpCounter(field: field, delta: delta)
            } catch {
                print("[StatsService] bumpCounter(\(field.rawValue)) failed: \(error)")
            }
        }
    }

    /// Bump per-stat XP via the `bump_stat_xp` RPC. Fire-and-forget; this is
    /// the unified post-migration path — every stat-growth action funnels
    /// through here.
    public static func bumpStatXp(_ kind: StatXpKind, delta: Int) {
        guard delta != 0 else { return }
        Task {
            do {
                try await HomeService.shared.bumpStatXp(kind: kind, delta: delta)
            } catch {
                print("[StatsService] bumpStatXp(\(kind.rawValue), \(delta)) failed: \(error)")
            }
        }
    }

    /// Force `recompute_user_stats` to run server-side. Returns once the
    /// response cache is updated.
    @discardableResult
    public static func recompute(userId: String) async -> HomeService.RecomputeRow? {
        do {
            return try await HomeService.shared.recompute(userId: userId)
        } catch {
            print("[StatsService] recompute failed: \(error)")
            return nil
        }
    }

    /// Push the current consecutive-streak value to the server via
    /// `set_user_streak`. Server also bumps `longest_streak_days` via
    /// `GREATEST(...)`.
    public static func setStreak(_ days: Int) {
        Task {
            do {
                try await HomeService.shared.setStreak(days)
            } catch {
                print("[StatsService] setStreak failed: \(error)")
            }
        }
    }

    /// Recompute derived `user_stats` columns (rank_id / ovr) for the currently
    /// authenticated user, resolving the id from the Supabase session. No-op
    /// when signed out. The recompute RPC itself keys off `auth.uid()`; the id
    /// is only used to re-pull the local cache afterward.
    public static func recomputeCurrentUser() async {
        guard let session = try? await LockedInSupabase.shared.client.auth.session else { return }
        _ = await recompute(userId: session.user.id.uuidString)
    }

    /// Persist the streak THEN recompute derived columns — sequenced so the
    /// `recompute_user_stats` RPC reads the just-written `current_streak_days`
    /// (and thus writes a fresh streak-derived `rank_id`). Fire-and-forget
    /// `setStreak` + `recompute` would race and leave rank_id stale.
    public static func setStreakAndRecompute(_ days: Int) async {
        do {
            try await HomeService.shared.setStreak(days)
        } catch {
            print("[StatsService] setStreak failed: \(error)")
        }
        await recomputeCurrentUser()
    }
}
