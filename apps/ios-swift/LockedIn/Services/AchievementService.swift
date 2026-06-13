//
//  AchievementService.swift
//  LockedIn
//
//  Evaluates `AchievementCatalog` predicates against the latest stats
//  snapshot, inserts newly-satisfied unlocks into `user_achievements`
//  via the `unlock_achievements(text[])` RPC, and broadcasts
//  `Notification.Name.achievementsUnlocked` so the UI can show a toast.
//
//  Call sites:
//   - `MainNavigator.handleSessionFinish` (after every session)
//   - `MissionsState.completeMission` (after every mission tap)
//
//  Both call paths funnel through `evaluate(_:)` — the service is
//  responsible for de-duping (server `ON CONFLICT DO NOTHING`) and
//  emitting at-most-once "first unlock" notifications.
//

import Foundation
import Supabase

/// Achievement evaluation context. Carries the bits that aren't on
/// `HomeService.UserStatsRow` — currently just the consecutive streak,
/// which lives on `HomeState` rather than on the server row.
public struct AchievementContext: Sendable {
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

extension Notification.Name {
    /// Posted on the main thread when `AchievementService.evaluate(_:)`
    /// successfully writes at least one new row into `user_achievements`.
    /// `userInfo["ids"]` is `[String]` of the newly-unlocked achievement ids.
    public static let achievementsUnlocked = Notification.Name("LockedIn.AchievementsUnlocked")
}

@MainActor
public enum AchievementService {
    private static let client: SupabaseClient = LockedInSupabase.shared.client

    /// Evaluate every predicate in `AchievementCatalog` against fresh stats
    /// + the supplied context. Sends the candidate ids to
    /// `unlock_achievements` — the server `ON CONFLICT DO NOTHING` handles
    /// de-duping. The returned (newly-unlocked) ids drive the unlock toast
    /// via `Notification.Name.achievementsUnlocked`.
    ///
    /// Zero-lag: this method refreshes `HomeService` cached stats before
    /// building the snapshot, so a threshold-crossing action unlocks on
    /// **this** call rather than the next one. The 300ms preamble gives
    /// the fire-and-forget `StatsService.bumpStatXp` / `bumpCounter` tasks
    /// kicked off by the same call site time to land server-side before
    /// the SELECT.
    ///
    /// Fire-and-forget: errors are logged but not surfaced — achievements
    /// are a nice-to-have, not a critical-path operation.
    public static func evaluate(_ ctx: AchievementContext) {
        // PostHog telemetry fires upfront so we capture the eval intent
        // even if the network path below fails.
        AnalyticsService.shared.track("Achievement Eval", properties: [
            "consecutive_streak": ctx.consecutiveStreak,
            "lifetime_runs": ctx.lifetimeRunsCompleted,
            "lifetime_minutes": ctx.lifetimeTotalMinutes,
            "daily_goal_met": ctx.dailyGoalMet,
        ])

        Task {
            // Brief grace period before the SELECT — the bump RPCs from
            // the same call site are typed `Task { try await ... }` queues,
            // so they're racing this refresh. 300ms is enough for a normal
            // round-trip; longer than necessary on a fast network but
            // invisible to the user (they're still on the mission tab
            // watching the completion animation).
            try? await Task.sleep(for: .milliseconds(300))

            if let uid = try? await currentUserIdString() {
                _ = try? await HomeService.shared.refreshStats(userId: uid)
            }

            let snapshot = makeSnapshot(ctx: ctx)
            let candidates = AchievementCatalog.all
                .filter { $0.predicate(snapshot) }
                .map { $0.id }

            guard !candidates.isEmpty else { return }

            do {
                struct Params: Encodable { let p_ids: [String] }
                let response: [String] = try await client.rpc(
                    "unlock_achievements",
                    params: Params(p_ids: candidates)
                )
                .execute()
                .value

                guard !response.isEmpty else { return }

                // Per-unlock analytics so we can attribute usage to milestones.
                for id in response {
                    AnalyticsService.shared.track("Achievement Unlocked", properties: [
                        "achievement_id": id,
                    ])
                }

                NotificationCenter.default.post(
                    name: .achievementsUnlocked,
                    object: nil,
                    userInfo: ["ids": response]
                )
            } catch {
                print("[AchievementService] evaluate failed: \(error)")
            }
        }
    }

    /// Fetch the user's earned achievement ids from `user_achievements`.
    /// Returns an empty set on error (logging) so the UI can keep rendering
    /// the locked placeholders.
    public static func fetchEarnedIds() async -> Set<String> {
        do {
            struct Row: Decodable { let achievement_id: String }
            let rows: [Row] = try await client
                .from("user_achievements")
                .select("achievement_id")
                .eq("user_id", value: try await currentUserIdString())
                .execute()
                .value
            return Set(rows.map { $0.achievement_id })
        } catch {
            print("[AchievementService] fetchEarnedIds failed: \(error)")
            return []
        }
    }

    // MARK: - Internals

    private static func currentUserIdString() async throws -> String {
        let session = try await client.auth.session
        return session.user.id.uuidString.lowercased()
    }

    private static func makeSnapshot(ctx: AchievementContext) -> AchievementEvalSnapshot {
        let stats = HomeService.shared.getCachedStats()
        return AchievementEvalSnapshot(
            consecutiveStreak: ctx.consecutiveStreak,
            totalRankXp: stats?.totalRankXp ?? 0,
            totalFocusMinutes: stats?.totalFocusMinutes ?? 0,
            totalSessions: stats?.totalSessions ?? 0,
            totalCompletedSessions: stats?.totalCompletedSessions ?? 0,
            totalMissionsCompleted: stats?.totalMissionsCompleted ?? 0,
            totalDistractionsResisted: stats?.totalDistractionsResisted ?? 0,
            totalPerfectDays: stats?.totalPerfectDays ?? 0,
            totalStreakDays: stats?.totalStreakDays ?? 0,
            invitesUsed: stats?.invitesUsed ?? 0,
            guildCheckIns: stats?.guildCheckIns ?? 0
        )
    }
}
