import Foundation
import Observation
import DesignKit
import WidgetKit

// MARK: - Storage keys

/// Persistence keys owned (read or written) by the Missions feature. Every key
/// is preserved by exact name from the RN AsyncStorage inventory — see
/// `apps/mobile/src/features/missions/MissionsProvider.tsx:119-131`.
public enum MissionsStorageKeys {
    public static let dailyMissions          = "@lockedin/daily_missions"
    public static let dailyMissionsDate      = "@lockedin/daily_missions_date"
    public static let dailyMissionsProfile   = "@lockedin/daily_missions_profile"
    public static let cumulativeXP           = "@lockedin/cumulative_xp"
    public static let weeklyMissions         = "@lockedin/weekly_missions"
    public static let weeklyMissionsWeek     = "@lockedin/weekly_missions_week"
    public static let weeklyMissionsProfile  = "@lockedin/weekly_missions_profile"
    public static let weeklyActiveDays       = "@lockedin/weekly_active_days"
    public static let weeklyEarlyOpens       = "@lockedin/weekly_early_opens"
    public static let missionXPSeason        = MissionXPSeason.storageKey

    /// Dynamic-suffix key. Use `dailyActivityDone(forDateKey:)`.
    private static let dailyActivityDonePrefix = "@lockedin/daily_activity_done_"

    /// Per-day completion flag for the daily activity check-in.
    public static func dailyActivityDone(forDateKey day: String) -> String {
        "\(dailyActivityDonePrefix)\(day)"
    }
}

// MARK: - Persistence shapes

/// Wraps the `{weekKey, days: [String]}` JSON used by the weekly-active-days /
/// early-opens persistence.
public struct WeeklyDayLog: Codable, Equatable, Sendable {
    public let weekKey: String
    public var days: [String]

    public init(weekKey: String, days: [String]) {
        self.weekKey = weekKey
        self.days = days
    }
}

// MARK: - Session-complete payload

/// Data available at session completion for auto-complete matching.
///
/// Ported 1:1 from `SessionCompleteData` in
/// `apps/mobile/src/features/missions/MissionsProvider.tsx:83-89`.
public struct SessionCompleteData: Equatable, Sendable {
    public let durationMinutes: Int
    public let dailyFocusedMinutes: Int
    public let streak: Int
    public let dailyGoalMet: Bool

    public init(durationMinutes: Int, dailyFocusedMinutes: Int, streak: Int, dailyGoalMet: Bool) {
        self.durationMinutes = durationMinutes
        self.dailyFocusedMinutes = dailyFocusedMinutes
        self.streak = streak
        self.dailyGoalMet = dailyGoalMet
    }
}

// MARK: - Toast payload

/// Brief mission-complete toast surfaced by the provider. The screen layer
/// observes `completedToast` and renders an overlay.
public struct MissionCompletedToast: Equatable, Sendable {
    public let missionTitle: String
    public let xp: Int
    public let completedCount: Int
    public let totalCount: Int
    public let isPerfectDay: Bool

    public init(missionTitle: String, xp: Int, completedCount: Int, totalCount: Int, isPerfectDay: Bool) {
        self.missionTitle = missionTitle
        self.xp = xp
        self.completedCount = completedCount
        self.totalCount = totalCount
        self.isPerfectDay = isPerfectDay
    }
}

// MARK: - MissionsState (Observable)

/// Steady-state observable model for the Missions feature.
///
/// Mirrors the RN `MissionsProvider` shape. Reducer-driven mutations
/// (`HYDRATE`, `GENERATE_DAILY`, `COMPLETE_MISSION`, etc.) are exposed as
/// methods. Persistence is handled inline — every public mutator updates the
/// observable state and re-persists the relevant AsyncStorage keys.
///
/// Coordinator wiring (Phase 2):
///   - Reads `OnboardingState.primaryGoal` / `selectedWeaknesses` to drive
///     mission generation.
///   - Reads `HomeState.consecutiveStreak` for the +10% XP bonus.
///   - On `completeMission`, emits `onMissionCompleted` so W11 / W5 can wire
///     in the `complete-mission` edge function call and stat bumps.
@Observable
@MainActor
public final class MissionsState {
    // ── User inputs (set by coordinator before hydrate / on prop change) ──
    public var userGoal: String = "Increase discipline & self-control"
    public var userWeaknesses: [String] = []
    public var onboardingDate: String?
    public var streak: Int = 0

