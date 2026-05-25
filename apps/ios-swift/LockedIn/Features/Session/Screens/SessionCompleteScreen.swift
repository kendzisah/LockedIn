//
//  SessionCompleteScreen.swift
//  LockedIn — Worker W11 (Session / Lock-In feature)
//
//  Port of `apps/mobile/src/features/home/SessionCompleteScreen.tsx`. Phase-
//  specific completion message + (for execution_block) flame Lottie streak
//  celebration. Auto-navigates home after 4s (non-streak) or 7s (streak).
//
//  Server side-effects fired once on appear (mirror RN useEffect at line 77):
//   1. `recordActiveDay()` — Worker W4 (Missions) owns this.
//   2. `complete-mission` edge function — Worker W5 (Leaderboard) owns the
//      service. Body shape: `{ focusMinutes, missionsDone, streakDays }`.
//      Reads/updates the weekly stats cache around it.
//   3. `bump_user_stat` (total_focus_minutes / total_completed_sessions /
//      total_sessions) — Worker W3 (Home) owns StatsService.
//   4. `set_user_streak` — same.
//   5. `recompute_user_stats` — same.
//
//  This screen is presentation-only — server-side fan-out (stat bumps,
//  streak RPC, complete-mission edge function, achievement evaluation) is
//  owned by `MainNavigator.handleSessionFinish` which runs once when
//  `ExecutionBlockScreen.onFinish` fires.
//

import SwiftUI
import DesignKit

public struct SessionCompleteScreenParams: Equatable {
    /// RN union — currently only one phase is implemented, but mirrored
    /// so the param type matches the navigation contract.
    public enum Phase: String, Sendable, Equatable {
        case executionBlock = "execution_block"
    }

    public let phase: Phase
    public let durationMinutes: Int
    public let streak: Int

    public init(phase: Phase, durationMinutes: Int, streak: Int) {
        self.phase = phase
        self.durationMinutes = durationMinutes
        self.streak = streak
    }
}

public struct SessionCompleteScreen: View {
    public let params: SessionCompleteScreenParams
    public let onDismiss: () -> Void

    @State private var message: String = CompletionCopy.completionMessage(for: .executionBlock)
    @State private var messageOpacity: Double = 0
    @State private var streakOpacity: Double = 0
    @State private var showStreak: Bool = false
    @State private var didFireSideEffects: Bool = false

    public init(
        params: SessionCompleteScreenParams,
        onDismiss: @escaping () -> Void
    ) {
        self.params = params
        self.onDismiss = onDismiss
    }

    private var showStreakCelebration: Bool {
        params.phase == .executionBlock && params.streak > 0
    }

    private var checkpoint: CompletionCopy.StreakCheckpoint {
        CompletionCopy.streakCheckpoint(streak: params.streak)
    }

    private var rankColor: Color {
        rankTier(forStreak: params.streak).color
    }

