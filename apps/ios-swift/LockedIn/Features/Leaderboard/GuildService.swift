import Foundation
import Supabase
import DesignKit

/// Typed outcome for `GuildService.leaveGuild` / `GuildState.leaveGuild`.
///
/// Previously the leave path returned a raw `Bool` — falsey paths (owner
/// block, missing membership, network error) all collapsed into the same
/// silent dismissal in `GuildDetailScreen`. This enum lets the UI surface
/// the right alert per failure mode.
public enum LeaveResult: Sendable, Equatable {
    case success
    case ownerCannotLeave
    case notMember
    case networkError(String)
}

/// GuildService — Swift port of
/// `apps/mobile/src/features/leaderboard/GuildService.ts`.
///
/// Wraps every Supabase call the Guild feature makes. Backend contract is
/// frozen (see `apps/ios-swift/MIGRATION_BACKEND_INVENTORY.md`):
///
/// Tables read/written:
///   - `guild_members` — SELECT my memberships, SELECT for guildmates, DELETE on leave
///   - `guilds`        — SELECT details + meta, DELETE on owner-delete
///   - `guild_scores`  — SELECT per-week scores
///   - `profiles`      — SELECT `id, display_name, avatar_url` for member rows
///   - `user_stats`    — SELECT `user_id, ovr, rank_id` for member OVR badges
///
/// RPCs (exact name + arg shape):
///   - `create_guild({ guild_name })` → `{ guild_id, invite_code, name }`
///   - `join_guild({ code })`         → `{ guild_id, guild_name, joined }`
///   - `kick_guild_member({ target_guild_id, target_user_id })` → void
///
/// Edge function:
///   - `complete-mission` — exposed here as
///     `completeMissionServerSide(focusMinutes:missionsDone:streakDays:)`.
///     Worker W11 (Session) calls this from `SessionCompleteScreen` after a
///     session completes; the server upserts per-guild weekly scores.
///
/// Persisted keys (preserved verbatim from RN):
///   - `@lockedin/guild_month_stats` — `MonthlyGuildStats` JSON
///   - `@lockedin/has_active_guild`  — boolean string `'true' / 'false'`
public final class GuildService {
    public static let shared = GuildService()

    // MARK: - Persisted key names (match RN exactly)

    /// Weekly stats JSON. (`GuildService.ts:4`).
    public static let monthStatsKey = "@lockedin/guild_month_stats"

    /// Boolean string flag for notification scheduling. (`GuildService.ts:7`).
    public static let hasActiveGuildKey = "@lockedin/has_active_guild"

    /// Per-user cached rank snapshot, written by GuildDetail on Analytics emit.
    /// (`GuildDetailScreen.tsx:111`).
    public static let cachedRankKey = "@lockedin/crew_cached_rank"

    // MARK: - Models (mirror RN return shapes verbatim)

    public struct MyGuildRow: Codable, Equatable, Sendable, Identifiable {
        public var id: String { guild_id }
        public let guild_id: String
        public let name: String
        public let invite_code: String
        public let owner_id: String
        public let member_count: Int
        public let my_rank: Int
        public let my_score: Int
        public let top_score: Int
    }

    public struct GuildDetails: Codable, Equatable, Sendable {
        public let name: String
        public let invite_code: String
        public let owner_id: String
        public let member_count: Int
        public let max_members: Int
        public let created_at: String
    }

    public struct GuildLeaderboardEntry: Codable, Equatable, Sendable, Identifiable {
        public var id: String { user_id }
        public let user_id: String
        public let username: String
        public let avatar_url: String?
        public let rank: Int
        public let focus_minutes: Int
        public let missions_done: Int
        public let streak_days: Int
        public let total_score: Int
        public let is_current_user: Bool
        /// Member's overall letter tier (F- … S+), derived from per-stat XP via
        /// `OvrTier`. Nil when no `user_stats` row yet. Replaces the legacy
        /// numeric OVR — the app shows overall *letters* everywhere now.
        public let ovr_tier: String?
        /// Member's RankId from `user_stats`. Nil when no row yet.
        public let rank_id: String?
    }

    public struct CreateGuildResult: Codable, Equatable, Sendable {
        public let guild_id: String
        public let invite_code: String
        public let name: String
    }

    public struct JoinGuildResult: Codable, Equatable, Sendable {
        public let guild_id: String
        public let guild_name: String
        public let joined: Bool
    }