    // ── Core mirrored state ──
    public var missions: [Mission] = []
    public var weeklyMissions: [Mission] = []
    public var weekKey: String
    public var date: String
    public var completedCount: Int = 0
    public var dailyXP: Int = 0
    public var totalXP: Int = 0
    public var lockedInToday: Bool = false

    // ── Hydration / season ──
    public var isHydrated: Bool = false
    public private(set) var lastMissionSeasonHydrated: Int

    // ── Toast (mission complete overlay) ──
    public var completedToast: MissionCompletedToast?

    // MARK: - Coordinator hooks (wired in MainNavigator and ProfileTabScreen)
    //
    // - `onMissionCompleted`: assigned by the coordinator to forward into
    //   `GuildService.completeMissionServerSide(...)`.
    // - `onPerfectDay`:       assigned to call `XPService.award(.perfectDay)`
    //   (the leaderboard mission-consistency hook lives server-side).
    // - `onAnalyticsTrack`:   assigned to forward into
    //   `AnalyticsService.shared.track(...)`.

    /// Called every time a mission is completed. Payload mirrors the RN
    /// crew-update queue body: `(timeGate?, completedMission)`.
    public var onMissionCompleted: ((Mission) -> Void)?

    /// Called when the user clears all 3 daily missions (perfect day).
    public var onPerfectDay: ((Int) -> Void)?

    /// Called for every PostHog event the feature emits. `name` matches
    /// the RN event-name constants in `MissionsRoute.AnalyticsEvent`.
    public var onAnalyticsTrack: ((_ name: String, _ properties: [String: Any]) -> Void)?

    // MARK: - Init

    public init() {
        self.weekKey = MissionsEngine.missionWeekKey()
        self.date = Self.localDateKey()
        self.lastMissionSeasonHydrated = MissionXPSeason.currentSeasonNumber()
    }

    // MARK: - Hydration

    /// Load persisted state, regenerating daily / weekly missions if the date
    /// or week boundary has changed. Mirrors `MissionsProvider.hydrate`.
    public func hydrate() {
        defer { isHydrated = true }
        let expectedProfile = Self.buildProfileKey(goal: userGoal, weaknesses: userWeaknesses)
        let today = Self.localDateKey()
        let currentWeekKey = MissionsEngine.missionWeekKey()

        // ── Daily missions ──
        let storedMissions: [Mission]? = Defaults.codable(
            [Mission].self, MissionsStorageKeys.dailyMissions
        )
        let storedDate = Defaults.string(MissionsStorageKeys.dailyMissionsDate)
        let storedDailyProfile = Defaults.string(MissionsStorageKeys.dailyMissionsProfile)
        let cumulativeXP = Self.loadSeasonAwareCumulativeXP()

        let canUseStoredDaily = storedMissions != nil
            && storedDate == today
            && (storedDailyProfile == expectedProfile || storedDailyProfile == nil)

        if canUseStoredDaily, let stored = storedMissions {
            let completedCount = MissionsEngine.completedCount(stored)
            let dailyXP = MissionsEngine.calculateTotalXP(stored.filter { $0.completed })
            if storedDailyProfile == nil {
                Defaults.setString(expectedProfile, MissionsStorageKeys.dailyMissionsProfile)
            }
            self.missions = stored
            self.date = today
            self.completedCount = completedCount
            self.dailyXP = dailyXP
            self.totalXP = cumulativeXP
            self.lockedInToday = completedCount == stored.count && !stored.isEmpty
        } else {
            let newMissions = MissionsEngine.generateDailyMissions(
                MissionGenerationParams(
                    goal: userGoal,
                    weaknesses: userWeaknesses,
                    onboardingDate: onboardingDate,
                    streak: streak
                )
            )
            self.missions = newMissions
            self.date = today
            self.completedCount = 0
            self.dailyXP = 0
            self.totalXP = cumulativeXP
            self.lockedInToday = false
            persistDaily(missions: newMissions, date: today, profile: expectedProfile)
        }

        // ── Weekly missions ──
        let storedWeekly: [Mission]? = Defaults.codable(
            [Mission].self, MissionsStorageKeys.weeklyMissions
        )
        let storedWeekKey = Defaults.string(MissionsStorageKeys.weeklyMissionsWeek)
        let storedWeeklyProfile = Defaults.string(MissionsStorageKeys.weeklyMissionsProfile)
        let canUseStoredWeekly = storedWeekly != nil
            && storedWeekKey == currentWeekKey
            && (storedWeeklyProfile == expectedProfile || storedWeeklyProfile == nil)

        if canUseStoredWeekly, let stored = storedWeekly {
            let normalized = MissionsEngine.normalizeWeeklyMissions(stored)
            if storedWeeklyProfile == nil {
                Defaults.setString(expectedProfile, MissionsStorageKeys.weeklyMissionsProfile)
            }
            self.weeklyMissions = normalized
            self.weekKey = currentWeekKey
        } else {
            let newWeekly = MissionsEngine.normalizeWeeklyMissions(
                MissionsEngine.generateWeeklyMissions(
                    MissionGenerationParams(
                        goal: userGoal,
                        weaknesses: userWeaknesses,
                        onboardingDate: onboardingDate,
                        streak: streak
                    )
                )
            )
            self.weeklyMissions = newWeekly
            self.weekKey = currentWeekKey
            persistWeekly(missions: newWeekly, weekKey: currentWeekKey, profile: expectedProfile)
        }

        lastMissionSeasonHydrated = MissionXPSeason.currentSeasonNumber()

        // Push initial next-mission title into the App Group so widgets
        // installed before the user opens the missions tab still render.
        publishNextMissionToWidget()
    }

