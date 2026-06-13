import SwiftUI
import DesignKit

/// GuildCard — Glass row used in the BoardTab list. Shows guild name +
/// member count, the current user's rank/score, and a progress bar fill
/// against the top score.
///
/// Port of `apps/mobile/src/features/leaderboard/components/GuildCard.tsx`.
struct GuildCard: View {
    let guildName: String
    let memberCount: Int
    let maxMembers: Int
    let myRank: Int?
    let myScore: Int
    let topScore: Int
    let onTap: () -> Void

    private static let rankGold = Color(hex: "#FFD700")

    var body: some View {
        let fillPct: Double = topScore > 0 ? min(1.0, max(0, Double(myScore) / Double(topScore))) : 0
        let isFirst = myRank == 1

        Button(action: onTap) {
            VStack(spacing: 0) {
                ZStack {
                    // Top-right accent glow.
                    Circle()
                        .fill(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.05))
                        .frame(width: 100, height: 100)
                        .offset(x: 110, y: -50)
                        .blur(radius: 8)

                    VStack(alignment: .leading, spacing: 0) {
                        HStack(alignment: .center, spacing: 12) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(guildName)
                                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 17))
                                    .tracking(-0.2)
                                    .foregroundColor(AppColors.textPrimary)
                                    .lineLimit(1)
                                HStack(spacing: 4) {
                                    Image(systemName: "person.2")
                                        .font(.system(size: 11))
                                        .foregroundColor(AppColors.textMuted)
                                    Text("\(memberCount)/\(maxMembers)")
                                        .font(.custom(FontFamily.body.rawValue, size: 12))
                                        .foregroundColor(AppColors.textMuted)
                                }
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(AppColors.textMuted)
                        }

                        HStack(spacing: 16) {
                            statBlock(
                                value: myRank.map { "#\($0)" } ?? "—",
                                label: "Rank",
                                accent: isFirst ? Self.rankGold : nil
                            )
                            Rectangle()
                                .fill(Color.white.opacity(0.06))
                                .frame(width: 1, height: 28)
                            statBlock(value: "\(myScore)", label: "Score", accent: nil)
                        }
                        .padding(.vertical, 14)

                        // Score-vs-top progress track.
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color(.sRGB, red: 44/255, green: 52/255, blue: 64/255, opacity: 0.5))
                                .frame(height: 6)
                            GeometryReader { proxy in
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(AppColors.primary)
                                    .frame(width: proxy.size.width * fillPct, height: 6)
                                    .shadow(color: AppColors.primary.opacity(0.5), radius: 6, x: 0, y: 0)
                            }
                            .frame(height: 6)
                        }
                    }
                }
                .padding(16)
            }
            .background(
                Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.5)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.04), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(PressOpacityButtonStyle())
        .accessibilityAddTraits(.isButton)
    }

    @ViewBuilder
    private func statBlock(value: String, label: String, accent: Color?) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.custom(FontFamily.headingBold.rawValue, size: 20))
                .tracking(-0.3)
                .foregroundColor(accent ?? AppColors.textPrimary)
            Text(label)
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .foregroundColor(AppColors.textMuted)
        }
        .frame(maxWidth: .infinity)
    }
}
