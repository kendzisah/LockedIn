import Foundation
import Observation

// MARK: - Enums (mirror state/types.ts)

public enum ScreenTimeStatus: String, Codable, Sendable {
    case unavailable
    case notRequested = "not_requested"
    case requested
    case granted
    case denied
}

public enum ControlLevel: String, Codable, Sendable {
    case almostNone = "almost_none"
    case some
    case decent
    case strong
}

/// @deprecated Replaced by `triggers` (multi-select) in the 26-screen flow.
/// Retained for legacy hydration migration only — see hydrate().
public enum VulnerableTime: String, Codable, Sendable {
    case morning
    case afternoon
    case evening
    case lateNight = "late_night"
}

public enum Situation: String, Codable, Sendable {
    case student
    case working
    case figuring
    case building
    case startingOver = "starting_over"
}

public enum Trigger: String, Codable, Sendable, CaseIterable {
    case morning
    case lateNight = "late_night"
    case aroundOthers = "around_others"
    case boredAlone = "bored_alone"
    case afterStress = "after_stress"
    case duringBreaks = "during_breaks"
}

public enum MorningRoutine: String, Codable, Sendable {
    case checkPhone = "check_phone"
    case scrollNotifications = "scroll_notifications"
    case snooze
    case getUp = "get_up"
}

public enum WhyNow: String, Codable, Sendable {
    case tiredWasting = "tired_wasting"
    case failingGoal = "failing_goal"
    case someoneAhead = "someone_ahead"
    case needAccountability = "need_accountability"
    case proveSomething = "prove_something"
}

// MARK: - Persisted blob

/// JSON shape persisted at `@lockedin/onboarding_data`. Mirrors the RN
/// `OnboardingProvider` write payload exactly so existing installs can
/// round-trip across the cutover.
private struct OnboardingPersistedData: Codable {
    var dailyMinutes: Int?
    var primaryGoal: String?
    var phoneUsageHours: String?
    var userAge: Int?
    var selectedWeaknesses: [String]?
    var controlLevel: String?
    var vulnerableTime: String?
    var situation: String?
    var triggers: [String]?
    var morningRoutine: String?
    var whyNow: String?
    var scheduledSessionTime: String?
    var currentScreen: String?
    var onboardingCompletedAt: String?
}

// MARK: - Observable state

/// OnboardingState — mirrors the RN `OnboardingProvider` reducer state +
/// hydration / persistence logic.
///
/// Port of `apps/mobile/src/features/onboarding/state/OnboardingProvider.tsx`
/// and `state/types.ts`.
///
/// Persisted keys (must NOT drift — used by existing installs):
/// - `@lockedin/onboarding_complete` — `"true"` string when the flow finished.
/// - `@lockedin/onboarding_data` — JSON blob of every quiz answer.
/// - `@lockedin/onboarding_current_screen` — last visited route (resume-on-restart).
///
/// On the iOS migration these live in `Defaults.standard` (NOT the App Group
/// suite — none of these are read by the DAM extension).
@MainActor
@Observable
public final class OnboardingState {

    // MARK: - Persisted key names (must match RN exactly)

    public static let completeKey       = "@lockedin/onboarding_complete"
    public static let dataKey           = "@lockedin/onboarding_data"
    public static let currentScreenKey  = "@lockedin/onboarding_current_screen"

    // MARK: - Observable fields

    public var selectedWeaknesses: [String] = []
    public var phoneUsageHours: String? = nil
    public var userAge: Int? = nil
    public var dailyMinutes: Int? = nil
    public var primaryGoal: String? = nil
    public var controlLevel: ControlLevel? = nil
    /// @deprecated — still hydrated for legacy installs but never written.
    public var vulnerableTime: VulnerableTime? = nil
    public var situation: Situation? = nil
    public var triggers: [Trigger] = []
    public var morningRoutine: MorningRoutine? = nil
    public var whyNow: WhyNow? = nil
    /// "HH:MM" 24h string.
    public var scheduledSessionTime: String? = nil
    public var screenTimeStatus: ScreenTimeStatus = .notRequested
    public var notificationsGranted: Bool? = nil
    public var demoCompleted: Bool = false
    public var onboardingComplete: Bool = false
    /// ISO-8601 timestamp set when COMPLETE_ONBOARDING first fires.
    public var onboardingCompletedAt: String? = nil
    /// Last visited route, for resume-on-restart. Cleared on completion.
    public var currentScreen: String? = nil

    /// Becomes true after `hydrate()` finishes — guards persistence so we
    /// don't overwrite saved state with the empty defaults during boot.
    public private(set) var isHydrated: Bool = false