    // MARK: - Mutators

    /// `COMPLETE_MISSION` — mark one daily mission as complete. Emits the
    /// completion toast and the coordinator hooks.
    public func completeMission(missionId: String) {
        guard let idx = missions.firstIndex(where: { $0.id == missionId }) else { return }
        let mission = missions[idx]
        if mission.completed { return } // Guard against double-completion

        var updated = missions
        updated[idx].completed = true
        let newCompletedCount = MissionsEngine.completedCount(updated)
        let newDailyXP = MissionsEngine.calculateTotalXP(updated.filter { $0.completed })
        let isPerfectDay = newCompletedCount == updated.count

        missions = updated
        completedCount = newCompletedCount
        dailyXP = newDailyXP
        totalXP = totalXP + mission.xp
        lockedInToday = isPerfectDay

        // Analytics — `Mission Completed`
        onAnalyticsTrack?(MissionsRoute.AnalyticsEvent.missionCompleted, [
            "mission_id": mission.id,
            "mission_title": mission.title,
            "mission_type": mission.type.rawValue,
            "mission_difficulty": mission.difficulty.rawValue,
            "xp": mission.xp,
            "slot": mission.slot.rawValue,
            "completed_count": newCompletedCount
        ])

        if isPerfectDay {
            onAnalyticsTrack?(MissionsRoute.AnalyticsEvent.allMissionsCompleted, [
                "total_xp": newDailyXP
            ])
            onPerfectDay?(newCompletedCount)
        }

        completedToast = MissionCompletedToast(
            missionTitle: mission.title,
            xp: mission.xp,
            completedCount: newCompletedCount,
            totalCount: updated.count,
            isPerfectDay: isPerfectDay
        )

        // Persist
        let profile = Self.buildProfileKey(goal: userGoal, weaknesses: userWeaknesses)
        persistDaily(missions: updated, date: date, profile: profile)
        persistCumulativeXP(totalXP)

        // Legacy counter fan-out (kept populated for admin queries; the
        // letter-tier UI no longer reads these directly after the unified
        // per-stat XP migration).
        StatsService.bumpCounter(.totalMissionsCompleted, delta: 1)
        if let tags = mission.stats {
            if tags.contains(.discipline) {
                StatsService.bumpCounter(.totalDistractionsResisted, delta: 1)
            }
            if tags.contains(.social) {
                StatsService.bumpCounter(.guildCheckIns, delta: 1)
            }
        }

        // ── Unified per-stat XP fan-out ──
        //
        // Every mission earns EXE XP (it's an act of execution regardless
        // of theme), plus a per-tag bonus on the stat the mission is
        // specifically themed around. All multiplied by the streak XP
        // modifier — consistency is rewarded by accelerating earn rate
        // (caps at 1.5× at 180+ day streaks).
        let streakBonusedXp: (Int) -> Int = { base in
            RankHelpers.applyStreakMultiplier(baseXp: base, streak: self.streak)
        }
        StatsService.bumpStatXp(.execution, delta: streakBonusedXp(15))
        if let tags = mission.stats {
            if tags.contains(.discipline) {
                StatsService.bumpStatXp(.discipline, delta: streakBonusedXp(30))
            }
            if tags.contains(.social) {
                StatsService.bumpStatXp(.social, delta: streakBonusedXp(30))
            }
            if tags.contains(.consistency) {
                StatsService.bumpStatXp(.consistency, delta: streakBonusedXp(20))
            }
            // .focus tag intentionally doesn't fan-out — FOC XP is earned
            // exclusively from lock-in minutes (with the 180/day cap) so
            // mission completion can't shortcut around the cap.
        }

        // Server XP fan-out (was missing — local-only XP previously)
        XPService.award(.mission)
        if isPerfectDay {
            XPService.award(.perfectDay)
            StatsService.bumpCounter(.totalPerfectDays, delta: 1)
            // Perfect-day bonus: extra EXE (+50) and CON (+30) on top of
            // the per-mission XP above. The trigger is "all 3 missions
            // complete on a day the daily focus goal was already met".
            // Streak multiplier applies — perfect-day-on-a-streak is the
            // peak earning moment.
            StatsService.bumpStatXp(.execution, delta: streakBonusedXp(50))
            StatsService.bumpStatXp(.consistency, delta: streakBonusedXp(30))
        }

        // Evaluate achievement unlocks now that counters have advanced.
        // `AchievementService.evaluate` internally refreshes server stats
        // before checking predicates, so a threshold-crossing mission
        // unlocks on **this** completion (not the next one).
        AchievementService.evaluate(AchievementContext(
            consecutiveStreak: streak,
            lifetimeRunsCompleted: 0,
            lifetimeTotalMinutes: 0,
            dailyGoalMet: isPerfectDay
        ))

        // Forward to coordinator (W11 owns the `complete-mission` edge function call).
        onMissionCompleted?(mission)

        // The "Next: …" mission title may have changed (or cleared on a
        // perfect day) — push to widgets.
        publishNextMissionToWidget()
    }

