import Foundation
import Supabase

/// LeaderboardService — Swift port of
/// `apps/mobile/src/features/leaderboard/LeaderboardService.ts`.
///
/// Reads/writes the global Discipline Board (top 50, 90-day seasons).
///
/// **SCHEMA GAP — VERIFY BEFORE SHIP.** The `leaderboard` table queried by
/// this service has **NO `CREATE TABLE` migration** in `supabase/migrations/`
/// (confirmed via the audit at
/// `apps/ios-swift/MIGRATION_BACKEND_INVENTORY.md:551`). Possibilities:
///   1. The table was created out-of-band on the live project.
///   2. The service is dead code at runtime (`LeaderboardScreen.tsx` is not
///      linked from `MainNavigator` — only kept for analytics-driven tier UI).
///   3. There's a migration outside this folder.
///
/// Per-worker instructions: I (W5) attempted to verify the live schema via
/// `mcp__claude_ai_Supabase__list_tables` but the MCP server **denied
/// permission**. The Swift columns below mirror the RN reads/writes verbatim:
///   - SELECT: `user_id, score, grade, tier`
///   - UPSERT: `{user_id, score, grade, tier, updated_at}` (onConflict: `user_id`)
///   - WHERE: `gt("score", …)` for rank computation.
/// If the live table differs, the runtime errors will surface inside
/// `[LeaderboardService] Error …` `print`s — same behavior as the RN code.
///
/// TODO(post-launch): run `list_tables` against the live Supabase project
/// before TestFlight to confirm the column set, OR drop this service if it's
/// no longer wired into any visible screen. (LeaderboardScreen is not linked
/// from `MainNavigator` — the service is currently only referenced for the
/// tier color helpers, so the schema risk is contained.)
public final class LeaderboardService {
    public static let shared = LeaderboardService()

    private let client: SupabaseClient

    private init(client: SupabaseClient = LockedInSupabase.shared.client) {
        self.client = client
    }

    // MARK: - Discipline tiers

    /// 9 seasonal tiers driven by 0-100 score. "Locked In" additionally
    /// requires ≥90% perfect mission days in the current 90-day season.
    /// Mirrors `LeaderboardService.ts:9-19`.
    public enum DisciplineTier: String, CaseIterable, Codable, Sendable {
        case recruit  = "Recruit"
        case soldier  = "Soldier"
        case vet      = "Vet"
        case og       = "OG"
        case elite    = "Elite"
        case legend   = "Legend"
        case goat     = "Goat"
        case immortal = "Immortal"
        case lockedIn = "Locked In"

        /// 1-2 character badge label for circular badges.
        public var badgeShort: String {
            switch self {
            case .recruit:  return "R"
            case .soldier:  return "S"
            case .vet:      return "V"
            case .og:       return "OG"
            case .elite:    return "E"
            case .legend:   return "Le"
            case .goat:     return "G"
            case .immortal: return "Im"
            case .lockedIn: return "LI"
            }
        }
    }

    /// Score thresholds (0-100) per tier. Locked In also requires
    /// `lockedInMissionEligible == true`.
    private static let scoreFloor: [DisciplineTier: Int] = [
        .recruit: 0,
        .soldier: 11,
        .vet: 22,
        .og: 33,
        .elite: 44,
        .legend: 55,
        .goat: 66,
        .immortal: 77,
    ]
    private static let lockedInScoreMin = 88

    /// Resolve tier from weekly/seasonal score. Mirrors
    /// `resolveDisciplineTier` in `LeaderboardService.ts:60`.
    public static func resolveTier(score: Int, lockedInMissionEligible: Bool) -> DisciplineTier {
        let s = min(100, max(0, score))
        if s >= lockedInScoreMin && lockedInMissionEligible {
            return .lockedIn
        }
        if s >= (scoreFloor[.immortal] ?? 77) { return .immortal }
        if s >= (scoreFloor[.goat] ?? 66) { return .goat }
        if s >= (scoreFloor[.legend] ?? 55) { return .legend }
        if s >= (scoreFloor[.elite] ?? 44) { return .elite }
        if s >= (scoreFloor[.og] ?? 33) { return .og }
        if s >= (scoreFloor[.vet] ?? 22) { return .vet }
        if s >= (scoreFloor[.soldier] ?? 11) { return .soldier }
        return .recruit
    }