    public struct MonthlyGuildStats: Codable, Equatable, Sendable {
        public var period_key: String
        public var focus_minutes: Int
        public var missions_done: Int
        public var streak_days: Int

        public init(period_key: String, focus_minutes: Int = 0, missions_done: Int = 0, streak_days: Int = 0) {
            self.period_key = period_key
            self.focus_minutes = focus_minutes
            self.missions_done = missions_done
            self.streak_days = streak_days
        }
    }

    public struct CompleteMissionOutcome: Sendable {
        public let success: Bool
        /// Non-nil on failure. Known codes: `"time_gate_locked"`, `"network_error"`.
        public let error: String?
    }

    // MARK: - Init

    private let client: SupabaseClient

    private init(client: SupabaseClient = LockedInSupabase.shared.client) {
        self.client = client
    }

    // MARK: - Month period key (matches the server edge function)

    /// Calendar-month key from the UTC clock (`YYYY-MM`), matching the server
    /// `complete-mission` edge function. Guild scores are bucketed per month;
    /// the leaderboard resets at the UTC month boundary (1st, 00:00 UTC).
    ///
    /// (Stored in the `guild_scores.week_key` column — the column name is
    /// legacy; the value is now a month key, not an ISO week.)
    public static func currentMonthKey(now: Date = Date()) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let components = cal.dateComponents([.year, .month], from: now)
        let year = components.year ?? 1970
        let month = components.month ?? 1
        return String(format: "%04d-%02d", year, month)
    }

    // MARK: - Active-guild flag sync

    /// Updates `@lockedin/has_active_guild` from the network.
    /// `hadGuildBefore` reads storage *before* sync, so callers can detect
    /// first-guild transitions (used to schedule the first-guild notification).
    public func syncHasActiveGuildFlag() async -> (hadGuildBefore: Bool, hasGuildNow: Bool) {
        let hadGuildBefore = (Defaults.string(Self.hasActiveGuildKey) ?? "false") == "true"
        do {
            let guilds = try await getMyGuildsThrowing()
            let hasGuildNow = !guilds.isEmpty
            Defaults.setString(hasGuildNow ? "true" : "false", Self.hasActiveGuildKey)
            return (hadGuildBefore, hasGuildNow)
        } catch {
            print("[GuildService] syncHasActiveGuildFlag failed:", error)
            return (hadGuildBefore, hadGuildBefore)
        }
    }

    // MARK: - getMyGuilds

    public func getMyGuilds() async -> [MyGuildRow] {
        do {
            return try await getMyGuildsThrowing()
        } catch {
            print("[GuildService] getMyGuilds failed:", error)
            return []
        }
    }

    private struct MembershipRow: Decodable { let guild_id: String }
    private struct GuildRow: Decodable {
        let id: String
        let name: String
        let invite_code: String
        let owner_id: String
    }
    private struct WeekScoreRow: Decodable {
        let guild_id: String
        let user_id: String
        let total_score: Int
    }

    private func getMyGuildsThrowing() async throws -> [MyGuildRow] {
        guard let userId = try? await currentUserId() else { return [] }

        // 1) memberships
        let memberships: [MembershipRow] = try await client
            .from("guild_members")
            .select("guild_id")
            .eq("user_id", value: userId)
            .execute()
            .value
        if memberships.isEmpty { return [] }

        let guildIds = Array(Set(memberships.map { $0.guild_id }))

        // 2) guild rows
        let guilds: [GuildRow] = try await client
            .from("guilds")
            .select("id, name, invite_code, owner_id")
            .in("id", values: guildIds)
            .execute()
            .value
        if guilds.isEmpty { return [] }

        let monthKey = Self.currentMonthKey()

        // 3) member-count by guild (one query, count clientside)
        let allMembers: [MembershipRow] = try await client
            .from("guild_members")
            .select("guild_id")
            .in("guild_id", values: guildIds)
            .execute()
            .value
        var memberCountByGuild: [String: Int] = [:]
        for row in allMembers {
            memberCountByGuild[row.guild_id, default: 0] += 1
        }

        // 4) week scores
        let weekScores: [WeekScoreRow] = try await client
            .from("guild_scores")
            .select("guild_id, user_id, total_score")
            .in("guild_id", values: guildIds)
            .eq("week_key", value: monthKey)
            .execute()
            .value

        var scoresByGuild: [String: [(user_id: String, total_score: Int)]] = [:]
        for row in weekScores {
            scoresByGuild[row.guild_id, default: []].append((row.user_id, row.total_score))
        }

        return guilds.map { g in
            let list = scoresByGuild[g.id] ?? []
            let sorted = list.sorted { $0.total_score > $1.total_score }
            let orderedScores = sorted.map { $0.total_score }
            let mine = list.first(where: { $0.user_id == userId })
            let myScore = mine?.total_score ?? 0
            let myRank: Int = {
                guard mine != nil else { return 0 }
                if let idx = orderedScores.firstIndex(of: myScore) { return idx + 1 }
                return 0
            }()
            let topScore = orderedScores.max() ?? 0

            return MyGuildRow(
                guild_id: g.id,
                name: g.name,
                invite_code: g.invite_code,
                owner_id: g.owner_id,
                member_count: memberCountByGuild[g.id] ?? 0,
                my_rank: myRank,
                my_score: myScore,
                top_score: topScore
            )
        }
    }

    // MARK: - getGuildDetails

    private struct GuildDetailRow: Decodable {
        let name: String
        let invite_code: String
        let owner_id: String
        let max_members: Int?
        let created_at: String
    }

    public func getGuildDetails(guildId: String) async -> GuildDetails? {
        do {
            let guild: GuildDetailRow? = try await client
                .from("guilds")
                .select("name, invite_code, owner_id, max_members, created_at")
                .eq("id", value: guildId)
                .single()
                .execute()
                .value
            guard let guild else { return nil }

            // Use a separate count query (matches RN's `count: 'exact', head: true`).
            let countResp = try await client
                .from("guild_members")
                .select("*", head: true, count: .exact)
                .eq("guild_id", value: guildId)
                .execute()
            let count = countResp.count ?? 0

            return GuildDetails(
                name: guild.name,
                invite_code: guild.invite_code,
                owner_id: guild.owner_id,
                member_count: count,
                max_members: guild.max_members ?? 0,
                created_at: guild.created_at
            )
        } catch {
            print("[GuildService] getGuildDetails failed:", error)
            return nil
        }
    }

    // MARK: - getGuildLeaderboard

    private struct MemberIdRow: Decodable { let user_id: String }
    private struct ProfileRow: Decodable {
        let id: String
        let display_name: String?
        let avatar_url: String?
    }
    // Member OVR/rank is decoded into `HomeService.UserStatsRow` and rendered
    // via its `ovrTier` so the guild leaderboard's overall letter is computed
    // by the EXACT same code (incl. legacy-XP fallbacks) the Home/Profile
    // screens use — guaranteeing the letter matches what the member sees there.
    private struct ScoreRow: Decodable {
        let user_id: String
        let focus_minutes: Int?
        let missions_done: Int?
        let streak_days: Int?
        let total_score: Int?
    }

    public func getGuildLeaderboard(guildId: String, monthKey: String) async -> [GuildLeaderboardEntry] {
        do {
            let currentUid = try? await currentUserId()

            // Fetch members
            let members: [MemberIdRow] = try await client
                .from("guild_members")
                .select("user_id")
                .eq("guild_id", value: guildId)
                .execute()
                .value
            if members.isEmpty { return [] }

            let memberIds = members.map { $0.user_id }

            // Fetch profiles
            let profiles: [ProfileRow] = (try? await client
                .from("profiles")
                .select("id, display_name, avatar_url")
                .in("id", values: memberIds)
                .execute()
                .value) ?? []
            let profileByUser: [String: ProfileRow] = Dictionary(uniqueKeysWithValues: profiles.map { ($0.id, $0) })

            // Fetch user_stats (broad-readable per RLS). Decoded into the same
            // `UserStatsRow` Home uses so `ovrTier` matches across screens.
            let userStats: [HomeService.UserStatsRow] = (try? await client
                .from("user_stats")
                .select("*")
                .in("user_id", values: memberIds)
                .execute()
                .value) ?? []
            let statsByUser: [String: HomeService.UserStatsRow] = Dictionary(
                uniqueKeysWithValues: userStats.compactMap { row in row.userId.map { ($0, row) } }
            )

            // Fetch scores for the selected week
            let scores: [ScoreRow] = try await client
                .from("guild_scores")
                .select("user_id, focus_minutes, missions_done, streak_days, total_score")
                .eq("guild_id", value: guildId)
                .eq("week_key", value: monthKey)
                .execute()
                .value
            let scoreByUser: [String: ScoreRow] = Dictionary(uniqueKeysWithValues: scores.map { ($0.user_id, $0) })

            struct Merged {
                let user_id: String
                let display_name: String?
                let avatar_url: String?
                let focus_minutes: Int
                let missions_done: Int
                let streak_days: Int
                let total_score: Int
                let ovr_tier: String?
                let rank_id: String?
            }

            let merged: [Merged] = memberIds.map { uid in
                let p = profileByUser[uid]
                let sc = scoreByUser[uid]
                let us = statsByUser[uid]
                return Merged(
                    user_id: uid,
                    display_name: p?.display_name,
                    avatar_url: p?.avatar_url,
                    focus_minutes: sc?.focus_minutes ?? 0,
                    missions_done: sc?.missions_done ?? 0,
                    streak_days: sc?.streak_days ?? 0,
                    total_score: sc?.total_score ?? 0,
                    ovr_tier: us?.ovrTier.rawValue,
                    // Derive the rank from total rank XP with the same helper
                    // Home uses — the stored `rank_id` column is written by the
                    // legacy streak-based SQL recompute and disagrees with the
                    // XP-based rank shown everywhere else in the app.
                    rank_id: us.map { RankHelpers.rankFromXp($0.totalRankXp).id.rawValue }
                )
            }
            .sorted { $0.total_score > $1.total_score }

            return merged.enumerated().map { (index, row) in
                let username = row.display_name?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                    ? row.display_name!
                    : "User \(String(row.user_id.prefix(8)))"
                return GuildLeaderboardEntry(
                    user_id: row.user_id,
                    username: username,
                    avatar_url: row.avatar_url,
                    rank: index + 1,
                    focus_minutes: row.focus_minutes,
                    missions_done: row.missions_done,
                    streak_days: row.streak_days,
                    total_score: row.total_score,
                    is_current_user: currentUid != nil && row.user_id == currentUid,
                    ovr_tier: row.ovr_tier,
                    rank_id: row.rank_id
                )
            }
        } catch {
            print("[GuildService] getGuildLeaderboard failed:", error)
            return []
        }
    }

    // MARK: - createGuild RPC

    private struct CreateGuildParams: Encodable { let guild_name: String }

    public func createGuild(name: String) async -> CreateGuildResult? {
        do {
            let row: CreateGuildResult? = try await client
                .rpc("create_guild", params: CreateGuildParams(guild_name: name))
                .execute()
                .value
            return row
        } catch {
            print("[GuildService] createGuild failed:", error)
            return nil
        }
    }

    // MARK: - joinGuild RPC

    private struct JoinGuildParams: Encodable { let code: String }

    public func joinGuild(code: String) async -> JoinGuildResult? {
        do {
            let row: JoinGuildResult? = try await client
                .rpc("join_guild", params: JoinGuildParams(code: code))
                .execute()
                .value
            return row
        } catch {
            print("[GuildService] joinGuild failed:", error)
            return nil
        }
    }

    // MARK: - leaveGuild (DELETE on guild_members)

    private struct RoleRow: Decodable { let role: String }

    public func leaveGuild(guildId: String) async -> LeaveResult {
        do {
            guard let userId = try? await currentUserId() else {
                return .networkError("Not signed in.")
            }
            let row: RoleRow? = try await client
                .from("guild_members")
                .select("role")
                .eq("guild_id", value: guildId)
                .eq("user_id", value: userId)
                .single()
                .execute()
                .value
            guard let row else {
                return .notMember
            }
            if row.role == "owner" {
                print("[GuildService] leaveGuild blocked: user is owner")
                return .ownerCannotLeave
            }
            try await client
                .from("guild_members")
                .delete()
                .eq("guild_id", value: guildId)
                .eq("user_id", value: userId)
                .execute()
            return .success
        } catch {
            print("[GuildService] leaveGuild failed:", error)
            return .networkError(error.localizedDescription)
        }
    }

    // MARK: - kickMember RPC

    private struct KickParams: Encodable {
        let target_guild_id: String
        let target_user_id: String
    }

    public func kickMember(guildId: String, targetUserId: String) async -> Bool {
        do {
            try await client
                .rpc("kick_guild_member", params: KickParams(
                    target_guild_id: guildId,
                    target_user_id: targetUserId
                ))
                .execute()
            return true
        } catch {
            print("[GuildService] kickMember failed:", error)
            return false
        }
    }

    // MARK: - deleteGuild (owner DELETE on guilds)

    public func deleteGuild(guildId: String) async -> Bool {
        do {
            guard let userId = try? await currentUserId() else { return false }
            try await client
                .from("guilds")
                .delete()
                .eq("id", value: guildId)
                .eq("owner_id", value: userId)
                .execute()
            return true
        } catch {
            print("[GuildService] deleteGuild failed:", error)
            return false
        }
    }

    // MARK: - Monthly stats (local-only, AsyncStorage parity)

    public func getMonthlyStats() -> MonthlyGuildStats {
        let currentMonth = Self.currentMonthKey()
        guard let raw = Defaults.codable(MonthlyGuildStats.self, Self.monthStatsKey) else {
            let initial = MonthlyGuildStats(period_key: currentMonth)
            Defaults.setCodable(initial, Self.monthStatsKey)
            return initial
        }
        if raw.period_key != currentMonth {
            let reset = MonthlyGuildStats(period_key: currentMonth)
            Defaults.setCodable(reset, Self.monthStatsKey)
            return reset
        }
        return raw
    }

    /// Partial update mirror — only the provided fields override the cached
    /// snapshot. Use `nil` to keep the existing value.
    public func updateMonthlyStats(
        focusMinutes: Int? = nil,
        missionsDone: Int? = nil,
        streakDays: Int? = nil
    ) {
        let existing = getMonthlyStats()
        let next = MonthlyGuildStats(
            period_key: Self.currentMonthKey(),
            focus_minutes: focusMinutes ?? existing.focus_minutes,
            missions_done: missionsDone ?? existing.missions_done,
            streak_days: streakDays ?? existing.streak_days
        )
        Defaults.setCodable(next, Self.monthStatsKey)
    }

    // MARK: - completeMissionServerSide (edge function)

    /// Submit a mission completion through the `complete-mission` Edge
    /// Function. Server upserts `guild_scores` for every guild the user is in
    /// via the `upsert_guild_score` RPC.
    ///
    /// `timeGate` is a stale client-only UX guard accepted (but ignored) by
    /// the server — we still forward it so request shape matches RN exactly.
    ///
    /// Wired by `MainNavigator.handleSessionFinish` (which reads
    /// `getMonthlyStats()`, bumps locally, then forwards the new totals here).
    /// `MissionsProvider.completeMission` separately triggers updates via
    /// `MissionsState.onMissionCompleted` — currently a no-op, but the hook is
    /// in place for the next iteration.
    public func completeMissionServerSide(
        timeGate: String? = nil,
        focusMinutes: Int,
        missionsDone: Int,
        streakDays: Int
    ) async -> CompleteMissionOutcome {
        struct Payload: Encodable {
            let timeGate: String?
            let focusMinutes: Int
            let missionsDone: Int
            let streakDays: Int
        }
        struct ResponseBody: Decodable { let error: String? }

        do {
            let payload = Payload(
                timeGate: timeGate,
                focusMinutes: focusMinutes,
                missionsDone: missionsDone,
                streakDays: streakDays
            )
            // Encode the payload to Data so we don't depend on a specific
            // supabase-swift `FunctionInvokeOptions` body-parameter typing
            // (which has shifted between 2.x minor versions).
            let bodyData = try JSONEncoder().encode(payload)
            let body: ResponseBody = try await client.functions.invoke(
                "complete-mission",
                options: FunctionInvokeOptions(body: bodyData)
            )
            if body.error == "time_gate_locked" {
                return CompleteMissionOutcome(success: false, error: "time_gate_locked")
            }
            return CompleteMissionOutcome(success: true, error: nil)
        } catch {
            let message = String(describing: error).lowercased()
            if message.contains("time_gate_locked") {
                return CompleteMissionOutcome(success: false, error: "time_gate_locked")
            }
            print("[GuildService] Edge function failed:", error)
            return CompleteMissionOutcome(success: false, error: "network_error")
        }
    }

    // MARK: - Helpers

    /// Fetch the current Supabase user ID, or throw if no session exists.
    private func currentUserId() async throws -> String {
        let session = try await client.auth.session
        return session.user.id.uuidString.lowercased()
    }
}
