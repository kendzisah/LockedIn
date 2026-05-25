import Foundation
import DesignKit

// MARK: - Public types

/// Mission classification. Drives icon, stat tags, and auto-complete logic.
///
/// Ported 1:1 from `MissionType` in
/// `apps/mobile/src/features/missions/MissionEngine.ts:23-34`.
public enum MissionType: String, Codable, Sendable, CaseIterable {
    case focus_session
    case workout_check
    case reflection
    case no_social
    case journal
    case reading
    case planning
    case discipline
    case lifestyle
    case social
    case custom
}

/// How a mission is marked complete.
public enum CompletionType: String, Codable, Sendable {
    case auto
    case selfReport = "self-report"
    case hybrid
}

public enum DifficultyTier: String, Codable, Sendable {
    case easy
    case medium
    case hard
}

public enum MissionSlot: String, Codable, Sendable {
    case core
    case goal
    case weakness
}

public enum MissionDuration: String, Codable, Sendable {
    case daily
    case weekly
}

public enum ProgressMetric: String, Codable, Sendable {
    case daysActive = "days_active"
    case daysStreak = "days_streak"
    case firstOpenBefore9am = "first_open_before_9am"
}

/// Runtime mission instance. The provider builds these from `MissionTemplate`
/// and persists them under `@lockedin/daily_missions` /
/// `@lockedin/weekly_missions`.
public struct Mission: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var title: String
    public var description: String
    public var type: MissionType
    public var completed: Bool
    public var failed: Bool?
    public var xp: Int
    public var slot: MissionSlot
    public var completionType: CompletionType
    public var difficulty: DifficultyTier
    public var timeGate: String?
    public var duration: MissionDuration
    public var progress: Int?
    public var progressTarget: Int?
    public var progressMetric: ProgressMetric?
    /// Stats this mission grows when completed. Defaults from `MISSION_TYPE_STATS`.
    public var stats: [Stat]?

    public init(
        id: String,
        title: String,
        description: String,
        type: MissionType,
        completed: Bool = false,
        failed: Bool? = nil,
        xp: Int,
        slot: MissionSlot,
        completionType: CompletionType,
        difficulty: DifficultyTier,
        timeGate: String? = nil,
        duration: MissionDuration = .daily,
        progress: Int? = nil,
        progressTarget: Int? = nil,
        progressMetric: ProgressMetric? = nil,
        stats: [Stat]? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.type = type
        self.completed = completed
        self.failed = failed
        self.xp = xp
        self.slot = slot
        self.completionType = completionType
        self.difficulty = difficulty
        self.timeGate = timeGate
        self.duration = duration
        self.progress = progress
        self.progressTarget = progressTarget
        self.progressMetric = progressMetric
        self.stats = stats
    }
}

/// Map mission type → primary stat(s) it grows. Order matters when 2 stats —
/// the first is the primary tag used by `MissionLogCard` and `CompactMissions`.
///
/// Ported 1:1 from `MISSION_TYPE_STATS` in
/// `apps/mobile/src/features/missions/MissionEngine.ts:44-56`.
public enum MissionTypeStats {
    public static let map: [MissionType: [Stat]] = [
        .focus_session: [.focus, .execution],
        .workout_check: [.discipline, .consistency],
        .reflection:    [.discipline],
        .no_social:     [.focus, .discipline],
        .journal:       [.discipline, .consistency],
        .reading:       [.focus],
        .planning:      [.execution],
        .discipline:    [.discipline],
        .lifestyle:     [.consistency],
        .social:        [.social],
        .custom:        [.execution]
    ]
}

// MARK: - Generation params

/// Inputs that drive `generateDailyMissions` /  `generateWeeklyMissions`.
public struct MissionGenerationParams: Equatable, Sendable {
    public var goal: String
    public var weaknesses: [String]
    public var date: Date
    /// ISO date string of when onboarding completed (for difficulty tier).
    public var onboardingDate: String?
    /// Current consecutive streak for the +10% XP bonus.
    public var streak: Int

    public init(
        goal: String,
        weaknesses: [String] = [],
        date: Date = Date(),
        onboardingDate: String? = nil,
        streak: Int = 0
    ) {
        self.goal = goal
        self.weaknesses = weaknesses
        self.date = date
        self.onboardingDate = onboardingDate
        self.streak = streak
    }
}

// MARK: - Engine