    // MARK: - Models

    public struct LeaderboardEntry: Codable, Equatable, Sendable, Identifiable {
        public var id: String { user_id }
        public let rank: Int
        public let user_id: String
        public let username: String
        public let score: Int
        public let grade: String
        public let tier: DisciplineTier
    }

    public struct UserRankInfo: Codable, Equatable, Sendable {
        public let rank: Int
        public let percentile: Int
        public let tier: DisciplineTier
        public let score: Int
    }

    // MARK: - Network shapes (raw `leaderboard` rows)

    private struct LBRow: Decodable {
        let user_id: String
        let score: Double?
        let grade: String?
        let tier: String?
    }

    private struct LBUserRow: Decodable {
        let score: Double?
        let grade: String?
        let tier: String?
    }

    private struct UpsertRow: Encodable {
        let user_id: String
        let score: Int
        let grade: String
        let tier: String
        let updated_at: String
    }

    // MARK: - Submit weekly score

    /// `upsert` against the `leaderboard` table (onConflict: `user_id`).
    /// Mirrors `LeaderboardService.ts:117-147`.
    public func submitWeeklyScore(
        userId: String,
        score: Int,
        grade: String,
        lockedInMissionEligible: Bool = false
    ) async throws {
        let tier = Self.resolveTier(score: score, lockedInMissionEligible: lockedInMissionEligible)
        let nowIso = ISO8601DateFormatter().string(from: Date())
        try await client
            .from("leaderboard")
            .upsert(
                UpsertRow(
                    user_id: userId,
                    score: score,
                    grade: grade,
                    tier: tier.rawValue,
                    updated_at: nowIso
                ),
                onConflict: "user_id"
            )
            .execute()
    }

    // MARK: - Top N leaderboard

    public func getLeaderboard(limit: Int = 50) async -> [LeaderboardEntry] {
        do {
            let rows: [LBRow] = try await client
                .from("leaderboard")
                .select("user_id, score, grade, tier")
                .order("score", ascending: false)
                .limit(limit)
                .execute()
                .value
            return rows.enumerated().map { (idx, row) in
                let score = Int(row.score ?? 0)
                return LeaderboardEntry(
                    rank: idx + 1,
                    user_id: row.user_id,
                    username: "User \(String(row.user_id.prefix(8)))",
                    score: score,
                    grade: row.grade ?? "",
                    // Other users: score only (Locked In needs per-user mission data
                    // not stored on leaderboard rows yet).
                    tier: Self.resolveTier(score: score, lockedInMissionEligible: false)
                )
            }
        } catch {
            print("[LeaderboardService] Error fetching leaderboard:", error)
            return []
        }
    }

    // MARK: - User rank

    /// Looks up the user's `leaderboard` row + computes rank/percentile.
    public func getUserRank(userId: String, lockedInMissionEligible: Bool = false) async -> UserRankInfo {
        let fallback = UserRankInfo(rank: 0, percentile: 0, tier: .recruit, score: 0)
        do {
            let userRow: LBUserRow? = try? await client
                .from("leaderboard")
                .select("score, grade, tier")
                .eq("user_id", value: userId)
                .single()
                .execute()
                .value
            guard let userRow else {
                print("[LeaderboardService] User not found on leaderboard")
                return fallback
            }

            let score = Int(userRow.score ?? 0)
            let tier = Self.resolveTier(score: score, lockedInMissionEligible: lockedInMissionEligible)

            let higherResp = try await client
                .from("leaderboard")
                .select("*", head: true, count: .exact)
                .gt("score", value: score)
                .execute()
            let usersWithHigherScore = higherResp.count ?? 0
            let rank = usersWithHigherScore + 1

            let totalResp = try await client
                .from("leaderboard")
                .select("*", head: true, count: .exact)
                .execute()
            let total = totalResp.count ?? 0

            let percentile: Int = (total > 0)
                ? Int((Double(total - rank) / Double(total)) * 100.0)
                : 0

            return UserRankInfo(rank: rank, percentile: percentile, tier: tier, score: score)
        } catch {
            print("[LeaderboardService] Error getting user rank:", error)
            return fallback
        }
    }

    public func getTotalUsers() async -> Int {
        do {
            let resp = try await client
                .from("leaderboard")
                .select("*", head: true, count: .exact)
                .execute()
            return resp.count ?? 0
        } catch {
            print("[LeaderboardService] Error getting total users:", error)
            return 0
        }
    }

