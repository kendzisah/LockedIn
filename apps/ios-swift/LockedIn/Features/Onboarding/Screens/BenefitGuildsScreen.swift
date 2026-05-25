import SwiftUI
import DesignKit

/// BenefitGuildsScreen — Step 18: guild leaderboard preview.
///
/// Port of `screens/BenefitGuildsScreen.tsx`.
struct BenefitGuildsScreen: View {
    let onContinue: () -> Void
    @State private var tracker = OnboardingScreenTracker(.benefitGuilds)

    private struct Row: Identifiable {
        let rank: Int
        let name: String
        let ovr: Int
        let tier: String
        let tierColor: Color
        let points: Int
        let isYou: Bool
        var id: Int { rank }
    }

    // Rank tier colors come from the canonical `RankTiers` source-of-truth so
    // sample data stays in lockstep with the live rank progression.
    private static func tierColor(_ id: RankId) -> Color {
        RankTiers.byId[id]?.color ?? SystemTokens.textMuted
    }

    private let rows: [Row] = [
        .init(rank: 1, name: "Marcus", ovr: 45, tier: "Elite",   tierColor: BenefitGuildsScreen.tierColor(.elite),   points: 1240, isYou: false),
        .init(rank: 2, name: "Jayden", ovr: 31, tier: "Rising",  tierColor: BenefitGuildsScreen.tierColor(.rising),  points: 890,  isYou: false),
        .init(rank: 3, name: "Lance",  ovr: 23, tier: "Recruit", tierColor: BenefitGuildsScreen.tierColor(.grinder), points: 640,  isYou: false),
        .init(rank: 4, name: "You",    ovr: 1,  tier: "NPC",     tierColor: BenefitGuildsScreen.tierColor(.npc),     points: 0,    isYou: true),
    ]

    var body: some View {
        BenefitTemplate(
            panelLabel: "GUILDS",
            headline: "GUILDS",
            headlineColor: SystemTokens.purple,
            body: "Create a guild. Invite your guild. Compete on a weekly leaderboard. Every session, mission, and streak day earns points. See who's actually locked in and who's just talking.",
            graphic: { board },
            onContinue: onContinue
        )
        .onAppear { tracker.didAppear() }
        .onDisappear { tracker.didDisappear() }
    }

    private var board: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("WEEKLY LEADERBOARD")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                .tracking(1.4)
                .foregroundColor(AppColors.textSecondary)
                .padding(.bottom, 10)

            ForEach(rows) { r in
                HStack(spacing: 6) {
                    Text("\(r.rank).")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                        .foregroundColor(AppColors.textMuted)
                        .frame(width: 18, alignment: .leading)

                    ZStack {
                        Circle()
                            .fill(r.tierColor.opacity(0.15))
                            .overlay(Circle().stroke(r.tierColor.opacity(0.4), lineWidth: 1))
                        Text(String(r.name.prefix(1)))
                            .font(.custom(FontFamily.heading.rawValue, size: 11))
                            .foregroundColor(r.tierColor)
                    }
                    .frame(width: 22, height: 22)
                    .shadow(color: r.tierColor.opacity(0.4), radius: 4)

                    Text(r.name)
                        .font(.custom(r.isYou ? FontFamily.headingSemiBold.rawValue : FontFamily.bodyMedium.rawValue, size: 12))
                        .foregroundColor(r.isYou ? AppColors.accent : AppColors.textPrimary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Text("OVR \(r.ovr)")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 10))
                        .foregroundColor(AppColors.textPrimary)
                        .frame(width: 44, alignment: .leading)

                    Text(r.tier)
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 9))
                        .tracking(0.5)
                        .foregroundColor(r.tierColor)
                        .frame(width: 50, alignment: .leading)

                    Text("\(r.points)")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                        .foregroundColor(AppColors.warning)
                        .frame(width: 38, alignment: .trailing)
                }
                .padding(.vertical, 6)
                .padding(.horizontal, r.isYou ? 4 : 0)
                .background(
                    Group {
                        if r.isYou {
                            AppColors.accent.opacity(0.05)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        } else {
                            Color.clear
                        }
                    }
                )
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(Color.white.opacity(0.04))
                        .frame(height: 1)
                }
            }
        }
        .padding(14)
        .background(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.5))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.white.opacity(0.04), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