/// Pure mission generation + helpers. No SwiftUI / @Observable dependencies.
///
/// Ported 1:1 from
/// `apps/mobile/src/features/missions/MissionEngine.ts` (424 lines).
public enum MissionsEngine {

    /// Max concurrent weekly challenge rows (missed + replacement still fits in 2).
    public static let maxWeeklyChallenges: Int = 2

    /// Weekly XP is scaled above typical dailies (~15–35 XP) after streak bonus.
    public static let weeklyXpMultiplier: Int = 2

    public static func applyWeeklyXpPremium(_ xp: Int) -> Int {
        max(1, Int((Double(xp) * Double(weeklyXpMultiplier)).rounded()))
    }

    // MARK: - Helpers

    /// Day of year (Jan 1 = 1) using the local calendar. Matches the JS
    /// `getDayOfYear` implementation byte-for-byte for the cases the mission
    /// engine cares about (positive integer indexed at 1).
    public static func dayOfYear(date: Date) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone.current
        let comps = cal.dateComponents([.year], from: date)
        guard let yearStart = cal.date(from: DateComponents(
            year: comps.year, month: 1, day: 1
        )) else { return 0 }
        let secs = date.timeIntervalSince(yearStart)
        return Int(floor(secs / 86_400.0))
    }

    /// Simple deterministic hash for a string → stable non-negative integer.
    /// Mirrors the JS `hashStr` reducer byte-for-byte (32-bit signed wrap,
    /// then `Math.abs`).
    public static func hashStr(_ s: String) -> Int {
        var h: Int32 = 0
        for scalar in s.unicodeScalars {
            // Multiplication by 31 implemented as `(h << 5) - h`, matching JS.
            let shifted = h &<< 5
            h = shifted &- h
            // JS `+ s.charCodeAt(i)` adds the UTF-16 code unit (0…65535). Most
            // mission titles are pure ASCII; for those `scalar.value` matches.
            h = h &+ Int32(truncatingIfNeeded: scalar.value)
        }
        return Int(abs(Int64(h)))
    }

    /// Difficulty based on days since onboarding completed.
    public static func difficultyTier(daysSinceOnboarding: Int) -> DifficultyTier {
        if daysSinceOnboarding < 14 { return .easy }
        if daysSinceOnboarding < 28 { return .medium }
        return .hard
    }

    /// XP with optional streak bonus (+10% for streak ≥ 7).
    public static func applyStreakBonus(baseXP: Int, streak: Int) -> Int {
        streak >= 7 ? Int((Double(baseXP) * 1.1).rounded()) : baseXP
    }

    /// XP value for a tier from the template.
    public static func xp(template: MissionTemplate, tier: DifficultyTier) -> Int {
        switch tier {
        case .easy:   return template.xp.easy
        case .medium: return template.xp.medium
        case .hard:   return template.xp.hard
        }
    }

    /// Variant copy for a tier from the template.
    public static func variant(template: MissionTemplate, tier: DifficultyTier) -> String? {
        guard let v = template.variants else { return nil }
        switch tier {
        case .easy:   return v.easy
        case .medium: return v.medium
        case .hard:   return v.hard
        }
    }

    /// Build a runtime mission from a template.
    public static func buildMission(
        template: MissionTemplate,
        slot: MissionSlot,
        tier: DifficultyTier,
        streak: Int,
        dayOfYear: Int,
        index: Int
    ) -> Mission {
        let baseXP = xp(template: template, tier: tier)
        let desc: String = {
            if slot == .core, let v = variant(template: template, tier: tier) {
                return "\(template.description) — \(v)"
            }
            return template.description
        }()
        return Mission(
            id: "mission_\(dayOfYear)_\(index)",
            title: template.title,
            description: desc,
            type: template.type,
            completed: false,
            xp: applyStreakBonus(baseXP: baseXP, streak: streak),
            slot: slot,
            completionType: template.completionType,
            difficulty: tier,
            timeGate: template.timeGate,
            duration: template.duration ?? .daily,
            progress: template.duration == .weekly ? 0 : nil,
            progressTarget: template.progressTarget,
            progressMetric: template.progressMetric,
            stats: MissionTypeStats.map[template.type]
        )
    }

    // MARK: - Daily generation

    /// Generate 3 daily missions following the slot system from the mission
    /// matrix.
    ///
    /// Slot 1 (Core):     index = dayOfYear % 10
    /// Slot 2 (Goal):     index = hash(dayOfYear + goal) % 15
    /// Slot 3 (Weakness): rotate across user weaknesses, then hash picks mission.
    public static func generateDailyMissions(_ params: MissionGenerationParams) -> [Mission] {
        let day = dayOfYear(date: params.date)
        let daysSinceOnboarding = MissionsEngine.daysSinceOnboarding(
            from: params.onboardingDate,
            to: params.date
        )
        let tier = difficultyTier(daysSinceOnboarding: daysSinceOnboarding)

        // ── Slot 1: Core ──
        let coreList = MissionData.coreMissions
        let coreIndex = day.nonNegativeModulo(coreList.count)
        let coreMission = buildMission(
            template: coreList[coreIndex],
            slot: .core,
            tier: tier,
            streak: params.streak,
            dayOfYear: day,
            index: 0
        )

        // Daily slots must never serve weekly templates. Filter so a future
        // weekly entry accidentally added to a goal / weakness pool is silently
        // skipped from the daily rotation.
        func dailyOnly(_ pool: [MissionTemplate]) -> [MissionTemplate] {
            pool.filter { $0.duration != .weekly }
        }

        // ── Slot 2: Goal ──
        let goalPoolRaw = MissionData.goalMissions[params.goal]
            ?? MissionData.goalMissions["Increase discipline & self-control"]!
        let goalPool = dailyOnly(goalPoolRaw)
        let goalIndex = hashStr("\(day)_\(params.goal)") % goalPool.count
        let goalMission = buildMission(
            template: goalPool[goalIndex],
            slot: .goal,
            tier: tier,
            streak: params.streak,
            dayOfYear: day,
            index: 1
        )

        // ── Slot 3: Weakness ──
        let validWeaknesses = params.weaknesses.filter { MissionData.weaknessMissions[$0] != nil }
        var weaknessMission: Mission

        if validWeaknesses.isEmpty {
            let fallbackPool = dailyOnly(MissionData.weaknessMissions["I lack daily consistency"] ?? [])
            let fallbackIndex = hashStr("\(day)_weakness") % max(1, fallbackPool.count)
            weaknessMission = buildMission(
                template: fallbackPool[fallbackIndex],
                slot: .weakness,
                tier: tier,
                streak: params.streak,
                dayOfYear: day,
                index: 2
            )
        } else {
            let key = validWeaknesses[day.nonNegativeModulo(validWeaknesses.count)]
            let pool = dailyOnly(MissionData.weaknessMissions[key] ?? [])
            let initialIndex = hashStr("\(day)_\(key)") % max(1, pool.count)
            weaknessMission = buildMission(
                template: pool[initialIndex],
                slot: .weakness,
                tier: tier,
                streak: params.streak,
                dayOfYear: day,
                index: 2
            )

            // Dedup: re-roll if title collides with the goal mission.
            if weaknessMission.title == goalMission.title {
                for attempt in 1..<pool.count {
                    let nextIndex = (initialIndex + attempt) % pool.count
                    let candidate = buildMission(
                        template: pool[nextIndex],
                        slot: .weakness,
                        tier: tier,
                        streak: params.streak,
                        dayOfYear: day,
                        index: 2
                    )
                    if candidate.title != goalMission.title {
                        weaknessMission = candidate
                        break
                    }
                }
            }
        }

        return [coreMission, goalMission, weaknessMission]
    }

    /// Legacy compatibility wrapper for callers that only pass a goal.
    public static func getMissionsForGoal(_ goal: String, date: Date = Date()) -> [Mission] {
        generateDailyMissions(MissionGenerationParams(goal: goal, weaknesses: [], date: date))
    }

    // MARK: - Weekly generation

    /// Collect weekly mission templates from the user's active pools (unique titles).
    public static func buildWeeklyTemplatePool(
        _ params: MissionGenerationParams
    ) -> [(template: MissionTemplate, slot: MissionSlot)] {
        var weekly: [(template: MissionTemplate, slot: MissionSlot)] = []
        var seenTitles = Set<String>()

        func addUnique(_ t: MissionTemplate, _ slot: MissionSlot) {
            if t.duration == .weekly && !seenTitles.contains(t.title) {
                seenTitles.insert(t.title)
                weekly.append((t, slot))
            }
        }

        let validWeaknesses = params.weaknesses.filter { MissionData.weaknessMissions[$0] != nil }
        for wk in validWeaknesses {
            for t in MissionData.weaknessMissions[wk] ?? [] {
                addUnique(t, .weakness)
            }
        }
        if validWeaknesses.isEmpty {
            for t in MissionData.weaknessMissions["I lack daily consistency"] ?? [] {
                addUnique(t, .weakness)
            }
        }

        let goalPool = MissionData.goalMissions[params.goal]
            ?? MissionData.goalMissions["Increase discipline & self-control"]
            ?? []
        for t in goalPool {
            addUnique(t, .goal)
        }

        return weekly
    }

    /// Dedupe titles, prefer failed rows first, cap at `maxWeeklyChallenges`.
    public static func normalizeWeeklyMissions(_ missions: [Mission]) -> [Mission] {
        let weeklyOnly = missions.filter { $0.duration == .weekly }
        var seen = Set<String>()
        var deduped: [Mission] = []
        for m in weeklyOnly {
            if seen.contains(m.title) { continue }
            seen.insert(m.title)
            deduped.append(m)
        }
        let sorted = deduped.sorted { a, b in
            // 1. failed first
            if (a.failed ?? false) != (b.failed ?? false) {
                return (a.failed ?? false)
            }
            // 2. uncompleted before completed
            if a.completed != b.completed {
                return !a.completed
            }
            return false
        }
        return Array(sorted.prefix(maxWeeklyChallenges))
    }

    /// Pick one weekly mission per week, rotating through available templates.
    public static func generateWeeklyMissions(_ params: MissionGenerationParams) -> [Mission] {
        let day = dayOfYear(date: params.date)
        let daysSinceOnboarding = MissionsEngine.daysSinceOnboarding(
            from: params.onboardingDate,
            to: params.date
        )
        let tier = difficultyTier(daysSinceOnboarding: daysSinceOnboarding)
        let weekKey = missionWeekKey(date: params.date)
        let weeklyTemplates = buildWeeklyTemplatePool(params)

        if weeklyTemplates.isEmpty { return [] }

        let weekNumber = Int(weekKey.filter { $0.isNumber }) ?? 0
        let picked = weeklyTemplates[weekNumber.nonNegativeModulo(weeklyTemplates.count)]
        let base = buildMission(
            template: picked.template,
            slot: picked.slot,
            tier: tier,
            streak: params.streak,
            dayOfYear: day,
            index: 100
        )
        var m = base
        m.id = "weekly_\(weekKey)_\(hashStr(picked.template.title))_0"
        m.progress = 0
        m.xp = applyWeeklyXpPremium(base.xp)
        return [m]
    }

    /// Next weekly challenge after the primary pick, excluding titles already
    /// on screen.
    public static func generateWeeklyReplacementMission(
        _ params: MissionGenerationParams,
        excludeTitles: [String]
    ) -> Mission? {
        let pool = buildWeeklyTemplatePool(params)
        if pool.isEmpty { return nil }

        let excluded = Set(excludeTitles)
        let weekKey = missionWeekKey(date: params.date)
        let weekNumber = Int(weekKey.filter { $0.isNumber }) ?? 0
        let day = dayOfYear(date: params.date)
        let daysSinceOnboarding = MissionsEngine.daysSinceOnboarding(
            from: params.onboardingDate,
            to: params.date
        )
        let tier = difficultyTier(daysSinceOnboarding: daysSinceOnboarding)

        for offset in 1...pool.count {
            let idx = (weekNumber + offset).nonNegativeModulo(pool.count)
            let picked = pool[idx]
            if excluded.contains(picked.template.title) { continue }
            let base = buildMission(
                template: picked.template,
                slot: picked.slot,
                tier: tier,
                streak: params.streak,
                dayOfYear: day,
                index: 100
            )
            var m = base
            m.id = "weekly_\(weekKey)_\(hashStr(picked.template.title))_r\(offset)"
            m.progress = 0
            m.xp = applyWeeklyXpPremium(base.xp)
            return m
        }
        return nil
    }

    // MARK: - Week math

    /// Days remaining in the current ISO week (Mon=1 .. Sun=7).
    /// Sunday returns 0 (last day), Monday returns 6, etc.
    public static func remainingDaysInWeek(date: Date = Date()) -> Int {
        let cal = Calendar(identifier: .gregorian)
        let weekday = cal.component(.weekday, from: date) // 1=Sun, 2=Mon, ... 7=Sat
        let jsDay = weekday - 1                            // 0=Sun, 1=Mon, ... 6=Sat
        let isoDay = jsDay == 0 ? 7 : jsDay                // Mon=1 ... Sun=7
        return 7 - isoDay
    }

    /// ISO week key (YYYY-Www) for the device's local date.
    ///
    /// Direct port of the JS implementation in
    /// `apps/mobile/src/features/missions/MissionEngine.ts:248-255`. Uses the
    /// "shift to Thursday of the week, then compute year-start delta" trick.
    public static func missionWeekKey(date: Date = Date()) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone.current
        let comps = cal.dateComponents([.year, .month, .day], from: date)
        guard var d = cal.date(from: DateComponents(
            year: comps.year, month: comps.month, day: comps.day
        )) else { return "" }
        // Shift to Thursday of the current ISO week.
        let weekday = cal.component(.weekday, from: d) // 1=Sun ... 7=Sat
        let jsDay = weekday - 1                         // 0=Sun ... 6=Sat
        let day = jsDay == 0 ? 7 : jsDay                // Mon=1 ... Sun=7
        if let shifted = cal.date(byAdding: .day, value: 4 - day, to: d) {
            d = shifted
        }
        let isoYear = cal.component(.year, from: d)
        guard let yearStart = cal.date(from: DateComponents(
            year: isoYear, month: 1, day: 1
        )) else { return "\(isoYear)-W01" }
        let secsFromStart = d.timeIntervalSince(yearStart)
        let weekNo = Int(ceil((secsFromStart / 86_400.0 + 1.0) / 7.0))
        return String(format: "%d-W%02d", isoYear, weekNo)
    }

    // MARK: - XP / count helpers

    public static func calculateTotalXP(_ missions: [Mission]) -> Int {
        missions.reduce(0) { $0 + $1.xp }
    }

    public static func completedCount(_ missions: [Mission]) -> Int {
        missions.filter { $0.completed }.count
    }

    public static func primaryGoals() -> [String] {
        Array(MissionData.goalMissions.keys)
    }

    public static func weaknessOptions() -> [String] {
        Array(MissionData.weaknessMissions.keys)
    }

    /// Aggregate stats grown by completing missions from this pool. Mirrors the
    /// bump logic in `MissionsState.completeMission`:
    ///   - every completion bumps `total_missions_completed` → Execution
    ///   - `discipline`-tagged missions bump `total_distractions_resisted` → Discipline
    ///   - `social`-tagged missions bump `guild_check_ins` → Social
    /// Focus / Consistency grow from session minutes / perfect days elsewhere.
    public static func statsFor(goal: String) -> [Stat] {
        aggregateStats(templates: MissionData.goalMissions[goal])
    }

    public static func statsFor(weakness: String) -> [Stat] {
        aggregateStats(templates: MissionData.weaknessMissions[weakness])
    }

    private static let statOrder: [Stat] = [.discipline, .focus, .execution, .consistency, .social]

    private static func aggregateStats(templates: [MissionTemplate]?) -> [Stat] {
        guard let templates, !templates.isEmpty else { return [] }
        var set = Set<Stat>()
        set.insert(.execution)
        for t in templates {
            let tags = MissionTypeStats.map[t.type] ?? []
            if tags.contains(.discipline) { set.insert(.discipline) }
            if tags.contains(.social)     { set.insert(.social) }
        }
        return statOrder.filter { set.contains($0) }
    }

    // MARK: - Internal

    /// Days between onboardingDate (`YYYY-MM-DD`) and `date`, clamped at 0.
    private static func daysSinceOnboarding(from onboarding: String?, to date: Date) -> Int {
        guard let onboarding else { return 0 }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        guard let onbDate = formatter.date(from: String(onboarding.prefix(10))) else {
            // Try ISO parsing as a fallback.
            let isoFormatter = ISO8601DateFormatter()
            guard let parsed = isoFormatter.date(from: onboarding) else { return 0 }
            return max(0, Int(date.timeIntervalSince(parsed) / 86_400.0))
        }
        return max(0, Int(date.timeIntervalSince(onbDate) / 86_400.0))
    }
}

// MARK: - Modulo helper

private extension Int {
    /// Mirrors JS `a % b` for non-negative outputs, but guards `b > 0`.
    func nonNegativeModulo(_ b: Int) -> Int {
        guard b > 0 else { return 0 }
        let r = self % b
        return r < 0 ? r + b : r
    }
}