    public func getUserEntry(userId: String, lockedInMissionEligible: Bool = false) async -> LeaderboardEntry? {
        do {
            let row: LBUserRow? = try await client
                .from("leaderboard")
                .select("score, grade, tier")
                .eq("user_id", value: userId)
                .single()
                .execute()
                .value
            guard let row else { return nil }

            let rankInfo = await getUserRank(userId: userId, lockedInMissionEligible: lockedInMissionEligible)
            let score = Int(row.score ?? 0)
            let tier = Self.resolveTier(score: score, lockedInMissionEligible: lockedInMissionEligible)
            return LeaderboardEntry(
                rank: rankInfo.rank,
                user_id: userId,
                username: "User \(String(userId.prefix(8)))",
                score: score,
                grade: row.grade ?? "",
                tier: tier
            )
        } catch {
            print("[LeaderboardService] Error getting user entry:", error)
            return nil
        }
    }

    public func clear() async {
        do {
            try await client
                .from("leaderboard")
                .delete()
                .neq("user_id", value: "")
                .execute()
        } catch {
            print("[LeaderboardService] Error clearing leaderboard:", error)
        }
    }

    // MARK: - Season helpers (mirror seasonDiscipline.ts)

    public enum Season {
        public static let lengthDays = 90
        private static let anchorUtcMs: TimeInterval = {
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = TimeZone(identifier: "UTC")!
            let comps = DateComponents(year: 2025, month: 1, day: 1)
            return cal.date(from: comps)?.timeIntervalSince1970 ?? 0
        }()

        public static func index(now: Date = Date()) -> Int {
            let daysSinceAnchor = Int((now.timeIntervalSince1970 - anchorUtcMs) / 86_400.0)
            return max(0, daysSinceAnchor) / lengthDays
        }

        public static func currentId(now: Date = Date()) -> String {
            "S\(index(now: now))"
        }

        public static func dayOfSeason(now: Date = Date()) -> Int {
            let daysSinceAnchor = Int((now.timeIntervalSince1970 - anchorUtcMs) / 86_400.0)
            return (daysSinceAnchor % lengthDays) + 1
        }
    }

    // MARK: - Season mission consistency (Locked In eligibility)

    /// Persisted key matching RN `seasonMissionConsistency.ts`.
    public static let seasonPerfectDaysKey = "@lockedin/season_perfect_mission_days"

    public struct SeasonMissionStore: Codable, Equatable, Sendable {
        public var seasonId: String
        /// `YYYY-MM-DD` keys for days that hit daily + weekly mission bar.
        public var perfectDays: [String]
    }

    /// Returns the season store, resetting it when the season rolls over.
    @discardableResult
    public func ensureSeasonStoreCurrent() -> SeasonMissionStore {
        let current = Season.currentId()
        let raw = Defaults.codable(SeasonMissionStore.self, Self.seasonPerfectDaysKey)
        if let raw, raw.seasonId == current {
            return raw
        }
        let fresh = SeasonMissionStore(seasonId: current, perfectDays: [])
        Defaults.setCodable(fresh, Self.seasonPerfectDaysKey)
        return fresh
    }

    /// Record one calendar day as "perfect" for mission consistency.
    public func recordPerfectMissionDay(dateKey: String) {
        var store = ensureSeasonStoreCurrent()
        if store.perfectDays.contains(dateKey) { return }
        store.perfectDays.append(dateKey)
        store.perfectDays.sort()
        Defaults.setCodable(store, Self.seasonPerfectDaysKey)
    }

    /// Ratio 0…1 of perfect mission days to season length (90).
    public func seasonMissionConsistencyRatio() -> Double {
        let store = ensureSeasonStoreCurrent()
        return min(1.0, Double(store.perfectDays.count) / Double(Season.lengthDays))
    }

    /// User qualifies for the top "Locked In" tier when perfect-mission-days
    /// in the season meet the 90% threshold (81 of 90).
    public func isLockedInMissionEligible() -> Bool {
        let store = ensureSeasonStoreCurrent()
        let minPerfectDays = Int(ceil(0.9 * Double(Season.lengthDays))) // 81
        return store.perfectDays.count >= minPerfectDays
    }
}
