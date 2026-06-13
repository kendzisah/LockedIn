import Foundation

/// Swift port of `apps/mobile/src/features/trial/TrialChallengeService.ts`.
///
/// Local-only (no Supabase). Persists a 3-day challenge state at
/// `@lockedin/trial_challenge` in standard `UserDefaults`.
///
/// API mirrors the RN static-class surface 1:1:
/// - `initializeTrial()`
/// - `isTrialActive()` -> Bool
/// - `getTrialDay()` -> 0 | 1 | 2 | 3
/// - `updateFocusMinutes(day:minutes:)`
/// - `completeTrialTask(day:task:)`
/// - `getTrialProgress()` -> (day, tasksCompleted, totalTasks)
/// - `getTrialTimeRemaining()` -> (hours, minutes, expired)
/// - `resetTrial()`
public enum TrialDayType: Int, Codable, Sendable {
    case one = 1
    case two = 2
    case three = 3
}

public enum TrialTaskType: String, Sendable {
    case focusSession
    case beatFocusTime
    case missions
    case disciplineReport
}

public struct TrialDay: Codable, Sendable, Equatable {
    public var day: Int
    public var focusSessionDone: Bool
    public var missionsDone: Bool
    public var focusMinutes: Int

    public init(day: Int, focusSessionDone: Bool = false, missionsDone: Bool = false, focusMinutes: Int = 0) {
        self.day = day
        self.focusSessionDone = focusSessionDone
        self.missionsDone = missionsDone
        self.focusMinutes = focusMinutes
    }
}

public struct TrialChallengeState: Codable, Sendable, Equatable {
    public var startDate: String  // ISO 8601 string — matches RN `new Date().toISOString()`
    public var days: [TrialDay]
    public var completed: Bool

    public init(startDate: String, days: [TrialDay], completed: Bool) {
        self.startDate = startDate
        self.days = days
        self.completed = completed
    }
}

public struct TrialProgress: Sendable, Equatable {
    public let day: Int
    public let tasksCompleted: Int
    public let totalTasks: Int
}

public struct TrialTimeRemaining: Sendable, Equatable {
    public let hours: Int
    public let minutes: Int
    public let expired: Bool
}

public enum TrialChallengeService {
    /// Persistence key — preserve verbatim from RN.
    public static let storageKey = "@lockedin/trial_challenge"
    /// Total trial length.
    public static let trialDurationDays = 3

    // MARK: - ISO 8601 formatter (matches JS `toISOString()`)

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static func isoString(from date: Date) -> String {
        isoFormatter.string(from: date)
    }

    private static func date(fromISO string: String) -> Date? {
        // ISO8601DateFormatter with fractional seconds is strict — fall back
        // to a forgiving parser if the stored string lacks ms precision.
        if let d = isoFormatter.date(from: string) { return d }
        let fallback = ISO8601DateFormatter()
        fallback.formatOptions = [.withInternetDateTime]
        return fallback.date(from: string)
    }

    // MARK: - Public API

    /// Initialize a new trial challenge state, persisting it immediately.
    public static func initializeTrial() {
        let state = TrialChallengeState(
            startDate: isoString(from: Date()),
            days: [
                TrialDay(day: 1),
                TrialDay(day: 2),
                TrialDay(day: 3)
            ],
            completed: false
        )
        Defaults.setCodable(state, storageKey)
    }

    /// Returns true if within `trialDurationDays` of start and not completed.
    public static func isTrialActive() -> Bool {
        guard let state = getState() else { return false }
        guard let start = date(fromISO: state.startDate) else { return false }

        let daysDiff = Int(floor(Date().timeIntervalSince(start) / (60.0 * 60.0 * 24.0)))
        return daysDiff < trialDurationDays && !state.completed
    }

    /// Current trial day (1, 2, or 3); 0 if not active.
    public static func getTrialDay() -> Int {
        guard isTrialActive() else { return 0 }
        guard let state = getState(), let start = date(fromISO: state.startDate) else { return 0 }

        let daysDiff = Int(floor(Date().timeIntervalSince(start) / (60.0 * 60.0 * 24.0)))
        let currentDay = daysDiff + 1
        return currentDay <= trialDurationDays ? currentDay : 0
    }

    /// Update focus minutes for a specific day (only ever increases).
    public static func updateFocusMinutes(day: TrialDayType, minutes: Int) {
        guard var state = getState() else { return }
        guard let idx = state.days.firstIndex(where: { $0.day == day.rawValue }) else { return }
        state.days[idx].focusMinutes = max(state.days[idx].focusMinutes, minutes)
        Defaults.setCodable(state, storageKey)
    }

    /// Mark a task as complete for a specific day.
    public static func completeTrialTask(day: TrialDayType, task: TrialTaskType) {
        guard var state = getState() else { return }
        guard let idx = state.days.firstIndex(where: { $0.day == day.rawValue }) else { return }

        switch task {
        case .focusSession, .beatFocusTime:
            state.days[idx].focusSessionDone = true
        case .missions:
            state.days[idx].missionsDone = true
        case .disciplineReport:
            if day == .three {
                state.completed = true
            }
        }

        Defaults.setCodable(state, storageKey)
    }

    /// Trial progress summary for the current day.
    public static func getTrialProgress() -> TrialProgress {
        let currentDay = getTrialDay()
        if currentDay == 0 {
            return TrialProgress(day: 0, tasksCompleted: 0, totalTasks: 0)
        }
        guard let state = getState(),
              let dayData = state.days.first(where: { $0.day == currentDay }) else {
            return TrialProgress(day: currentDay, tasksCompleted: 0, totalTasks: 0)
        }

        var tasksCompleted = 0
        var totalTasks = 0
        switch currentDay {
        case 1:
            totalTasks = 1
            if dayData.focusSessionDone { tasksCompleted += 1 }
        case 2:
            totalTasks = 2
            if dayData.focusSessionDone { tasksCompleted += 1 }
            if dayData.missionsDone { tasksCompleted += 1 }
        case 3:
            totalTasks = 1
            if dayData.focusSessionDone { tasksCompleted += 1 }
        default: break
        }
        return TrialProgress(day: currentDay, tasksCompleted: tasksCompleted, totalTasks: totalTasks)
    }

    /// Time remaining until the trial expires.
    public static func getTrialTimeRemaining() -> TrialTimeRemaining {
        guard let state = getState(), let start = date(fromISO: state.startDate) else {
            return TrialTimeRemaining(hours: 0, minutes: 0, expired: true)
        }

        let trialEnd = start.addingTimeInterval(Double(trialDurationDays) * 24.0 * 60.0 * 60.0)
        let now = Date()
        if now >= trialEnd {
            return TrialTimeRemaining(hours: 0, minutes: 0, expired: true)
        }

        let totalMinutesRemaining = Int(floor(trialEnd.timeIntervalSince(now) / 60.0))
        let hours = totalMinutesRemaining / 60
        let minutes = totalMinutesRemaining % 60
        return TrialTimeRemaining(hours: hours, minutes: minutes, expired: false)
    }

    /// Clear all trial progress.
    public static func resetTrial() {
        Defaults.remove(storageKey)
    }

    /// Read-only access to the persisted state (used by the UI layer).
    public static func currentState() -> TrialChallengeState? {
        getState()
    }

    // MARK: - Private

    private static func getState() -> TrialChallengeState? {
        Defaults.codable(TrialChallengeState.self, storageKey)
    }
}
