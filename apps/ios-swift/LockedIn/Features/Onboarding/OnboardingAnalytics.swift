import Foundation

/// OnboardingAnalytics — Feature-local analytics shim.
///
/// Mirrors the events fired by the RN onboarding screens
/// (`Analytics.track`/`timeEvent`) so the coordinator can swap in the
/// canonical PostHog + AppsFlyer service without touching screen code.
///
/// Event names + property keys MUST stay byte-for-byte aligned with the RN
/// catalog. See `apps/mobile/src/services/AnalyticsService.ts` and the
/// onboarding entries in `MIGRATION_FRONTEND_INVENTORY.md` §9.
enum OnboardingAnalytics {
    // Forwards to the canonical `AnalyticsService`. Event names + property
    // keys MUST stay byte-for-byte aligned with the RN catalog.

    static func track(_ event: String, properties: [String: Any] = [:]) {
        Task { @MainActor in
            AnalyticsService.shared.track(event, properties: properties)
        }
    }

    static func timeEvent(_ event: String) {
        Task { @MainActor in
            AnalyticsService.shared.timeEvent(event)
        }
    }

    static func setUserProperties(_ properties: [String: Any]) {
        Task { @MainActor in
            AnalyticsService.shared.setUserProperties(properties)
        }
    }

    static func setUserPropertiesOnce(_ properties: [String: Any]) {
        Task { @MainActor in
            AnalyticsService.shared.setUserPropertiesOnce(properties)
        }
    }

    // MARK: - PostHog event constants

    static let screenViewed = "Onboarding Screen Viewed"
    static let screenExited = "Onboarding Screen Exited"
    static let answerSubmitted = "Onboarding Answer Submitted"
    static let completed = "Onboarding Completed"
    static let paywallShown = "Paywall Shown"
    static let paywallCTATapped = "Paywall CTA Tapped"
    static let paywallDismissed = "Paywall Dismissed"
    static let paywallRestoreTapped = "Paywall Restore Tapped"
    static let paywallSkipped = "Paywall Skipped"
    static let subscriptionStarted = "Subscription Started"
    static let permissionGranted = "Permission Granted"
    static let permissionDenied = "Permission Denied"
    static let notifPermissionGranted = "Notification Permission Granted"
    static let notifPermissionDenied = "Notification Permission Denied"

    // MARK: - Helpers

    /// Fire the user-property bundle set in `COMPLETE_ONBOARDING`. Mirrors the
    /// `Analytics.setUserProperties({...})` call in OnboardingProvider.tsx:251.
    @MainActor
    static func logCompletionUserProperties(state: OnboardingState) {
        let props: [String: Any] = [
            "age": state.userAge as Any,
            "primary_goal": state.primaryGoal as Any,
            "daily_commitment_minutes": state.dailyMinutes as Any,
            "phone_usage": state.phoneUsageHours as Any,
            "weaknesses": state.selectedWeaknesses.joined(separator: ", "),
            "situation": state.situation?.rawValue as Any,
            "triggers": state.triggers.map { $0.rawValue }.joined(separator: ", "),
            "morning_routine": state.morningRoutine?.rawValue as Any,
            "why_now": state.whyNow?.rawValue as Any,
            "scheduled_session_time": state.scheduledSessionTime as Any,
            "screen_time_granted": state.screenTimeStatus == .granted,
            "notifications_granted": state.notificationsGranted ?? false,
            "demo_completed": state.demoCompleted,
            "platform": "ios",
        ]
        setUserProperties(props)
        setUserPropertiesOnce([
            "onboarding_completed_at": ISO8601DateFormatter().string(from: Date()),
        ])
    }
}

// MARK: - Per-screen tracking helper

/// `useOnboardingTracking` Swift equivalent. Drop into a screen's
/// `.onAppear`/`.onDisappear` lifecycle to mirror RN behaviour.
@MainActor
final class OnboardingScreenTracker {
    let route: OnboardingRoute
    private(set) var mountedAt: Date?

    init(_ route: OnboardingRoute) {
        self.route = route
    }

    /// Call from `.onAppear`. Fires `Onboarding Screen Viewed`, starts the
    /// timed-event window, and persists the current screen for resume.
    func didAppear() {
        mountedAt = Date()
        OnboardingAnalytics.track(OnboardingAnalytics.screenViewed, properties: [
            "screen": route.rawValue,
            "step": route.step,
            "total_steps": onboardingTotalSteps,
        ])
        OnboardingAnalytics.timeEvent(OnboardingAnalytics.screenExited)
        OnboardingState.writePersistedScreen(route)
    }

    /// Call from `.onDisappear`. Fires `Onboarding Screen Exited` with the
    /// mount-time duration.
    func didDisappear() {
        let duration = mountedAt.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0
        OnboardingAnalytics.track(OnboardingAnalytics.screenExited, properties: [
            "screen": route.rawValue,
            "step": route.step,
            "total_steps": onboardingTotalSteps,
            "time_on_screen_ms": duration,
        ])
    }
}
