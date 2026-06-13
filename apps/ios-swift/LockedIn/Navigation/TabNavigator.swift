//
//  TabNavigator.swift
//  LockedIn
//
//  Bottom-tab shell mirroring `TabParamList` from
//  `apps/mobile/src/types/navigation.ts`.
//
//  Tab order:
//   1. HomeTab     (SF Symbol: house.fill)
//   2. MissionsTab (SF Symbol: target)
//   3. LockInTab   (raised center "Lock In" button — custom render)
//   4. BoardTab    (Guild leaderboard — SF Symbol: rosette)
//   5. ProfileTab  (SF Symbol: person.fill)
//
//  Tab bar styling: dark glass-frosted, matches the RN tab bar background.
//

import SwiftUI
import DesignKit

@MainActor
public struct TabNavigator: View {
    @Environment(HomeState.self) private var home
    @Environment(MissionsState.self) private var missions
    @Environment(OnboardingState.self) private var onboarding
    @Environment(AuthState.self) private var auth
    @Environment(GuildState.self) private var guild
    @Environment(SubscriptionState.self) private var subscription

    @EnvironmentObject private var lockIn: LockInCoordinator
    @EnvironmentObject private var mainStack: MainNavigatorPath

    @State private var selectedTab: Tab = .home

    public init() {}

    public enum Tab: Hashable {
        case home, missions, lockIn, board, profile
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            // Each tab body
            Group {
                switch selectedTab {
                case .home:
                    homeTab
                case .missions:
                    missionsTab
                case .lockIn:
                    // LockIn tab is presented modally; while waiting, show home.
                    homeTab
                case .board:
                    boardTab
                case .profile:
                    ProfileTabScreen()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.bottom, 56)
            .ignoresSafeArea(.container, edges: .bottom)

            customTabBar
        }
        .fullScreenCover(isPresented: Binding(
            get: { guild.showMonthEndPrompt },
            set: { if !$0 { guild.dismissMonthEndPrompt() } }
        )) {
            GuildMonthEndDialog(
                onViewBoard: {
                    guild.dismissMonthEndPrompt()
                    selectedTab = .board
                },
                onDismiss: { guild.dismissMonthEndPrompt() }
            )
            .presentationBackground(.clear)
        }
    }

    // MARK: - Tabs

    private var homeTab: some View {
        HomeTabScreen(
            home: home,
            dailyCommitmentMinutes: onboarding.dailyMinutes ?? 60,
            isAnonymous: auth.isAnonymous,
            currentUserId: auth.user?.id.uuidString,
            missions: missionsForHome,
            missionsCompletedCount: missions.completedCount,
            onActivateSession: { triggerLockInFlow() },
            onTapStatus: { selectedTab = .profile },
            onTapMissions: { selectedTab = .missions },
            onManageScheduled: { mainStack.path.append(.scheduledSessions) },
            onOpenTimer: { lockIn.activeModal = .executionBlock }
        )
    }

    private var missionsTab: some View {
        MissionsTabScreen(
            state: missions,
            streak: home.consecutiveStreak,
            goal: onboarding.primaryGoal ?? "Increase discipline & self-control",
            statValues: defaultStatValues(),
            lifetimeMissions: HomeService.shared.getCachedStats()?.totalMissionsCompleted ?? 0,
            perfectDays: HomeService.shared.getCachedStats()?.totalPerfectDays ?? 0,
            onAllMissionsCleared: {
                NotificationService.shared.cancelMissionReminder()
            }
        )
    }

    private var boardTab: some View {
        BoardTabScreen(
            state: guild,
            onCreateGuild: { mainStack.path.append(.createGuild) },
            onJoinGuild: { mainStack.path.append(.joinGuild) },
            onTapGuild: { id in mainStack.path.append(.guildDetail(guildId: id)) }
        )
    }

    // MARK: - Custom tab bar

    private var customTabBar: some View {
        HStack(spacing: 0) {
            tabButton(.home, system: "house.fill", label: "Home")
            tabButton(.missions, system: "target", label: "Missions")
            lockInCenterButton
            tabButton(.board, system: "rosette", label: "Guild")
            tabButton(.profile, system: "person.fill", label: "Profile")
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 24)
        .background(
            ZStack {
                AppColors.backgroundSecondary.opacity(0.92)
                LinearGradient(
                    colors: [Color.clear, AppColors.background.opacity(0.4)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
            .ignoresSafeArea(edges: .bottom)
        )
        .overlay(
            Rectangle()
                .fill(Color.white.opacity(0.04))
                .frame(height: 1),
            alignment: .top
        )
    }

    private func tabButton(_ tab: Tab, system: String, label: String) -> some View {
        Button(action: { selectedTab = tab; HapticsService.shared.selectionChanged() }) {
            VStack(spacing: 4) {
                Image(systemName: system)
                    .font(.system(size: 20, weight: .semibold))
                Text(label)
                    .font(.custom(FontFamily.body.rawValue, size: 10))
                    .tracking(0.4)
            }
            .foregroundColor(selectedTab == tab ? AppColors.primary : AppColors.textMuted)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }

    private var lockInCenterButton: some View {
        Button(action: { triggerLockInFlow() }) {
            VStack(spacing: 4) {
                ZStack {
                    Circle()
                        .fill(AppColors.primary)
                        .frame(width: 56, height: 56)
                        .shadow(color: AppColors.primary.opacity(0.45), radius: 14)
                    Image(systemName: "lock.fill")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.white)
                }
                Text("Lock In")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 10))
                    .tracking(0.6)
                    .foregroundColor(AppColors.textPrimary)
            }
            .offset(y: -16)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private func triggerLockInFlow() {
        HapticsService.shared.medium()
        lockIn.openLockInFlow(isSubscribed: subscription.isSubscribed)
    }

    /// Map `missions` (W4) into the `CompactMissionRow` shape consumed by
    /// the Home tab's `CompactMissions` panel.
    private var missionsForHome: [CompactMissionRow] {
        missions.missions.map { m in
            CompactMissionRow(
                id: m.id,
                title: m.title,
                description: m.description,
                stats: m.stats ?? MissionTypeStats.map[m.type] ?? [.execution],
                xp: m.xp,
                completed: m.completed
            )
        }
    }

    /// Per-stat values for the missions tab UI (drives StatGrowthPanel's
    /// "weakest stat" callout). After the per-stat XP migration the legacy
    /// 1-99 numeric columns are no longer the source of truth — every
    /// user's `.discipline` / `.focus` / etc. column stays pinned at 1
    /// because nothing client-side writes to them anymore. Returning those
    /// values made the panel always report DISCIPLINE as the weakest stat
    /// (the iteration tiebreaker).
    ///
    /// Reads from the per-stat XP buckets via `UserStatsRow.counter(for:)`,
    /// which is the same source the Profile tab tier UI uses — so the
    /// weakest stat the user sees on the missions tab matches the lowest
    /// letter tier on their profile.
    private func defaultStatValues() -> [Stat: Int] {
        guard let cached = HomeService.shared.getCachedStats() else {
            return [
                .discipline:  0, .focus: 0, .execution: 0, .consistency: 0, .social: 0
            ]
        }
        return [
            .discipline:  cached.counter(for: .discipline),
            .focus:       cached.counter(for: .focus),
            .execution:   cached.counter(for: .execution),
            .consistency: cached.counter(for: .consistency),
            .social:      cached.counter(for: .social),
        ]
    }
}
