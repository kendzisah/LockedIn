import SwiftUI
import DesignKit

/// MissionsTab — HUD mission log. Wraps every section in HUDPanel:
/// daily missions (3-slot), goal-specific daily activity check-in, stat
/// growth aggregation, and mission history.
///
/// Ported 1:1 from
/// `apps/mobile/src/features/missions/screens/MissionsTab.tsx`.
///
/// Maps to `TabParamList.MissionsTab` route name (see
/// `MissionsRoute.tabName`).
struct MissionsTabScreen: View {
    /// The shared @Observable missions model. Phase-2 coordinator owns the
    /// single instance and passes it via `.environment(_:)`.
    @Bindable var state: MissionsState

    /// Current streak — drives the `Day {streak}` header right-side label.
    /// Wired from `HomeState.consecutiveStreak` in `TabNavigator`.
    let streak: Int

    /// User's primary goal — drives the DailyActivityCard template lookup.
    /// Wired from `OnboardingState.primaryGoal` in `TabNavigator`.
    let goal: String

    /// Per-stat user values — drives the StatGrowthPanel weakest-stat card.
    /// Wired from `HomeService.shared.getCachedStats()` in `TabNavigator`.
    let statValues: [Stat: Int]

    /// `total_missions_completed` from user_stats. Wired from
    /// `HomeService.shared.getCachedStats()?.totalMissionsCompleted`.
    let lifetimeMissions: Int

    /// `total_perfect_days` from user_stats. Wired from
    /// `HomeService.shared.getCachedStats()?.totalPerfectDays`.
    let perfectDays: Int

    /// Called when `lockedInToday` flips true so the host can cancel the
    /// mission reminder notification. Wired to
    /// `NotificationService.shared.cancelMissionReminder()` in `TabNavigator`.
    var onAllMissionsCleared: (() -> Void)?

    private var allDone: Bool {
        !state.missions.isEmpty && state.completedCount == state.missions.count
    }

    var body: some View {
        ZStack {
            // Background — slight blue tint at the top per RN tab.
            LinearGradient(
                stops: [
                    Gradient.Stop(color: Color(hex: "#0A1628"), location: 0.0),
                    Gradient.Stop(color: Color(hex: "#0E1116"), location: 0.55),
                    Gradient.Stop(color: Color(hex: "#0E1116"), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // Glow orb — top right
            GlowOrb(preset: .blue, size: 220, blurRadius: 60)
                .offset(x: 140, y: -260)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    // "MISSION LOG" header lives on the DAILY MISSIONS panel itself in RN
                    // (`MissionsTab.tsx`). The empty wrapper panel previously here drew an
                    // extra HUDPanel chrome row that didn't exist in the source.
                    HUDPanel(
                        headerLabel: "DAILY MISSIONS",
                        headerRight: "\(state.completedCount)/\(state.missions.count)"
                    ) {
                        VStack(spacing: 8) {
                            ForEach(state.missions) { m in
                                MissionLogCard(mission: m, onComplete: { id in state.completeMission(missionId: id) })
                            }
                        }
                        bonusRow
                    }

                    DailyActivityCard(goal: goal)

                    StatGrowthPanel(missions: state.missions, statValues: statValues)

                    if !state.weeklyMissions.isEmpty {
                        HUDPanel(
                            headerLabel: "WEEKLY CHALLENGES",
                            headerRight: "\(state.weeklyMissions.filter { $0.completed }.count)/\(state.weeklyMissions.count)"
                        ) {
                            VStack(spacing: 8) {
                                ForEach(state.weeklyMissions) { m in
                                    MissionLogCard(mission: m, onComplete: { id in state.completeMission(missionId: id) })
                                }
                            }
                        }
                    }

                    MissionHistoryPanel(
                        completedToday: state.completedCount,
                        totalToday: state.missions.count,
                        seasonXp: state.totalXP,
                        lifetimeMissions: lifetimeMissions,
                        perfectDays: perfectDays
                    )
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 140)
            }

            // Mission complete toast overlay
            if let toast = state.completedToast {
                MissionCompleteOverlay(payload: toast) {
                    state.dismissCompletedToast()
                }
            }
        }
        .onAppear {
            if !state.isHydrated { state.hydrate() }
        }
        .onChange(of: state.lockedInToday) { _, newValue in
            if newValue {
                onAllMissionsCleared?()
            }
        }
    }

    @ViewBuilder
    private var bonusRow: some View {
        VStack(spacing: 0) {
            DashedDivider()
                .stroke(SystemTokens.divider, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                .frame(height: 1)
                .padding(.top, 8)
            Text(allDone ? "✦ ALL MISSIONS CLEAR  —  +50 XP" : "COMPLETE ALL  —  +50 XP BONUS")
                .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                .tracking(1.4)
                .foregroundColor(SystemTokens.gold)
                .shadow(color: allDone ? SystemTokens.gold : .clear, radius: allDone ? 8 : 0)
                .padding(.top, 8)
        }
        .padding(.top, 4)
        .frame(maxWidth: .infinity, alignment: .center)
    }
}

// MARK: - Dashed divider

private struct DashedDivider: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 0, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.width, y: rect.midY))
        return p
    }
}
