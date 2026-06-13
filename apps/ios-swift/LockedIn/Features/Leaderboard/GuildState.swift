import Foundation
import Observation

/// GuildState — observable model used by the Guild screens (BoardTab,
/// GuildDetail, CreateGuild, JoinGuild).
///
/// The RN app does not use a dedicated GuildProvider — every screen calls
/// `GuildService` directly and holds its own `useState`. This Swift state
/// container centralises the per-screen async loads + selected-week index so
/// SwiftUI views can react via `@Bindable` / `@Environment`.
///
/// Cross-feature coordination:
///   - On guild change (create / join / leave / kick), this state calls
///     `NotificationService.shared.scheduleFirstGuildNudgeIfNeeded(...)`
///     and `refreshScheduleWithStoredStreak()`.
///   - Analytics events fire directly into `AnalyticsService.shared`.
@MainActor
@Observable
public final class GuildState {

    // MARK: - Public observable state

    /// `getMyGuilds` result. Empty array while loading or when the user is
    /// not in any guild.
    public private(set) var myGuilds: [GuildService.MyGuildRow] = []

    /// True while the first `loadMyGuilds()` is in flight.
    public private(set) var isLoading: Bool = false

    /// True while a pull-to-refresh is in flight on the BoardTab list.
    public private(set) var isRefreshing: Bool = false

    /// Detail-screen state. Keyed by `guild_id` so multiple GuildDetail pushes
    /// stay independent without leaking.
    public private(set) var detailsByGuild: [String: GuildService.GuildDetails] = [:]
    public private(set) var leaderboardByGuild: [String: [GuildService.GuildLeaderboardEntry]] = [:]
    public private(set) var isLoadingDetail: Bool = false
    public private(set) var isRefreshingDetail: Bool = false

    /// Selected month offset (`0` = current month, negative = past months).
    public var monthOffset: Int = 0

    /// Drives the month-end HUD nudge. Set by `evaluateMonthEndPrompt()` when
    /// the user is in a guild on the last day of the month and hasn't been
    /// nudged yet this month. Presented by `TabNavigator`.
    public var showMonthEndPrompt: Bool = false

    public init() {}

    // MARK: - Month-end prompt

    /// Defaults key storing the `YYYY-MM` of the month we last showed the
    /// month-end nudge for (so it fires at most once per month).
    private static let monthEndPromptShownKey = "@lockedin/guild_monthend_prompt_shown"

    /// Local-time `YYYY-MM` for the current month (dedupe key for the prompt).
    public static func localMonthKey(now: Date = Date()) -> String {
        let comps = Calendar.current.dateComponents([.year, .month], from: now)
        return String(format: "%04d-%02d", comps.year ?? 1970, comps.month ?? 1)
    }

    /// True when `now` falls on the final calendar day of its local month.
    public static func isLastDayOfMonth(now: Date = Date()) -> Bool {
        let cal = Calendar.current
        guard let range = cal.range(of: .day, in: .month, for: now) else { return false }
        return cal.component(.day, from: now) == range.upperBound - 1
    }

    /// Show the month-end nudge when: the user is in a guild (cheap cached
    /// flag — no network), today is the last day of the month, and we haven't
    /// nudged yet this month. Safe to call repeatedly (boot + every foreground).
    public func evaluateMonthEndPrompt(now: Date = Date()) {
        guard !showMonthEndPrompt else { return }
        guard Defaults.bool(GuildService.hasActiveGuildKey) else { return }
        guard GuildState.isLastDayOfMonth(now: now) else { return }
        let monthKey = GuildState.localMonthKey(now: now)
        guard Defaults.string(GuildState.monthEndPromptShownKey) != monthKey else { return }
        showMonthEndPrompt = true
    }

    /// Dismiss the nudge and mark it shown for this month (whether the user
    /// tapped through to the board or closed it).
    public func dismissMonthEndPrompt() {
        showMonthEndPrompt = false
        Defaults.setString(GuildState.localMonthKey(), GuildState.monthEndPromptShownKey)
    }

    // MARK: - List (BoardTab / GuildList)

    /// Fetch `getMyGuilds`. When `silent == true`, doesn't flip `isLoading`
    /// (used by the `useFocusEffect` re-fetch in RN).
    public func loadMyGuilds(silent: Bool = false) async {
        if !silent { isLoading = true }
        let rows = await GuildService.shared.getMyGuilds()
        myGuilds = rows
        if !silent { isLoading = false }
    }

    public func refreshMyGuilds() async {
        isRefreshing = true
        let rows = await GuildService.shared.getMyGuilds()
        myGuilds = rows
        isRefreshing = false
    }

    // MARK: - Detail (GuildDetail)