    /// `UPDATE_DAILY_PROGRESS` — advance progress on a daily mission without
    /// completing it. Used by `checkAutoComplete` to show "25/45 min" etc.
    public func updateDailyProgress(missionId: String, progress: Int, progressTarget: Int) {
        guard let idx = missions.firstIndex(where: { $0.id == missionId }),
              missions[idx].completed == false
        else { return }
        missions[idx].progress = min(progress, progressTarget)
        missions[idx].progressTarget = progressTarget

        let profile = Self.buildProfileKey(goal: userGoal, weaknesses: userWeaknesses)
        persistDaily(missions: missions, date: date, profile: profile)
    }

    /// `GENERATE_DAILY` — overwrite today's set with a freshly generated 3.
    public func generateDailyMissions(for goal: String) {
        let newMissions = MissionsEngine.generateDailyMissions(
            MissionGenerationParams(
                goal: goal,
                weaknesses: userWeaknesses,
                onboardingDate: onboardingDate,
                streak: streak
            )
        )
        let today = Self.localDateKey()
        let profile = Self.buildProfileKey(goal: goal, weaknesses: userWeaknesses)
        userGoal = goal
        applyGenerated(missions: newMissions, date: today)
        persistDaily(missions: newMissions, date: today, profile: profile)
        publishNextMissionToWidget()
    }

    /// Regenerate today's 3 missions. Used after settings updates.
    /// Preserves mid-week weekly progress unless the week has rolled over.
    public func regenerateTodaysMissions(goalOverride: String? = nil, weaknessesOverride: [String]? = nil) {
        let g = goalOverride ?? userGoal
        let w = weaknessesOverride ?? userWeaknesses
        let profile = Self.buildProfileKey(goal: g, weaknesses: w)

        let newMissions = MissionsEngine.generateDailyMissions(
            MissionGenerationParams(
                goal: g,
                weaknesses: w,
                onboardingDate: onboardingDate,
                streak: streak
            )
        )
        let today = Self.localDateKey()

        if let goalOverride { userGoal = goalOverride }
        if let weaknessesOverride { userWeaknesses = weaknessesOverride }
        applyGenerated(missions: newMissions, date: today)

        let currentWeekKey = MissionsEngine.missionWeekKey()
        if weekKey != currentWeekKey || weeklyMissions.isEmpty {
            let newWeekly = MissionsEngine.normalizeWeeklyMissions(
                MissionsEngine.generateWeeklyMissions(
                    MissionGenerationParams(
                        goal: g,
                        weaknesses: w,
                        onboardingDate: onboardingDate,
                        streak: streak
                    )
                )
            )
            weeklyMissions = newWeekly
            weekKey = currentWeekKey
            persistWeekly(missions: newWeekly, weekKey: currentWeekKey, profile: profile)
        }
        persistDaily(missions: newMissions, date: today, profile: profile)
        publishNextMissionToWidget()
    }

