import Foundation
import Supabase
import DesignKit

/// HomeService — Supabase reads + RPCs that drive the Home tab.
///
/// Backend contract is frozen — table names, RPC names, and return shapes are
/// pinned in `apps/ios-swift/MIGRATION_BACKEND_INVENTORY.md`. This service
/// owns the calls that the RN `SystemStatusBar` + `StatsService` made:
///   - `.from('profiles').select('display_name, avatar_url').eq('id', uid).maybeSingle()`
///   - `.from('user_stats').select('*').eq('user_id', uid).maybeSingle()` (StatsService cache miss)
///   - `.rpc('recompute_user_stats')`
///   - `.rpc('bump_user_stat', { p_field, p_delta })`
///   - `.rpc('set_user_streak', { p_current_streak_days })`
///
/// Pinned to `@MainActor` because the cached row is consumed by SwiftUI views
/// — keeping it main-isolated avoids cross-actor hops on every render.
@MainActor
public final class HomeService {
    public static let shared = HomeService()

    private let client: SupabaseClient
    private var cachedStats: UserStatsRow?
    private var subscribers: [(UserStatsRow?) -> Void] = []

    private init(client: SupabaseClient = LockedInSupabase.shared.client) {
        self.client = client
    }

    // MARK: - Models

    /// Subset of `profiles` columns we read for the Home HUD.
    public struct ProfileRow: Codable, Equatable, Sendable {
        public let displayName: String?
        public let avatarUrl: String?

        enum CodingKeys: String, CodingKey {
            case displayName = "display_name"
            case avatarUrl = "avatar_url"
        }
    }

    /// Subset of `user_stats` columns that the SystemStatusBar surfaces. The
    /// row has more columns server-side; we ignore unknown keys.
    ///
    /// Schema source: `supabase/migrations/00011_user_stats.sql`.
    public struct UserStatsRow: Codable, Equatable, Sendable {
        public let userId: String?
        public let discipline: Int?
        public let focus: Int?
        public let execution: Int?
        public let consistency: Int?
        public let social: Int?
        public let ovr: Int?
        public let rankId: String?
        public let currentStreakDays: Int?
        public let longestStreakDays: Int?
        public let totalFocusMinutes: Int?
        public let totalSessions: Int?
        public let totalCompletedSessions: Int?
        public let totalBlockedAttempts: Int?
        public let totalDistractionsResisted: Int?
        public let totalMissionsCompleted: Int?
        public let totalPerfectDays: Int?
        public let totalStreakDays: Int?
        public let invitesUsed: Int?
        public let guildCheckIns: Int?
        public let totalXp: Int?

        enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case discipline
            case focus
            case execution
            case consistency
            case social
            case ovr
            case rankId = "rank_id"
            case currentStreakDays = "current_streak_days"
            case longestStreakDays = "longest_streak_days"
            case totalFocusMinutes = "total_focus_minutes"
            case totalSessions = "total_sessions"
            case totalCompletedSessions = "total_completed_sessions"
            case totalBlockedAttempts = "total_blocked_attempts"
            case totalDistractionsResisted = "total_distractions_resisted"
            case totalMissionsCompleted = "total_missions_completed"
            case totalPerfectDays = "total_perfect_days"
            case totalStreakDays = "total_streak_days"
            case invitesUsed = "invites_used"
            case guildCheckIns = "guild_check_ins"
            case totalXp = "total_xp"
        }

