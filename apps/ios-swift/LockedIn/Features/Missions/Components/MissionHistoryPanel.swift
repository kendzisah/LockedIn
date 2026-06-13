import SwiftUI
import DesignKit

/// MissionHistoryPanel — Lifetime + season mission stats.
///
/// Ported 1:1 from
/// `apps/mobile/src/features/missions/components/MissionHistoryPanel.tsx`.
struct MissionHistoryPanel: View {
    let completedToday: Int
    let totalToday: Int
    let seasonXp: Int
    /// `total_missions_completed` from user_stats. Wired from
    /// `HomeService.shared.getCachedStats()` via `TabNavigator`.
    let lifetimeMissions: Int
    /// `total_perfect_days` from user_stats. Wired from
    /// `HomeService.shared.getCachedStats()` via `TabNavigator`.
    let perfectDays: Int

    var body: some View {
        HUDPanel(headerLabel: "HISTORY") {
            VStack(alignment: .leading, spacing: 14) {
                // Today bar
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("TODAY")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                            .tracking(1.4)
                            .foregroundColor(SystemTokens.textMuted)
                            .frame(width: 48, alignment: .leading)
                        StatBar(
                            progress: totalToday > 0 ? Double(completedToday) / Double(max(1, totalToday)) : 0,
                            color: SystemTokens.cyan,
                            height: 6
                        )
                        Text("\(completedToday)/\(totalToday)")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                            .tracking(0.4)
                            .foregroundColor(SystemTokens.textPrimary)
                            .frame(width: 36, alignment: .trailing)
                    }
                }

                // Stat grid
                HStack(spacing: 8) {
                    statCell(label: "SEASON XP", value: seasonXp.formatted(.number))
                    statCell(label: "PERFECT DAYS", value: "\(perfectDays)")
                    statCell(label: "LIFETIME", value: lifetimeMissions.formatted(.number))
                }
            }
        }
    }

    @ViewBuilder
    private func statCell(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.custom(FontFamily.headingBold.rawValue, size: 9))
                .tracking(1.0)
                .foregroundColor(SystemTokens.textMuted)
            Text(value)
                .font(.custom(FontFamily.headingBold.rawValue, size: 18))
                .tracking(-0.3)
                .foregroundColor(SystemTokens.textPrimary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.02))
        .overlay(
            Rectangle()
                .stroke(SystemTokens.divider, lineWidth: 1)
        )
    }
}
