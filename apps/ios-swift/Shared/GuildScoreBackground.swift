import Foundation

/// Cross-process guild-score state + the background credit push.
///
/// Scheduled lock-in sessions complete in the background via the
/// DeviceActivityMonitor extension while the app is closed. Previously ALL guild
/// crediting happened in the app's `handleSessionFinish` (only on next open), so a
/// user who never reopened the app never earned guild points for those sessions.
///
/// This store:
///   1. Owns the monthly guild-stats cache in the **App Group** (moved out of the
///      app-only standard `UserDefaults`) so both processes read/write the same
///      value and reset identically at the UTC month boundary.
///   2. Serializes every read-modify-write behind a cross-process file lock
///      (`mutateStats`) so the app and the extension can't lose an update — which
///      matters because the server stores `focus_minutes = GREATEST(existing, sent)`
///      on an ABSOLUTE cumulative total, so a lost local increment would silently
///      under-count for the whole month.
///   3. Provides `creditScheduledSessionInBackground(record:)` — a self-contained,
///      SDK-free push the extension calls after un-shielding, gated by a hard
///      timeout so it can never delay un-blocking.
///
/// All storage uses raw `UserDefaults(suiteName:)` — the extension can't use the
/// app-target `Defaults` wrapper (it lives in `LockedIn/Services`).
///
/// Compiled into the app + extension targets via the `Shared/` source group.
public enum GuildBackgroundStore {

    /// Cached cumulative guild stats for the current calendar month. Mirror of the
    /// server's per-month `guild_scores` row (which the server keeps monotonic via
    /// `GREATEST`). The canonical model — `GuildService.MonthlyGuildStats` aliases
    /// this so app call sites are unchanged.
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

    public enum Keys {
        /// Monthly stats JSON. Same key name as the legacy app cache — only the
        /// *suite* changed (standard → App Group). See `migrateFromStandard`.
        public static let monthStats = "@lockedin/guild_month_stats"
        /// Occurrence ids whose GUILD points were credited to the cache. Kept
        /// separate from the app's full-credit set
        /// (`@lockedin/credited_scheduled_occurrences`) so a background guild-only
        /// credit and the app's EXP/streak credit don't clobber each other's dedup.
        public static let guildCreditedOccurrences = "@lockedin/guild_credited_occurrences"
        /// One-shot flag: the standard→App-Group cache migration has run.
        public static let cacheMigrated = "@lockedin/guild_month_stats_migrated_v1"
        /// `"true"`/`"false"` — whether the user is in at least one guild, mirrored
        /// from the app so the extension can skip the network round-trip for
        /// guild-less users (the common anonymous-first case).
        public static let hasActiveGuild = "@lockedin/has_active_guild"
    }

    private static func defaults() -> UserDefaults? {
        UserDefaults(suiteName: SharedScreenTime.appGroupId)
    }

    // MARK: - Cross-process lock

