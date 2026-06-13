import Foundation

/// Feature-local analytics shim for the Auth flow.
///
/// Mirrors the events fired by the RN screens. When the coordinator promotes
/// a shared `AnalyticsService` (PostHog + AppsFlyer wrapper), replace these
/// calls with the canonical service.
///
/// Event names and properties must match RN exactly — see
/// `apps/mobile/src/features/auth/screens/*.tsx` and the analytics catalog
/// in `MIGRATION_FRONTEND_INVENTORY.md` §9.
enum AuthAnalytics {
    // Forwards to the canonical `AnalyticsService` (PostHog + AppsFlyer).
    // Event names + property keys must remain byte-for-byte aligned with RN.

    static func log(_ event: String, properties: [String: Any] = [:]) {
        Task { @MainActor in
            AnalyticsService.shared.track(event, properties: properties)
        }
    }

    static func logAF(_ event: String, properties: [String: Any] = [:]) {
        Task { @MainActor in
            AnalyticsService.shared.trackAppsFlyer(event, values: properties)
        }
    }

    // MARK: - Event constants (PostHog)

    static let signInCompleted = "Sign In Completed"
    static let signInFailed = "Sign In Failed"
    static let signUpFailed = "Sign Up Failed"
    static let accountCreated = "Account Created"
    static let passwordResetRequested = "Password Reset Requested"
    static let signupNudgeShown = "Signup Nudge Shown"
    static let signupNudgeDismissed = "Signup Nudge Dismissed"
    static let signupNudgeConverted = "Signup Nudge Converted"
    static let profilePhotoSet = "Profile Photo Set"
    static let displayNameSet = "Display Name Set"
    static let profileSetupSkipped = "Profile Setup Skipped"

    // MARK: - Event constants (AppsFlyer)

    static let afCompleteRegistration = "af_complete_registration"
}