    /// Compute the month key for `monthOffset` (0 = current, -1 = last month, …).
    /// Uses a UTC-anchored month shift to match `GuildService.currentMonthKey`.
    public func monthKey(forOffset offset: Int, now: Date = Date()) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let shifted = cal.date(byAdding: .month, value: offset, to: now) ?? now
        return GuildService.currentMonthKey(now: shifted)
    }

    /// Load both `getGuildDetails` + `getGuildLeaderboard` in parallel for
    /// the supplied guild + the currently-selected month offset.
    public func loadDetail(guildId: String, silent: Bool = false) async {
        if !silent { isLoadingDetail = true }
        let monthKey = monthKey(forOffset: monthOffset)
        async let detailsTask = GuildService.shared.getGuildDetails(guildId: guildId)
        async let lbTask = GuildService.shared.getGuildLeaderboard(guildId: guildId, monthKey: monthKey)
        let (details, lb) = await (detailsTask, lbTask)
        if let details {
            detailsByGuild[guildId] = details
        }
        leaderboardByGuild[guildId] = lb
        if !silent { isLoadingDetail = false }
    }

    public func refreshDetail(guildId: String) async {
        isRefreshingDetail = true
        await loadDetail(guildId: guildId, silent: true)
        isRefreshingDetail = false
    }

    // MARK: - Mutations (used by screens)

    /// Mirrors the RN `CreateGuildScreen.handleCreate` flow. Returns the new
    /// guild row so the caller can navigate to GuildDetail.
    public func createGuild(name: String) async -> GuildService.CreateGuildResult? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let result = await GuildService.shared.createGuild(name: trimmed)
        if result != nil {
            // Refresh has_active_guild flag & background-sync the list.
            _ = await GuildService.shared.syncHasActiveGuildFlag()
            await loadMyGuilds(silent: true)
            NotificationService.shared.scheduleFirstGuildNudgeIfNeeded(hasActiveGuild: true)
            NotificationService.shared.scheduleGuildMonthEndReminder(hasActiveGuild: true)
            NotificationService.shared.refreshScheduleWithStoredStreak()
        }
        return result
    }

    /// Mirrors the RN `JoinGuildScreen.handleJoin` flow.
    public func joinGuild(code: String) async -> GuildService.JoinGuildResult? {
        let result = await GuildService.shared.joinGuild(code: code)
        if result != nil {
            _ = await GuildService.shared.syncHasActiveGuildFlag()
            await loadMyGuilds(silent: true)
            NotificationService.shared.scheduleFirstGuildNudgeIfNeeded(hasActiveGuild: true)
            NotificationService.shared.scheduleGuildMonthEndReminder(hasActiveGuild: true)
        }
        return result
    }

    /// Owner-only: delete the guild. Cascades through `guild_members` +
    /// `guild_scores` server-side.
    public func deleteGuild(guildId: String) async -> Bool {
        let ok = await GuildService.shared.deleteGuild(guildId: guildId)
        if ok {
            detailsByGuild.removeValue(forKey: guildId)
            leaderboardByGuild.removeValue(forKey: guildId)
            await loadMyGuilds(silent: true)
            let (_, hasGuildNow) = await GuildService.shared.syncHasActiveGuildFlag()
            NotificationService.shared.scheduleGuildMonthEndReminder(hasActiveGuild: hasGuildNow)
            NotificationService.shared.refreshScheduleWithStoredStreak()
        }
        return ok
    }

    /// Non-owner: leave the guild. Owners must `deleteGuild` instead.
    ///
    /// Returns the typed outcome so the UI can surface the right alert per
    /// failure mode (owner block, missing membership, network error). Local
    /// state cleanup + flag sync + notification refresh only run on
    /// `.success`.
    public func leaveGuild(guildId: String) async -> LeaveResult {
        let result = await GuildService.shared.leaveGuild(guildId: guildId)
        if case .success = result {
            detailsByGuild.removeValue(forKey: guildId)
            leaderboardByGuild.removeValue(forKey: guildId)
            await loadMyGuilds(silent: true)
            let (_, hasGuildNow) = await GuildService.shared.syncHasActiveGuildFlag()
            NotificationService.shared.scheduleGuildMonthEndReminder(hasActiveGuild: hasGuildNow)
            NotificationService.shared.refreshScheduleWithStoredStreak()
        }
        return result
    }

    /// Owner-only: kick a member. RPC `kick_guild_member` deletes the
    /// membership and clears that user's `guild_scores` rows in the guild.
    public func kickMember(guildId: String, targetUserId: String) async -> Bool {
        let ok = await GuildService.shared.kickMember(guildId: guildId, targetUserId: targetUserId)
        if ok {
            await loadDetail(guildId: guildId, silent: true)
        }
        return ok
    }

    /// Persist the cached rank snapshot (used by streak-recovery banner +
    /// notification copy). Mirrors `GuildDetailScreen.tsx:110-117`.
    public func cacheUserRank(guildId: String, guildName: String, rank: Int) {
        struct Cached: Encodable { let guild_name: String; let rank: Int; let guild_id: String }
        Defaults.setCodable(
            Cached(guild_name: guildName, rank: rank, guild_id: guildId),
            GuildService.cachedRankKey
        )
    }
}
