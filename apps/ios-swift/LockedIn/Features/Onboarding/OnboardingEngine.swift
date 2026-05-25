import Foundation

/// OnboardingEngine — pure business logic for the onboarding flow.
///
/// Mirrors helpers spread across:
///  - `WakeUpCallScreen.tsx` (parseHours, calcYears, reclaim math)
///  - `BenefitReportScreen.tsx` (projectStats, GOAL_TO_STATS, WEAKNESS_TO_STAT)
///  - `SystemAnalysisScreen.tsx` (GOAL_DISPLAY humanization)
///  - `ScheduleSessionScreen.tsx` (time formatting helpers)
///  - `PaywallScreen.tsx` (formatScheduledTime)
///
/// Kept stateless and value-typed so the Swift screens are unit-testable
/// independent of the @Observable state object.
public enum OnboardingEngine {

    // MARK: - Wake-Up Call math (port of WakeUpCallScreen.tsx)

    public static let fallbackHours: Double = 4.5
    public static let defaultRemainingYears: Double = 50
    public static let reclaimPct: Double = 0.8

    /// Maps the persisted phone-usage value to the midpoint of its band so
    /// the years-lost calculation matches the spec table (2–3h → 5.2y, 4–5h
    /// → 9.4y, 6–7h → 13.5y, 8+h → 17.7y).
    public static func parseHours(from value: String?) -> Double {
        guard let value, value != "unknown" else { return fallbackHours }
        // Extract leading integer
        let digits = value.prefix { $0.isNumber }
        guard let n = Int(digits) else { return fallbackHours }
        if n <= 3 { return 2.5 }
        if n <= 5 { return 4.5 }
        if n <= 7 { return 6.5 }
        return 8.5
    }

    /// Time-budget model: hours/day × remaining years ÷ 24.
    public static func calcYearsLost(hours: Double, age: Int?) -> Double {
        let remaining: Double
        if let age {
            remaining = max(20.0, 80.0 - Double(age))
        } else {
            remaining = defaultRemainingYears
        }
        return (hours * remaining) / 24.0
    }

    public static func reclaimedHours(_ hours: Double) -> Double {
        // 1 decimal to mirror RN `+ ... .toFixed(1)`.
        return Double((hours * reclaimPct * 10).rounded()) / 10
    }

    public static func remainingHours(_ hours: Double) -> Double {
        Double((hours * (1 - reclaimPct) * 10).rounded()) / 10
    }

    public static func reclaimDaysPerYear(reclaimedHours: Double) -> Int {
        Int((reclaimedHours * 365.0 / 24.0).rounded())
    }

    // MARK: - SystemAnalysis goal humanization

    public static let goalDisplayMap: [String: String] = [
        "Build a business or side project": "business",
        "Advance my career": "career",
        "Improve my physique": "physique",
        "Increase discipline & self-control": "discipline",
        "Reduce distractions": "focus",
        "Improve emotional control": "emotional control",
        "Study with consistency": "study",
    ]

    public static func humanizedGoal(_ goal: String?) -> String {
        guard let goal else { return "discipline" }
        return goalDisplayMap[goal] ?? goal.lowercased()
    }

    // MARK: - Day-90 stat projection (BenefitReport)

    public enum StatKey: String, CaseIterable {
        case discipline, focus, execution, consistency, social
    }

    public static let goalToStats: [String: (StatKey, StatKey)] = [
        "Improve my physique":                (.discipline, .consistency),
        "Build a business or side project":   (.execution,  .focus),
        "Increase discipline & self-control": (.discipline, .focus),
        "Advance my career":                  (.execution,  .consistency),
        "Study with consistency":             (.focus,      .consistency),
        "Reduce distractions":                (.focus,      .discipline),
        "Improve emotional control":          (.discipline, .execution),
    ]

    public static let weaknessToStat: [String: StatKey] = [
        "I scroll when I should execute":  .focus,
        "I start strong, then fall off":   .consistency,
        "I get emotionally reactive":      .discipline,
        "I relapse into distractions":     .focus,
        "I lack daily consistency":        .consistency,
    ]

    public struct ProjectedStat: Identifiable, Equatable {
        public let key: StatKey
        public let value: Int
        public var id: String { key.rawValue }
    }

    /// Project the user's stat profile at Day 90. Mirrors the function of
    /// the same name in BenefitReportScreen.tsx (lines 73-98).
    public static func projectStats(
        primaryGoal: String?,
        weaknesses: [String]
    ) -> [ProjectedStat] {
        let pair = goalToStats[primaryGoal ?? ""] ?? (.discipline, .focus)
        let primary = pair.0
        let secondary = pair.1
        let weaknessStats = Set(weaknesses.compactMap { weaknessToStat[$0] })

        return StatKey.allCases.map { key in
            var base: Int
            if key == primary { base = 78 }
            else if key == secondary { base = 72 }
            else if key == .social { base = 58 }
            else { base = 64 }
            if weaknessStats.contains(key) { base = min(85, base + 4) }
            return ProjectedStat(key: key, value: base)
        }
    }

    // MARK: - Time formatting

    /// "HH:MM" (24h) → "h:MM AM/PM".
    public static func format12h(_ hhmm: String) -> String {
        let parts = hhmm.split(separator: ":")
        guard parts.count == 2,
              let h24 = Int(parts[0]),
              parts[1].count == 2 else {
            return hhmm
        }
        let m = String(parts[1])
        let ampm = h24 < 12 ? "AM" : "PM"
        let h12 = h24 == 0 ? 12 : (h24 > 12 ? h24 - 12 : h24)
        return "\(h12):\(m) \(ampm)"
    }

    public static func format12h(hour: Int, minute: Int) -> String {
        let h12 = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour)
        let ampm = hour < 12 ? "AM" : "PM"
        return String(format: "%d:%02d %@", h12, minute, ampm)
    }

    public static func pad(_ n: Int) -> String {
        n < 10 ? "0\(n)" : String(n)
    }
}
