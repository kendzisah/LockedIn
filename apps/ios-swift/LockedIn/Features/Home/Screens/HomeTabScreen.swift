import SwiftUI
import DesignKit

/// HomeTabScreen — Main `HomeTab` body. Gradient background, optional
/// `StreakAtRiskBanner`, `SystemStatusBar`, `FocusRing`, `CompactMissions`,
/// and (when applicable) the streak-break overlay payload.
///
/// Ported from `apps/mobile/src/features/home/screens/HomeTab.tsx`.
///
/// **Route name:** `HomeRoute.tabName` (`"HomeTab"`), matching
/// `TabParamList.HomeTab` from `apps/mobile/src/types/navigation.ts:39`.
///
/// **Cross-feature dependencies** (the coordinator wires these in):
///   - `dailyCommitmentMinutes` ← `OnboardingState.dailyMinutes` (W2).
///   - `isAnonymous` + `currentUserId` ← `AuthState` (W1).
///   - `missions` + `missionsCompletedCount` ← `MissionsState` (W4).
///   - `onActivateSession` ← `LockInCoordinator.openDurationPicker()` —
///     W11 owns the duration picker modal + ExecutionBlock route.
///   - `onTapStatus` / `onTapMissions` / `onTapSignUp` / `onTapWeeklyReport`
///     ← navigation coordinator. (TODO markers below.)
///
/// **Side-effects not yet wired** (kept as TODOs for the coordinator):
///   - `NotificationService.cancelMissionReminder` when `lockedInToday`.
///   - `NotificationService.scheduleAllDailyNotifications(streak)` after hydrate.
///   - `NotificationService.scheduleCloseToGoalNudge` when within 80%.
///   - `WeeklyReportService.shouldShowReport` → route to WeeklyReport.
///   - `StreakRecoveryService.getRecoveryStatus` for the recovery modal.
///   - `SignUpNudgeSheet` once streak ≥ 3 and user is anonymous.
///   - `AppGuideSheet` on first visit + `SKStoreReviewController.requestReview`.
///   - `Defaults.string(HomeStorageKeys.activeExecutionBlock)` orphan-resume
///     routing (lives in W11; this screen only reads the key).
struct HomeTabScreen: View {
    @Bindable var home: HomeState

    // ── Injected from the coordinator ──
    let dailyCommitmentMinutes: Int
    let isAnonymous: Bool
    let currentUserId: String?
    let missions: [CompactMissionRow]
    let missionsCompletedCount: Int

    let onActivateSession: () -> Void
    let onTapStatus: () -> Void
    let onTapMissions: () -> Void
    let onTapStreakRecovery: () -> Void

    // ── Local UI state ──
    @State private var tick: Int = 0
    @State private var canRecover: Bool = false

    init(
        home: HomeState,
        dailyCommitmentMinutes: Int = 60,
        isAnonymous: Bool = true,
        currentUserId: String? = nil,
        missions: [CompactMissionRow] = [],
        missionsCompletedCount: Int = 0,
        onActivateSession: @escaping () -> Void = {},
        onTapStatus: @escaping () -> Void = {},
        onTapMissions: @escaping () -> Void = {},
        onTapStreakRecovery: @escaping () -> Void = {}
    ) {
        self.home = home
        self.dailyCommitmentMinutes = dailyCommitmentMinutes
        self.isAnonymous = isAnonymous
        self.currentUserId = currentUserId
        self.missions = missions
        self.missionsCompletedCount = missionsCompletedCount
        self.onActivateSession = onActivateSession
        self.onTapStatus = onTapStatus
        self.onTapMissions = onTapMissions
        self.onTapStreakRecovery = onTapStreakRecovery
    }

