import Foundation

/// OnboardingFeature — feature-level metadata + integration points.
///
/// Lives alongside `OnboardingState`, `OnboardingFlow`, `OnboardingEngine`,
/// `OnboardingData`, and the screen files under `Screens/`. The bulk of the
/// feature is screen views — they are not re-exported here because Swift
/// types in the app target are visible app-wide.
///
/// What the coordinator wires up after merging this worktree:
///
/// 1. Provide an `OnboardingState` instance via `.environment(...)` from
///    `RootView` (above the conditional that chooses Onboarding vs. Main).
/// 2. Call `await state.hydrate()` at app startup. Render only after
///    `state.isHydrated == true`.
/// 3. Branch `RootView` on `state.onboardingComplete`:
///       false → `OnboardingNavigator(state: state)`
///       true  → existing `MainNavigator`.
/// 4. Build a coordinator `NavigationStack` (TODO file:
///    `OnboardingNavigator.swift` — owned by the coordinator phase) that:
///       - Mounts `OnboardingProgressBar(route:)` above the stack.
///       - Hosts the 25 screens in this folder plus the two cross-feature
///         routes (`OnboardingAuth` → `Features/Auth/`,
///         `Paywall` → `Features/Subscription/`).
///       - On `AccountPrompt` skip / OnboardingAuth success → push
///         `Commitment`.
///       - On `Paywall` finish (subscribed or skipped) → call
///         `state.completeOnboarding()`. The root will then flip to
///         MainNavigator.
///       - For resume-on-restart: read `OnboardingState.persistedScreen()`
///         and seed the stack with that route (falls back to `.definition`
///         if missing or pointing at a retired route).
///
/// Cross-feature dependencies (resolved by the coordinator merge):
///
///   - `OnboardingState.completeOnboarding()` now calls
///     `StatsService.recompute(userId:)` and the canonical
///     `OnboardingAnalytics.logCompletionUserProperties` (which forwards
///     into `AnalyticsService.shared`).
///   - `OnboardingState.fullReset()` is wired into the `LogoutCleanupBus`
///     in `RootView.bootIfNeeded()`.
///   - `OnboardingAnalytics.{track,timeEvent,setUserProperties}` forward
///     directly into `AnalyticsService.shared`.
///   - `ScreenTimePreFrameScreen` wires `requestPermission` /
///     `showAppPicker` to `LockModeService.shared` in `OnboardingNavigator`.
///   - `NotificationPreFrameScreen` wires permission + scheduling to
///     `NotificationService.shared` in `OnboardingNavigator`.
///   - `ScheduleSessionScreen.scheduleNotification` calls
///     `NotificationService.shared.scheduleDailyReminder(at:)`.
///   - Every haptic call site now invokes `HapticsService.shared.<level>()`.
public enum OnboardingFeature {
    /// Total displayed steps — equals RN `TOTAL_STEPS`.
    public static let totalSteps: Int = onboardingTotalSteps
}