    public var body: some View {
        ZStack {
            AppColors.lockInBackground
                .ignoresSafeArea()

            if !showStreak {
                VStack(spacing: 16) {
                    Text(message)
                        .font(.custom(FontFamily.headingBold.rawValue, size: 28))
                        .tracking(-0.5)
                        .lineSpacing(8)
                        .foregroundColor(AppColors.textPrimary)
                        .multilineTextAlignment(.center)
                    if params.phase == .executionBlock {
                        Text("\(params.durationMinutes) minute\(params.durationMinutes != 1 ? "s" : "") executed.")
                            .font(.custom(FontFamily.bodyMedium.rawValue, size: 16))
                            .tracking(0.2)
                            .foregroundColor(AppColors.textSecondary)
                    }
                }
                .opacity(messageOpacity)
                .padding(.horizontal, 32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if showStreakCelebration {
                streakCelebrationView
                    .opacity(streakOpacity)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { onDismiss() }
        .onAppear { handleAppear() }
    }

    // MARK: - Streak celebration

    private var streakCelebrationView: some View {
        VStack(spacing: 0) {
            // FlameLottieView wraps `flame.json` and applies the rank-tier
            // color filters via `getFlameColorFilters(...)`. The
            // `(color: colorLight:)` initializer is used here because the
            // rank color comes from `RankService`, not the streak-tier helper.
            ZStack {
                Circle()
                    .fill(rankColor.opacity(0.18))
                    .frame(width: 120, height: 120)
                    .blur(radius: 20)
                FlameLottieView(color: rankColor, colorLight: rankColor.opacity(0.55))
                    .frame(width: 96, height: 96)
            }
            .padding(.bottom, 8)

            Text("\(params.streak)")
                .font(.custom(FontFamily.headingBold.rawValue, size: 64))
                .tracking(-2)
                .foregroundColor(rankColor)
                .padding(.bottom, 4)

            Text(checkpoint.detail)
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .tracking(0.2)
                .foregroundColor(AppColors.textSecondary)
                .padding(.bottom, 20)

            Text(checkpoint.headline)
                .font(.custom(FontFamily.headingBold.rawValue, size: 22))
                .tracking(-0.3)
                .foregroundColor(AppColors.textPrimary)
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text(checkpoint.sub)
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 16))
                .tracking(0.1)
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)

            if checkpoint.showWarning {
                Text("Miss one day, and the pattern resets.")
                    .font(.custom(FontFamily.body.rawValue, size: 13))
                    .italic()
                    .tracking(0.2)
                    .foregroundColor(AppColors.textMuted)
                    .opacity(0.6)
                    .multilineTextAlignment(.center)
                    .padding(.top, 24)
            }
        }
        .padding(.horizontal, 32)
    }

    // MARK: - Lifecycle / side effects

    private func handleAppear() {
        // Fade message in.
        withAnimation(.easeInOut(duration: 0.8)) { messageOpacity = 1.0 }

        // Side effects (idempotent — guarded so re-renders don't refire).
        if !didFireSideEffects {
            didFireSideEffects = true
            fireServerSideEffects()
            HapticsService.shared.success()
        }

        if showStreakCelebration {
            // 2.5s → fade message out, swap in streak view.
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                withAnimation(.easeInOut(duration: 0.5)) { messageOpacity = 0 }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    showStreak = true
                    withAnimation(.easeInOut(duration: 0.8)) { streakOpacity = 1.0 }
                }
            }
            // 7s total auto-dismiss.
            DispatchQueue.main.asyncAfter(deadline: .now() + 7.0) {
                onDismiss()
            }
        } else {
            // Non-streak auto-dismiss after 4s.
            DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) {
                onDismiss()
            }
        }
    }

    // MARK: - Server-side fan-out

    private func fireServerSideEffects() {
        // Server-side fan-out is owned by `MainNavigator.handleSessionFinish`,
        // which runs once when `ExecutionBlockScreen.onFinish` fires. That
        // path covers:
        //   - HomeState.completeExecutionBlock(...) / dailyGoalMet()
        //   - StatsService.bumpCounter(.totalFocusMinutes/.totalSessions/...)
        //   - StatsService.setStreak(...)
        //   - MissionsState.checkAutoComplete(...) + recordActiveDay()
        //   - XPService.award(...) + AchievementService.evaluate(...)
        //   - NotificationService.scheduleStreakMilestoneIfNeeded(...)
        //   - GuildService.completeMissionServerSide(...) with weekly totals.
        //
        // This screen intentionally does NOT re-invoke any of those — it is
        // the presentation layer only, kept thin so re-renders never refire
        // side-effects. Analytics for the screen view itself fires below.
        AnalyticsService.shared.track("Session Complete Viewed", properties: [
            "phase": params.phase.rawValue,
            "duration_minutes": params.durationMinutes,
            "streak": params.streak,
        ])
    }
}

// MARK: - Rank tier helper

/// Mirrors `RankService.rankFromStreak` for the streak celebration color.
private func rankTier(forStreak streak: Int) -> RankTier {
    var current = RankTiers.all[0]
    for tier in RankTiers.all where streak >= tier.minDays {
        current = tier
    }
    return current
}