    /// `RESET_DAY` — empty today's missions (does NOT regenerate). Mirrors RN.
    public func resetDay() {
        missions = []
        date = Self.localDateKey()
        completedCount = 0
        dailyXP = 0
        lockedInToday = false
        publishNextMissionToWidget()
    }

    /// `FULL_LOGOUT_RESET` — wipe runtime state. Persistence is cleared
    /// separately by the auth-cleanup pipeline.
    public func fullLogoutReset() {
        missions = []
        weeklyMissions = []
        weekKey = MissionsEngine.missionWeekKey()
        date = Self.localDateKey()
        completedCount = 0
        dailyXP = 0
        totalXP = 0
        lockedInToday = false
        completedToast = nil
        publishNextMissionToWidget()
    }

    /// Clear the toast after the overlay finishes.
    public func dismissCompletedToast() {
        completedToast = nil
    }

    // MARK: - Widget snapshot bridge

    /// First incomplete daily mission title — drives the "Next mission" row
    /// in the Today widget. nil when every daily mission is complete (the
    /// widget falls back to "All missions complete").
    public var nextMissionTitle: String? {
        missions.first(where: { !$0.completed })?.title
    }

    /// Re-publish the App Group `WidgetSnapshot` with the latest mission
    /// progress, daily XP, and `nextMissionTitle`. Reads the current snapshot
    /// to preserve all HomeState-owned fields (streak, daily focus, lifetime).
    ///
    /// No-ops when no prior snapshot exists; HomeState will publish on its
    /// next persist() and we'll catch up on the following mutation.
    public func publishNextMissionToWidget() {
        guard let prev = WidgetDataPublisher.shared.loadSnapshot() else { return }
        let newTitle = nextMissionTitle
        let newCompleted = completedCount
        // Use the actual mission count when we have one; fall back to 3 so a
        // pre-hydrate snapshot still renders a sensible HUD denominator.
        let newTotal = missions.isEmpty ? 3 : missions.count
        let newXp = dailyXP

        // Skip the write when nothing changed — saves a WidgetCenter reload.
        if prev.nextMissionTitle == newTitle
            && prev.todayMissionsCompleted == newCompleted
            && prev.todayMissionsTotal == newTotal
            && prev.todayXpEarned == newXp {
            return
        }

        let snapshot = WidgetSnapshot(
            consecutiveStreak: prev.consecutiveStreak,
            dailyFocusedMinutes: prev.dailyFocusedMinutes,
            dailyGoalMinutes: prev.dailyGoalMinutes,
            dailyGoalMet: prev.dailyGoalMet,
            lifetimeLongestStreak: prev.lifetimeLongestStreak,
            currentSessionEndsAtMs: prev.currentSessionEndsAtMs,
            rankTierId: prev.rankTierId,
            nextMissionTitle: newTitle,
            todayMissionsCompleted: newCompleted,
            todayMissionsTotal: newTotal,
            todayXpEarned: newXp,
            lifetimeFocusedMinutes: prev.lifetimeFocusedMinutes,
            publishedAtMs: Date().timeIntervalSince1970 * 1000.0
        )
        WidgetDataPublisher.shared.publish(snapshot)
    }

    // MARK: - Auto-complete on session-end