    var body: some View {
        let todayKey = SessionDayEngine.todayKey()
        let dailyFocused = home.dailyFocused(todayKey: todayKey)
        let dailyGoalMet = dailyFocused >= dailyCommitmentMinutes
        let streakAtRisk = home.streakAtRisk(todayKey: todayKey, dailyGoal: dailyCommitmentMinutes)

        ZStack(alignment: .top) {
            // Background gradient — matches `HomeTab.tsx:251-255`.
            LinearGradient(
                stops: [
                    Gradient.Stop(color: Color(hex: "#0A1628"), location: 0.0),
                    Gradient.Stop(color: Color(hex: "#0E1116"), location: 0.55),
                    Gradient.Stop(color: Color(hex: "#0E1116"), location: 1.0),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // Subtle accent glow at top-right.
            GlowOrb(preset: .blue, size: 220, blurRadius: 60)
                .offset(x: 140, y: -80)

            if !home.isHydrated {
                Color.clear
            } else {
                content(
                    streakAtRisk: streakAtRisk,
                    dailyFocused: dailyFocused,
                    dailyGoalMet: dailyGoalMet
                )
            }
        }
        .onAppear {
            if !home.isHydrated { home.hydrate() }
            // Trigger DAILY_GOAL_MET when we cross the threshold on first paint.
            if dailyGoalMet && home.dailyGoalMetDate != todayKey {
                home.dailyGoalMet()
            }
            // Pull live recovery availability.
            canRecover = StreakRecoveryService.getRecoveryStatus().available
            // TODO(post-launch): WeeklyReportService.shouldShowReport()
            // → push `.weeklyReport` onto the main stack. Needs a
            //   `@EnvironmentObject MainNavigatorPath` accessor from this
            //   screen; deferred so the home screen stays decoupled.
            // TODO(post-launch): SKStoreReviewController.requestReview(in:)
            //   once `HomeStorageKeys.afTutorialHomeGuideSent` is flipped.
        }
        .onChange(of: home.consecutiveStreak) { _, newValue in
            NotificationService.shared.scheduleAllDailyNotifications(
                streak: newValue,
                hasGuild: Defaults.bool("@lockedin/has_active_guild"),
                goalMinutes: dailyCommitmentMinutes,
                reminderTime: HourMinute.parse(
                    Defaults.string("@lockedin/reminder_time")
                ) ?? HourMinute(hour: 9, minute: 0)
            )
            // Close-to-goal nudge when 80% ≤ progress < 100%.
            let focused = home.dailyFocused(todayKey: SessionDayEngine.todayKey())
            NotificationService.shared.scheduleCloseToGoalNudge(
                focusMinutes: focused,
                goalMinutes: dailyCommitmentMinutes
            )
            // TODO(post-launch): present SignUpNudgeSheet when
            //   `isAnonymous && newValue >= 3 && !signupNudgeStreak3Shown`.
            //   The sheet UI itself hasn't been ported.
        }
    }

    @ViewBuilder
    private func content(streakAtRisk: Bool, dailyFocused: Int, dailyGoalMet: Bool) -> some View {
        ScrollView {
            VStack(spacing: 12) {
                if streakAtRisk && canRecover {
                    StreakAtRiskBanner(onPress: onTapStreakRecovery)
                }

                SystemStatusBar(
                    home: home,
                    streakAtRisk: streakAtRisk && !canRecover,
                    isAnonymous: isAnonymous,
                    userId: currentUserId,
                    onTapStatus: onTapStatus
                )

                FocusRing(
                    focused: dailyFocused,
                    goal: dailyCommitmentMinutes,
                    streakAtRisk: streakAtRisk && !canRecover,
                    onActivate: onActivateSession
                )

                CompactMissions(
                    missions: missions,
                    completedCount: missionsCompletedCount,
                    onPress: onTapMissions
                )
            }
            .padding(.top, 12)
            .padding(.bottom, 140)
            .padding(.horizontal, 16)
        }
        .scrollIndicators(.hidden)
        // Streak-break overlay: the payload is published via
        // `HomeState.streakBreak`. TODO(post-launch): when W7/W11 ship the
        // `StreakBreakOverlay` view, render it here gated on
        // `home.streakBreak != nil` and call `home.dismissStreakBreak()` on
        // close.
    }
}