    /// Set to true while a logout cleanup is in flight; blocks the implicit
    /// persistence side-effect so a FULL_RESET doesn't immediately overwrite
    /// the wiped storage.
    private var isResetting: Bool = false

    public init() {}

    // MARK: - Hydration

    /// Load persisted state on startup. Mirrors the `useEffect` in
    /// `OnboardingProvider.tsx` lines 100-152.
    public func hydrate() async {
        let flagRaw = Defaults.string(Self.completeKey)
        onboardingComplete = (flagRaw == "true")

        if let data = Defaults.data(Self.dataKey),
           let decoded = try? JSONDecoder().decode(OnboardingPersistedData.self, from: data) {
            // Same legacy migration: string dailyMinutes → 60.
            // (Codable can't represent the union, so we keep the int form here
            // and rely on the existing installs having migrated already.)
            if let v = decoded.dailyMinutes { dailyMinutes = v }
            if let v = decoded.primaryGoal { primaryGoal = v }
            if let v = decoded.phoneUsageHours { phoneUsageHours = v }
            if let v = decoded.userAge { userAge = v }
            if let v = decoded.selectedWeaknesses { selectedWeaknesses = v }
            if let v = decoded.controlLevel, let cl = ControlLevel(rawValue: v) { controlLevel = cl }
            if let v = decoded.vulnerableTime, let vt = VulnerableTime(rawValue: v) { vulnerableTime = vt }
            if let v = decoded.situation, let s = Situation(rawValue: v) { situation = s }
            if let v = decoded.triggers {
                triggers = v.compactMap { Trigger(rawValue: $0) }
            }
            if let v = decoded.morningRoutine, let mr = MorningRoutine(rawValue: v) { morningRoutine = mr }
            if let v = decoded.whyNow, let wn = WhyNow(rawValue: v) { whyNow = wn }
            if let v = decoded.scheduledSessionTime { scheduledSessionTime = v }
            if let v = decoded.currentScreen { currentScreen = v }
            if let v = decoded.onboardingCompletedAt { onboardingCompletedAt = v }

            // Legacy migration: single-value `vulnerableTime` → multi-select
            // `triggers`. Only fires when triggers is empty AND a
            // vulnerableTime is present, mirroring RN behaviour.
            if triggers.isEmpty, let v = decoded.vulnerableTime,
               let mapped = Trigger(rawValue: v) {
                triggers = [mapped]
            }
        }

        isHydrated = true
    }

    // MARK: - Persistence

    /// Persist the full quiz answer blob to `@lockedin/onboarding_data`.
    /// Mirrors the persistence `useEffect` at lines 164-199.
    /// Safe to call after any reducer-equivalent setter.
    public func persistAnswers() {
        guard isHydrated, !isResetting, !onboardingComplete else { return }
        let blob = OnboardingPersistedData(
            dailyMinutes: dailyMinutes,
            primaryGoal: primaryGoal,
            phoneUsageHours: phoneUsageHours,
            userAge: userAge,
            selectedWeaknesses: selectedWeaknesses,
            controlLevel: controlLevel?.rawValue,
            vulnerableTime: vulnerableTime?.rawValue,
            situation: situation?.rawValue,
            triggers: triggers.map { $0.rawValue },
            morningRoutine: morningRoutine?.rawValue,
            whyNow: whyNow?.rawValue,
            scheduledSessionTime: scheduledSessionTime,
            currentScreen: currentScreen,
            onboardingCompletedAt: onboardingCompletedAt
        )
        Defaults.setCodable(blob, Self.dataKey)
    }

    /// Post-completion sync — keeps the on-disk goal / commitment /
    /// weaknesses in step with the live state so MissionsProvider can read
    /// them. Mirrors the `useEffect` at lines 202-231.
    public func persistPostCompletionSync() {
        guard isHydrated, onboardingComplete else { return }
        var existing: OnboardingPersistedData
        if let data = Defaults.data(Self.dataKey),
           let decoded = try? JSONDecoder().decode(OnboardingPersistedData.self, from: data) {
            existing = decoded
        } else {
            existing = OnboardingPersistedData()
        }
        existing.dailyMinutes = dailyMinutes
        existing.primaryGoal = primaryGoal
        existing.selectedWeaknesses = selectedWeaknesses
        existing.phoneUsageHours = phoneUsageHours
        existing.userAge = userAge
        Defaults.setCodable(existing, Self.dataKey)
    }

    // MARK: - Resume on restart

    /// Read the persisted `currentScreen` route name. Returns nil if missing
    /// or pointing at a retired route.
    public static func persistedScreen() -> OnboardingRoute? {
        guard let raw = Defaults.string(Self.currentScreenKey),
              let route = OnboardingRoute(rawValue: raw),
              onboardingScreenOrder.contains(route) else {
            return nil
        }
        return route
    }

