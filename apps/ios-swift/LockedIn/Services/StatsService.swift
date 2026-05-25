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
}