        public func value(forStat stat: Stat) -> Int {
            switch stat {
            case .discipline:  return discipline ?? 1
            case .focus:       return focus ?? 1
            case .execution:   return execution ?? 1
            case .consistency: return consistency ?? 1
            case .social:      return social ?? 1
            }
        }
    }

    /// Return shape of `recompute_user_stats()`. The RPC returns a `TABLE`
    /// with one row; the Supabase Swift client surfaces it as an array.
    public struct RecomputeRow: Codable, Sendable {
        public let discipline: Int?
        public let focus: Int?
        public let execution: Int?
        public let consistency: Int?
        public let social: Int?
        public let ovr: Int?
        public let rankId: String?

        enum CodingKeys: String, CodingKey {
            case discipline, focus, execution, consistency, social, ovr
            case rankId = "rank_id"
        }
    }

    // MARK: - Bump-stat whitelist
    //
    // Mirror of the SECURITY DEFINER whitelist in `bump_user_stat`. Keeping
    // the list typed in Swift catches typos at compile time.
    public enum CounterField: String, Sendable {
        case totalFocusMinutes        = "total_focus_minutes"
        case totalSessions            = "total_sessions"
        case totalCompletedSessions   = "total_completed_sessions"
        case totalBlockedAttempts     = "total_blocked_attempts"
        case totalDistractionsResisted = "total_distractions_resisted"
        case totalMissionsCompleted   = "total_missions_completed"
        case totalPerfectDays         = "total_perfect_days"
        case totalStreakDays          = "total_streak_days"
        case invitesUsed              = "invites_used"
        case guildCheckIns            = "guild_check_ins"
        case totalXp                  = "total_xp"
    }

    // MARK: - Profile read

    /// `.from('profiles').select('display_name, avatar_url').eq('id', uid).maybeSingle()`.
    /// Mirrors `apps/mobile/src/features/home/components/SystemStatusBar.tsx:99-104`.
    public func fetchProfile(userId: String) async throws -> ProfileRow? {
        let response: ProfileRow? = try await client
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", value: userId)
            .single()
            .execute()
            .value
        return response
    }

    // MARK: - user_stats read + cache

    /// Read the cached `UserStatsRow`. Synchronous accessor for view init.
    public func getCachedStats() -> UserStatsRow? {
        cachedStats
    }

    /// Force a refresh of `user_stats` from Supabase. Updates the local cache
    /// and notifies all subscribers.
    public func refreshStats(userId: String) async throws -> UserStatsRow? {
        let response: UserStatsRow? = try await client
            .from("user_stats")
            .select("*")
            .eq("user_id", value: userId)
            .single()
            .execute()
            .value
        cachedStats = response
        notifyAll(response)
        return response
    }

    /// Subscribe to `cachedStats` updates. Returns a token; pass it to
    /// `unsubscribe(token:)` to stop receiving callbacks.
    @discardableResult
    public func subscribe(_ handler: @escaping (UserStatsRow?) -> Void) -> Int {
        subscribers.append(handler)
        // Replay current cached value immediately so the view doesn't see a
        // flash of "loading" when stats are already in memory.
        handler(cachedStats)
        return subscribers.count - 1
    }

    public func unsubscribe(token: Int) {
        guard token < subscribers.count else { return }
        subscribers.remove(at: token)
    }

    private func notifyAll(_ row: UserStatsRow?) {
        for handler in subscribers { handler(row) }
    }

    // MARK: - RPCs

    /// `.rpc('bump_user_stat', { p_field, p_delta })`. Fire-and-forget; errors
    /// are surfaced via `throws`.
    public func bumpCounter(field: CounterField, delta: Int) async throws {
        struct Params: Encodable { let p_field: String; let p_delta: Int }
        try await client.rpc(
            "bump_user_stat",
            params: Params(p_field: field.rawValue, p_delta: delta)
        ).execute()
    }

    /// `.rpc('set_user_streak', { p_current_streak_days })`. Server bumps
    /// `longest_streak_days = GREATEST(...)`.
    public func setStreak(_ currentStreakDays: Int) async throws {
        struct Params: Encodable { let p_current_streak_days: Int }
        try await client.rpc(
            "set_user_streak",
            params: Params(p_current_streak_days: currentStreakDays)
        ).execute()
    }

    /// `.rpc('recompute_user_stats')`. Returns the freshly-computed
    /// `{discipline, focus, execution, consistency, social, ovr, rank_id}` row.
    /// On success we also re-read `user_stats` (the recompute writes those
    /// columns) so the cache stays accurate.
    @discardableResult
    public func recompute(userId: String) async throws -> RecomputeRow? {
        let rows: [RecomputeRow] = try await client.rpc("recompute_user_stats")
            .execute()
            .value
        // Re-pull the row so the cached snapshot includes counters too.
        _ = try await refreshStats(userId: userId)
        return rows.first
    }
}