    /// Walks the daily missions and completes any whose auto-complete rule
    /// matches the supplied session data. Mirrors `checkAutoComplete` in
    /// `apps/mobile/src/features/missions/MissionsProvider.tsx:840-923`.
    public func checkAutoComplete(_ data: SessionCompleteData) {
        let hour = Calendar.current.component(.hour, from: Date())

        for mission in missions {
            if mission.completed || mission.completionType != .auto { continue }

            let required = Self.parseMinutesFromDescription(mission.description)
            var progress: Int? = nil
            var target: Int? = nil
            var shouldComplete = false

            switch mission.title {
            case "Morning Focus Sprint":
                if hour < 10 {
                    target = required
                    progress = data.durationMinutes
                    shouldComplete = data.durationMinutes >= required
                }
            case "Deep Work Block":
                target = required
                progress = data.durationMinutes
                shouldComplete = data.durationMinutes >= required
            case "Afternoon Lock In":
                if hour >= 12 && hour < 17 {
                    target = required
                    progress = data.durationMinutes
                    shouldComplete = data.durationMinutes >= required
                }
            case "Evening Focus Session":
                if hour >= 17 && hour < 21 {
                    target = required
                    progress = data.durationMinutes
                    shouldComplete = data.durationMinutes >= required
                }
            case "Focus Marathon":
                target = required
                progress = data.dailyFocusedMinutes
                shouldComplete = data.dailyFocusedMinutes >= required
            case "Hit Your Daily Goal":
                shouldComplete = data.dailyGoalMet
            case "Double Lock In":
                // Description suffix is "N × M-min" / "N × M". Multiply for total minutes.
                let parts = mission.description.split(separator: "—")
                let variant = parts.count > 1 ? String(parts.last ?? "") : ""
                let totalRequired = Self.parseDoubleLockInTotalMinutes(variant)
                if totalRequired > 0 {
                    target = totalRequired
                    progress = data.dailyFocusedMinutes
                    shouldComplete = data.dailyFocusedMinutes >= totalRequired
                }
            case "Streak Builder":
                if required > 0 {
                    target = required
                    progress = data.durationMinutes
                    shouldComplete = data.durationMinutes >= required
                } else {
                    // Easy variant: "Any session today" — complete immediately.
                    shouldComplete = true
                }
            // First Thing Focus, Distraction-Free Hour — left as manual tap-to-complete.
            default:
                break
            }

            if let target, let progress {
                updateDailyProgress(missionId: mission.id, progress: progress, progressTarget: target)
            }
            if shouldComplete {
                completeMission(missionId: mission.id)
            }
        }
    }

    // MARK: - Active-day / early-open tracking (weekly progress signals)

    /// Record that today was an active day (had a focus session). Used by
    /// weekly missions whose `progressMetric == .daysActive`.
    public static func recordActiveDay() {
        recordWeeklyDay(key: MissionsStorageKeys.weeklyActiveDays)
    }

    /// Record that the app was opened before 9 AM today. Used by weekly
    /// missions whose `progressMetric == .firstOpenBefore9am`.
    public static func recordEarlyOpen() {
        let now = Date()
        let hour = Calendar.current.component(.hour, from: now)
        guard hour < 9 else { return }
        recordWeeklyDay(key: MissionsStorageKeys.weeklyEarlyOpens)
    }

    private static func recordWeeklyDay(key: String) {
        let today = localDateKey()
        let weekKey = MissionsEngine.missionWeekKey()
        let stored: WeeklyDayLog? = Defaults.codable(WeeklyDayLog.self, key)
        if stored?.weekKey != weekKey {
            Defaults.setCodable(WeeklyDayLog(weekKey: weekKey, days: [today]), key)
            return
        }
        guard var log = stored, !log.days.contains(today) else { return }
        log.days.append(today)
        Defaults.setCodable(log, key)
    }

    // MARK: - Persistence

    private func persistDaily(missions: [Mission], date: String, profile: String) {
        Defaults.setCodable(missions, MissionsStorageKeys.dailyMissions)
        Defaults.setString(date, MissionsStorageKeys.dailyMissionsDate)
        Defaults.setString(profile, MissionsStorageKeys.dailyMissionsProfile)
    }

    private func persistWeekly(missions: [Mission], weekKey: String, profile: String) {
        Defaults.setCodable(missions, MissionsStorageKeys.weeklyMissions)
        Defaults.setString(weekKey, MissionsStorageKeys.weeklyMissionsWeek)
        Defaults.setString(profile, MissionsStorageKeys.weeklyMissionsProfile)
    }

    private func persistCumulativeXP(_ xp: Int) {
        Defaults.setString(String(xp), MissionsStorageKeys.cumulativeXP)
    }