    /// Serialize a read-modify-write of the cache across the app + extension
    /// processes with an advisory file lock in the App-Group container. Uncontended
    /// this is sub-millisecond. Falls back to running `body` unlocked only if the
    /// container/lock file is unavailable (never blocks forever).
    private static func withCacheLock<T>(_ body: () -> T) -> T {
        guard let dir = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: SharedScreenTime.appGroupId)
        else { return body() }
        let lockPath = dir.appendingPathComponent(".guild_cache.lock").path
        let fd = open(lockPath, O_CREAT | O_RDWR, 0o644)
        guard fd != -1 else { return body() }
        defer { close(fd) }
        flock(fd, LOCK_EX)
        defer { flock(fd, LOCK_UN) }
        return body()
    }

    // MARK: - Month key (UTC, matches the server edge function)

    public static func currentMonthKey(now: Date = Date()) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let c = cal.dateComponents([.year, .month], from: now)
        return String(format: "%04d-%02d", c.year ?? 1970, c.month ?? 1)
    }

    // MARK: - Cache read/write (App Group, lock-guarded public API)

    /// Read the cached monthly stats, resetting to a fresh zeroed record at the UTC
    /// month boundary — the SAME rule the app previously applied, now shared so both
    /// processes roll over identically. Lock-guarded (it may write the reset).
    public static func getMonthlyStats(now: Date = Date()) -> MonthlyGuildStats {
        withCacheLock { getMonthlyStatsUnlocked(now: now) }
    }

    /// Partial update — `nil` keeps the existing field. Always stamps the current
    /// UTC month key. Lock-guarded read-modify-write.
    public static func updateMonthlyStats(
        focusMinutes: Int? = nil,
        missionsDone: Int? = nil,
        streakDays: Int? = nil,
        now: Date = Date()
    ) {
        withCacheLock {
            let existing = getMonthlyStatsUnlocked(now: now)
            writeUnlocked(MonthlyGuildStats(
                period_key: currentMonthKey(now: now),
                focus_minutes: focusMinutes ?? existing.focus_minutes,
                missions_done: missionsDone ?? existing.missions_done,
                streak_days: streakDays ?? existing.streak_days
            ))
        }
    }

    /// Atomic read-modify-write. Reads the current (month-rolled) stats, applies
    /// `body`, writes the result, and returns it — all under the cross-process lock
    /// so a concurrent writer in the other process can't lose the update.
    ///
    /// When `occurrenceId` is provided it is a single-credit guard: if that
    /// occurrence was already guild-credited the cache is left untouched and `nil`
    /// is returned (caller skips its push); otherwise `body` is applied and the
    /// occurrence is marked credited in the SAME critical section. This is what
    /// makes "add a scheduled occurrence's minutes exactly once" hold no matter
    /// which of {extension push, app live-finish, app drain} runs, or in what order.
    @discardableResult
    public static func mutateStats(
        occurrenceId: String? = nil,
        now: Date = Date(),
        _ body: (inout MonthlyGuildStats) -> Void
    ) -> MonthlyGuildStats? {
        withCacheLock {
            if let occ = occurrenceId, guildCreditedSetUnlocked().contains(occ) { return nil }
            var stats = getMonthlyStatsUnlocked(now: now)
            body(&stats)
            stats.period_key = currentMonthKey(now: now)
            writeUnlocked(stats)
            if let occ = occurrenceId { markGuildCreditedUnlocked(occ) }
            return stats
        }
    }

    /// One-time copy of any legacy standard-scope cache into the App Group. Called
    /// by the app (which owns the standard-scope value). Without this, an existing
    /// user's accrued month would appear as 0 to the App-Group readers on first run.
    /// Guarded by a flag and only copies when the App-Group slot is still empty, so
    /// it can never clobber a fresher value.
    public static func migrateFromStandard(_ legacy: MonthlyGuildStats?) {
        withCacheLock {
            guard let d = defaults() else { return }
            if d.bool(forKey: Keys.cacheMigrated) { return }
            if d.data(forKey: Keys.monthStats) == nil, let legacy {
                writeUnlocked(legacy)
            }
            d.set(true, forKey: Keys.cacheMigrated)
        }
    }

    // MARK: - Has-guild flag (mirrored by the app)

    public static func setHasActiveGuild(_ value: Bool) {
        defaults()?.set(value ? "true" : "false", forKey: Keys.hasActiveGuild)
    }

    public static func hasActiveGuild() -> Bool {
        defaults()?.string(forKey: Keys.hasActiveGuild) == "true"
    }

    // MARK: - Guild-credited occurrence set (lock-guarded public API)

    public static func isGuildCredited(_ occurrenceId: String) -> Bool {
        withCacheLock { guildCreditedSetUnlocked().contains(occurrenceId) }
    }

    // MARK: - Unlocked internals (call ONLY from inside `withCacheLock`)

    private static func getMonthlyStatsUnlocked(now: Date) -> MonthlyGuildStats {
        let month = currentMonthKey(now: now)
        guard let data = defaults()?.data(forKey: Keys.monthStats),
              let raw = try? JSONDecoder().decode(MonthlyGuildStats.self, from: data)
        else {
            let initial = MonthlyGuildStats(period_key: month)
            writeUnlocked(initial)
            return initial
        }
        if raw.period_key != month {
            let reset = MonthlyGuildStats(period_key: month)
            writeUnlocked(reset)
            return reset
        }
        return raw
    }

    private static func writeUnlocked(_ stats: MonthlyGuildStats) {
        guard let data = try? JSONEncoder().encode(stats) else { return }
        defaults()?.set(data, forKey: Keys.monthStats)
    }

    private static func guildCreditedSetUnlocked() -> Set<String> {
        guard let data = defaults()?.data(forKey: Keys.guildCreditedOccurrences),
              let arr = try? JSONDecoder().decode([String].self, from: data)
        else { return [] }
        return Set(arr)
    }

    private static func markGuildCreditedUnlocked(_ occurrenceId: String) {
        var set = guildCreditedSetUnlocked()
        set.insert(occurrenceId)
        guard let data = try? JSONEncoder().encode(Array(prune(set))) else { return }
        defaults()?.set(data, forKey: Keys.guildCreditedOccurrences)
    }

    /// Keep the set bounded (same 60-day rule the app uses): an occurrence id
    /// (`<sessionId>.<YYYY-MM-DD>`) older than ~60 days can't recur.
    private static func prune(_ ids: Set<String>) -> Set<String> {
        let cutoff = Calendar.current.date(byAdding: .day, value: -60, to: Date()) ?? .distantPast
        let cutoffYMD = ScheduledCompletionRecord.localYMD(cutoff)
        return ids.filter { id in
            guard let ymd = id.split(separator: ".").last.map(String.init) else { return true }
            return ymd >= cutoffYMD
        }
    }

    // MARK: - Background credit push (extension entry point)

    /// Credit a completed scheduled occurrence's focus minutes to the user's guild
    /// scores, from the extension, best-effort. MUST be called AFTER the shield is
    /// cleared — it blocks the calling thread for up to ~5s on the network and must
    /// never gate un-blocking.
    ///
    /// - No-op (safe) when: zero duration, the user is in no guild, no mirrored
    ///   config/session, or a token refresh fails. In those cases the cache is NOT
    ///   mutated and the occurrence stays unmarked, so the app credits it on next
    ///   open (the guaranteed fallback).
    /// - Otherwise it atomically increments the cache + marks the occurrence
    ///   (skipping if another path already did), then pushes the new cumulative
    ///   total best-effort. A failed push is self-healing: the minutes are in the
    ///   cache, so the next push (from any later session) flushes them via GREATEST.
    public static func creditScheduledSessionInBackground(record: ScheduledCompletionRecord) {
        guard record.durationMinutes > 0 else { return }
        // Skip the network entirely for guild-less users (the common anonymous
        // case) — there's nothing to credit server-side, and the app will still
        // cache the minutes via its drain path if the user ever joins a guild.
        guard hasActiveGuild() else { return }
        guard let config = SupabaseAuthMirror.readConfig(),
              let session = SupabaseAuthMirror.readSession()
        else { return }

        // Ensure a usable access token BEFORE mutating the cache — if we can't get
        // one, leave the occurrence for the app to credit on next open. Rotation is
        // off → refreshing with the mirrored refresh token is safe and doesn't
        // disturb the app's session.
        var accessToken = session.accessToken
        if session.isExpired() {
            guard let refreshed = refreshAccessToken(config: config, refreshToken: session.refreshToken) else { return }
            accessToken = refreshed.accessToken
            SupabaseAuthMirror.updateAccessToken(refreshed.accessToken, expiresAtMs: refreshed.expiresAtMs)
        }

        // Atomically add this occurrence's minutes exactly once. nil ⇒ already
        // credited (by a duplicate callback or the app) ⇒ nothing to push.
        guard let updated = mutateStats(occurrenceId: record.occurrenceId, { stats in
            stats.focus_minutes += record.durationMinutes
        }) else { return }

        // Best-effort flush. Failure is fine (self-heals via cumulative GREATEST).
        _ = postCompleteMission(
            config: config,
            accessToken: accessToken,
            focusMinutes: updated.focus_minutes,
            missionsDone: updated.missions_done,
            streakDays: updated.streak_days
        )
    }

    // MARK: - Networking (synchronous, hard-timeout bounded)

    private static func refreshAccessToken(
        config: (url: String, anonKey: String),
        refreshToken: String
    ) -> (accessToken: String, expiresAtMs: Double)? {
        guard let url = URL(string: "\(config.url)/auth/v1/token?grant_type=refresh_token") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])

        guard let (data, status) = syncRequest(req), status == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = json["access_token"] as? String
        else { return nil }

        let expiresIn = (json["expires_in"] as? Double) ?? 3600
        let expiresAtMs = (Date().timeIntervalSince1970 + expiresIn) * 1000
        return (access, expiresAtMs)
    }

    private static func postCompleteMission(
        config: (url: String, anonKey: String),
        accessToken: String,
        focusMinutes: Int,
        missionsDone: Int,
        streakDays: Int
    ) -> Bool {
        guard let url = URL(string: "\(config.url)/functions/v1/complete-mission") else { return false }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "focusMinutes": focusMinutes,
            "missionsDone": missionsDone,
            "streakDays": streakDays,
        ])
        guard let (_, status) = syncRequest(req) else { return false }
        return status == 200
    }

    /// Run a request synchronously, blocking the caller up to ~5s. The extension
    /// callback must stay alive until the request finishes (once it returns, iOS
    /// may suspend the process and kill an in-flight task), but a hung request must
    /// never hold it hostage — hence the layered timeouts + semaphore backstop.
    ///
    /// The result is read ONLY when the semaphore was signaled (success), which
    /// happens-after the completion set it — so there's no data race with a late
    /// completion. On timeout we cancel the task and return nil, ignoring any result
    /// that lands afterward.
    private static func syncRequest(_ request: URLRequest) -> (data: Data, status: Int)? {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 4
        cfg.timeoutIntervalForResource = 5
        cfg.waitsForConnectivity = false
        let session = URLSession(configuration: cfg)

        let semaphore = DispatchSemaphore(value: 0)
        var result: (Data, Int)?
        let task = session.dataTask(with: request) { data, response, _ in
            if let data, let http = response as? HTTPURLResponse {
                result = (data, http.statusCode)
            }
            semaphore.signal()
        }
        task.resume()
        let outcome = semaphore.wait(timeout: .now() + 5)
        session.invalidateAndCancel()
        // Only trust `result` when signaled — a timeout may leave the completion
        // racing, so we discard whatever it might write after this point.
        guard outcome == .success else { return nil }
        return result
    }
}
