import SwiftUI
import DesignKit

/// MemberRow — single row in the GuildDetail leaderboard. Renders rank,
/// avatar (image or initial), display name, OVR pill, focus/missions/streak
/// inline stats, score, and an optional kick button for owners.
///
/// Port of `apps/mobile/src/features/leaderboard/components/MemberRow.tsx`.
struct MemberRow: View {
    let rank: Int
    let username: String
    let avatarUrl: String?
    let focusMinutes: Int
    let missionsDone: Int
    let streakDays: Int
    let totalScore: Int
    let isCurrentUser: Bool
    let isLast: Bool
    /// `user_stats.ovr` (1-99). Nil → no row yet for the member.
    let ovr: Int?
    /// `user_stats.rank_id`. Nil → no row yet.
    let rankId: RankId?
    /// Owner-side kick handler. `nil` hides the trailing red close button.
    let onRemove: (() -> Void)?

    private static let rankGold   = Color(hex: "#FFD700")
    private static let rankSilver = Color(hex: "#C0C0C0")
    private static let rankBronze = Color(hex: "#CD7F32")

    private var rankColor: Color {
        switch rank {
        case 1: return Self.rankGold
        case 2: return Self.rankSilver
        case 3: return Self.rankBronze
        default: return AppColors.textMuted
        }
    }

    /// Matches RN icon names (`trophy`, `medal`, `medal-outline`) using SF
    /// Symbols equivalents.
    private var rankIconName: String? {
        switch rank {
        case 1: return "trophy.fill"
        case 2: return "medal.fill"
        case 3: return "medal"
        default: return nil
        }
    }

    private var tier: RankTier? {
        guard let rankId else { return nil }
        return RankTiers.byId[rankId]
    }

    private var initial: String {
        let firstChar = username.trimmingCharacters(in: .whitespaces).first.map(String.init) ?? "?"
        return firstChar.uppercased()
    }

    var body: some View {
        HStack(alignment: .center, spacing: 0) {
            // Rank
            ZStack {
                if let icon = rankIconName {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(rankColor)
                } else {
                    Text("\(rank)")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 15))
                        .foregroundColor(rankColor)
                }
            }
            .frame(width: 28)

            // Avatar
            avatarView
                .padding(.leading, 8)

            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    HStack(spacing: 0) {
                        Text(username)
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                            .tracking(-0.1)
                            .foregroundColor(AppColors.textPrimary)
                            .lineLimit(1)
                        if isCurrentUser {
                            Text(" (you)")
                                .font(.custom(FontFamily.body.rawValue, size: 12))
                                .foregroundColor(AppColors.primary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if let tier {
                        Text(tier.name)
                            .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                            .tracking(1)
                            .foregroundColor(tier.color)
                    }
                }

                HStack(spacing: 10) {
                    if let ovr {
                        Text("OVR \(ovr)")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                            .tracking(0.4)
                            .foregroundColor(tier?.color ?? AppColors.textPrimary)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(
                                (tier?.color.opacity(0.10)) ?? Color.white.opacity(0.04)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(
                                        (tier?.color.opacity(0.33)) ?? Color.white.opacity(0.08),
                                        lineWidth: 1
                                    )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    inlineStat(icon: "clock", text: "\(focusMinutes)m")
                    inlineStat(icon: "flag", text: "\(missionsDone)")
                    inlineStat(icon: "flame", text: "\(streakDays)d")
                }
            }
            .padding(.leading, 10)

            // Score + remove
            HStack(spacing: 10) {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(totalScore)")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 16))
                        .tracking(-0.2)
                        .foregroundColor(isCurrentUser ? AppColors.primary : AppColors.textPrimary)
                    Text("pts")
                        .font(.custom(FontFamily.body.rawValue, size: 10))
                        .foregroundColor(AppColors.textMuted)
                }

                if let onRemove {
                    Button(action: onRemove) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundColor(AppColors.danger)
                            .opacity(0.7)
                            .padding(4)
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                    .accessibilityLabel("Remove \(username)")
                }
            }
            .padding(.leading, 8)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            isCurrentUser
                ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.08)
                : Color.white.opacity(0.02)
        )
        .overlay(alignment: .leading) {
            // Left rank-tier accent bar.
            Rectangle()
                .fill(tier?.color ?? Color.white.opacity(0.06))
                .frame(width: 2)
        }
        .padding(.bottom, isLast ? 0 : 8)
    }

    @ViewBuilder
    private var avatarView: some View {
        ZStack {
            if let url = avatarUrl, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    default:
                        Text(initial)
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                            .foregroundColor(AppColors.textPrimary)
                    }
                }
                .frame(width: 36, height: 36)
                .clipShape(Circle())
            } else {
                Text(initial)
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                    .foregroundColor(AppColors.textPrimary)
                    .frame(width: 36, height: 36)
                    .background(
                        isCurrentUser
                            ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.1)
                            : Color(.sRGB, red: 44/255, green: 52/255, blue: 64/255, opacity: 0.6)
                    )
                    .clipShape(Circle())
                    .overlay(
                        Circle().stroke(
                            isCurrentUser
                                ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.3)
                                : Color.white.opacity(0.06),
                            lineWidth: 1
                        )
                    )
            }
        }
    }

    @ViewBuilder
    private func inlineStat(icon: String, text: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 10))
                .foregroundColor(AppColors.textMuted)
            Text(text)
                .font(.custom(FontFamily.body.rawValue, size: 11))
                .foregroundColor(AppColors.textMuted)
        }
    }
}