    /// Aligns stored XP with the current global mission season; resets XP when
    /// the season advances. Mirrors `loadSeasonAwareCumulativeXP` in RN.
    private static func loadSeasonAwareCumulativeXP() -> Int {
        let current = String(MissionXPSeason.currentSeasonNumber())
        let rawXpStr = Defaults.string(MissionsStorageKeys.cumulativeXP)
        let storedSeason = Defaults.string(MissionsStorageKeys.missionXPSeason)
        let rawXp = Int(rawXpStr ?? "0") ?? 0

        if storedSeason == nil {
            Defaults.setString(current, MissionsStorageKeys.missionXPSeason)
            return rawXp
        }
        if storedSeason != current {
            Defaults.setString(current, MissionsStorageKeys.missionXPSeason)
            Defaults.setString("0", MissionsStorageKeys.cumulativeXP)
            return 0
        }
        return rawXp
    }

    // MARK: - Helpers

    /// YYYY-MM-DD in the device's local timezone. Used for both `date` and
    /// the `daily_activity_done_<date>` key suffix.
    public static func localDateKey(date: Date = Date()) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone.current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    /// `${goal}::${weaknesses.sorted().join('|')}`. Mirrors RN cache-busting
    /// helper exactly.
    public static func buildProfileKey(goal: String, weaknesses: [String]) -> String {
        let sorted = weaknesses.sorted().joined(separator: "|")
        return "\(goal)::\(sorted)"
    }

    private func applyGenerated(missions: [Mission], date: String) {
        let completedCount = MissionsEngine.completedCount(missions)
        let dailyXP = MissionsEngine.calculateTotalXP(missions.filter { $0.completed })
        self.missions = missions
        self.date = date
        self.completedCount = completedCount
        self.dailyXP = dailyXP
        self.lockedInToday = completedCount == missions.count && !missions.isEmpty
    }

    /// Parse a minimum duration (in minutes) from the variant portion of a
    /// core mission description. Descriptions look like
    /// "Complete a focus session before 10 AM — 30-min session". Split on
    /// " — " so numbers in the base description (e.g. "10 AM") don't interfere.
    private static func parseMinutesFromDescription(_ desc: String) -> Int {
        let parts = desc.components(separatedBy: " — ")
        let variant = parts.count > 1 ? parts.last ?? "" : desc
        // Find the first number sequence.
        var digits = ""
        for ch in variant {
            if ch.isNumber {
                digits.append(ch)
            } else if !digits.isEmpty {
                break
            }
        }
        return Int(digits) ?? 0
    }

    /// "2 × 30-min" → 60. "2 × 15" → 30. Returns 0 if no `N × M` pair found.
    private static func parseDoubleLockInTotalMinutes(_ variant: String) -> Int {
        // Find two numbers separated by "×" or "x".
        let pattern = #"(\d+)\s*[×x]\s*(\d+)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return 0 }
        let range = NSRange(variant.startIndex..<variant.endIndex, in: variant)
        guard let match = regex.firstMatch(in: variant, range: range),
              match.numberOfRanges >= 3,
              let r1 = Range(match.range(at: 1), in: variant),
              let r2 = Range(match.range(at: 2), in: variant),
              let a = Int(variant[r1]),
              let b = Int(variant[r2])
        else { return 0 }
        return a * b
    }
}

// MARK: - Time-gate helper (used by MissionCard / MissionLogCard)

public enum MissionTimeGate {
    /// "After 9 PM" → unlocked once local hour ≥ 21.
    public static func isUnlocked(_ timeGate: String?, now: Date = Date()) -> Bool {
        guard let timeGate else { return true }
        // Match "After 9 AM" / "After 12 PM" etc.
        let pattern = #"After (\d{1,2})\s*(AM|PM)"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive)
        else { return true }
        let range = NSRange(timeGate.startIndex..<timeGate.endIndex, in: timeGate)
        guard let match = regex.firstMatch(in: timeGate, range: range),
              match.numberOfRanges >= 3,
              let hourRange = Range(match.range(at: 1), in: timeGate),
              let suffixRange = Range(match.range(at: 2), in: timeGate),
              var hour = Int(timeGate[hourRange])
        else { return true }
        let suffix = timeGate[suffixRange].uppercased()
        if suffix == "PM" && hour != 12 { hour += 12 }
        if suffix == "AM" && hour == 12 { hour = 0 }
        let currentHour = Calendar.current.component(.hour, from: now)
        return currentHour >= hour
    }
}