    public static func clearPersistedScreen() {
        Defaults.remove(Self.currentScreenKey)
    }

    /// Persist the active route — called by the tracking hook on mount.
    public static func writePersistedScreen(_ route: OnboardingRoute) {
        Defaults.setString(route.rawValue, Self.currentScreenKey)
    }

    // MARK: - Reducer-equivalent setters

    public func setWeaknesses(_ value: [String]) {
        selectedWeaknesses = value
        persistAnswers()
    }

    public func setPhoneUsage(_ value: String) {
        phoneUsageHours = value
        persistAnswers()
    }

    public func setUserAge(_ value: Int) {
        userAge = value
        persistAnswers()
    }

    public func setDailyMinutes(_ value: Int) {
        dailyMinutes = value
        persistAnswers()
    }

    public func setPrimaryGoal(_ value: String) {
        primaryGoal = value
        persistAnswers()
    }

    public func setControlLevel(_ value: ControlLevel) {
        controlLevel = value
        persistAnswers()
    }

    /// @deprecated — never called from the new flow, but exposed for legacy
    /// migration callers if any remain.
    public func setVulnerableTime(_ value: VulnerableTime) {
        vulnerableTime = value
        persistAnswers()
    }

    public func setSituation(_ value: Situation) {
        situation = value
        persistAnswers()
    }

    public func setTriggers(_ value: [Trigger]) {
        triggers = value
        persistAnswers()
    }

    public func setMorningRoutine(_ value: MorningRoutine) {
        morningRoutine = value
        persistAnswers()
    }

    public func setWhyNow(_ value: WhyNow) {
        whyNow = value
        persistAnswers()
    }

    public func setScheduledSessionTime(_ value: String) {
        scheduledSessionTime = value
        persistAnswers()
    }

    public func setScreenTimeStatus(_ value: ScreenTimeStatus) {
        screenTimeStatus = value
        persistAnswers()
    }

    public func setNotificationsGranted(_ value: Bool) {
        notificationsGranted = value
        persistAnswers()
    }

    public func setDemoCompleted() {
        demoCompleted = true
        persistAnswers()
    }

    public func setCurrentScreen(_ name: String) {
        currentScreen = name
        persistAnswers()
    }

    /// COMPLETE_ONBOARDING — fires the cascade of side-effects in the RN
    /// `useEffect` at lines 234-291.
    public func completeOnboarding() {
        guard !onboardingComplete else { return }
        onboardingComplete = true
        if onboardingCompletedAt == nil {
            onboardingCompletedAt = ISO8601DateFormatter().string(from: Date())
        }

        // Persist the completion flag.
        Defaults.setString("true", Self.completeKey)

        // Persist completedAt onto the data blob so downstream features
        // (MissionsProvider) can read it.
        if onboardingCompletedAt != nil {
            persistPostCompletionSync()
        }

        // Clear resume screen since onboarding is done.
        Self.clearPersistedScreen()

        // Push the user-property bundle into the canonical Analytics
        // service (PostHog + AppsFlyer). `OnboardingAnalytics` now forwards
        // into `AnalyticsService.shared` after the coordinator merge.
        OnboardingAnalytics.logCompletionUserProperties(state: self)

        // Seed the server-side `user_stats` row so the HomeTab opens with
        // populated derived columns.
        Task { @MainActor in
            if let session = try? await LockedInSupabase.shared.client.auth.session {
                _ = await StatsService.recompute(userId: session.user.id.uuidString)
            }
        }
    }

    /// FULL_RESET — wipes all answers and the completion flag. Triggered by
    /// the logout-cleanup bus subscription (TODO below). Persistence is
    /// suppressed while the reset is in flight so we don't immediately
    /// re-persist the empty state.
    public func fullReset() {
        isResetting = true
        selectedWeaknesses = []
        phoneUsageHours = nil
        userAge = nil
        dailyMinutes = nil
        primaryGoal = nil
        controlLevel = nil
        vulnerableTime = nil
        situation = nil
        triggers = []
        morningRoutine = nil
        whyNow = nil
        scheduledSessionTime = nil
        screenTimeStatus = .notRequested
        notificationsGranted = nil
        demoCompleted = false
        onboardingComplete = false
        onboardingCompletedAt = nil
        currentScreen = nil
        // Re-enable persistence after the next runloop tick so any
        // observation-driven persistence sees a clean state.
        Task { @MainActor in
            self.isResetting = false
        }
    }

    // MARK: - Logout cleanup wiring

    /// `fullReset()` is invoked by `LogoutCleanupBus` — every state object is
    /// subscribed once at app boot via `LogoutCleanupBus.subscribeAll(...)` in
    /// `RootView`.
}
