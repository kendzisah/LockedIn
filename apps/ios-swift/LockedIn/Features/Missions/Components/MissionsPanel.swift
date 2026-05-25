import SwiftUI
import DesignKit

/// MissionsPanel — Standalone 3-mission panel with completion counter +
/// "LOCKED IN" badge. Alternative layout to MissionsTab's full HUD log; kept
/// for parity with the RN component which is exported via the feature barrel.
///
/// Ported 1:1 from
/// `apps/mobile/src/features/missions/components/MissionsPanel.tsx`.
struct MissionsPanel: View {
    let missions: [Mission]
    let weeklyMissions: [Mission]
    let completedCount: Int
    let totalXP: Int
    let missionSeasonLabel: String
    let lockedInToday: Bool
    let onComplete: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                HStack(spacing: 8) {
                    Text("Missions")
                        .font(.custom(FontFamily.heading.rawValue, size: 18))
                        .foregroundColor(AppColors.textPrimary)
                    if lockedInToday {
                        Text("🔥")
                            .font(.system(size: 20))
                    }
                }
                Spacer()
                Text("\(completedCount)/\(missions.count) Complete")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 12))
                    .foregroundColor(AppColors.accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(AppColors.surface)
                    .cornerRadius(6)
            }
            .padding(.bottom, 16)

            // Daily missions
            VStack(spacing: 8) {
                ForEach(missions) { m in
                    MissionCard(mission: m, onComplete: onComplete)
                }
            }
            .padding(.bottom, 16)

            // Weekly missions
            if !weeklyMissions.isEmpty {
                Text("Weekly Challenges")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                    .tracking(-0.2)
                    .foregroundColor(AppColors.accent)
                    .padding(.bottom, 10)
                VStack(spacing: 8) {
                    ForEach(weeklyMissions) { m in
                        MissionCard(mission: m, onComplete: onComplete)
                    }
                }
                .padding(.bottom, 16)
            }

            // Footer: XP + LOCKED IN badge
            HStack(alignment: .center) {
                VStack(spacing: 2) {
                    Text("\(totalXP)")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 18))
                        .foregroundColor(AppColors.accent)
                    Text("XP Earned")
                        .font(.custom(FontFamily.body.rawValue, size: 11))
                        .foregroundColor(AppColors.textSecondary)
                    Text(missionSeasonLabel)
                        .font(.custom(FontFamily.body.rawValue, size: 10))
                        .foregroundColor(AppColors.textMuted)
                        .padding(.top, 2)
                }
                Spacer()
                if lockedInToday {
                    Text("LOCKED IN")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                        .tracking(0.5)
                        .foregroundColor(AppColors.background)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(AppColors.accent)
                        .cornerRadius(6)
                        .shadow(color: AppColors.accent.opacity(0.4), radius: 8)
                }
            }
            .padding(.top, 12)
            .overlay(
                Rectangle()
                    .fill(AppColors.surface)
                    .frame(height: 1)
                    .frame(maxHeight: .infinity, alignment: .top)
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
        .background(AppColors.background)
    }
}
