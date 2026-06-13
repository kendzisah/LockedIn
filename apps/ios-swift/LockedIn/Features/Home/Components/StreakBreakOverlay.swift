import SwiftUI
import DesignKit

/// StreakBreakOverlay — Full-screen takeover shown when `reconcileStreak()`
/// detects a missed day and resets the streak to 0. Surfaces the previous
/// streak length + rank, reassures that XP/OVR/achievements are preserved,
/// and — when the break is recoverable — offers a one-tap restore that spends
/// a weekly recovery token.
///
/// Ported from `apps/mobile/src/features/home/components/StreakBreakOverlay.tsx`,
/// extended with the recovery path the RN version never wired up.
struct StreakBreakOverlay: View {
    let previousStreakDays: Int
    let recoverable: Bool
    let recoveriesRemaining: Int
    let onRestore: () -> Void
    let onDismiss: () -> Void

    @State private var backdropOpacity: Double = 0
    @State private var titleOpacity: Double = 0
    @State private var titleOffset: CGFloat = 12
    @State private var cardOpacity: Double = 0
    @State private var reassureOpacity: Double = 0
    @State private var buttonOpacity: Double = 0

    /// The streak XP multiplier the user was earning at before the break.
    /// Streaks no longer gate rank — they scale XP earn — so a broken streak
    /// drops this back to 1.0× (no rank/XP/achievements are lost).
    private var previousMultiplier: Double {
        RankHelpers.streakXpMultiplier(currentStreak: previousStreakDays)
    }
    private var hadBonus: Bool { previousMultiplier > 1.0 }

    private func formatMultiplier(_ m: Double) -> String {
        // 1.0 → "1×", 1.05 → "1.05×", 1.2 → "1.2×"
        if m == m.rounded() { return "\(Int(m))×" }
        return String(format: "%g×", m)
    }
    private var bonusPercent: Int { Int((previousMultiplier - 1.0) * 100 + 0.5) }

    var body: some View {
        ZStack {
            Color(hex: "#0A0D12").ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 0) {
                    Text("STREAK BROKEN")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                        .tracking(3)
                        .foregroundColor(AppColors.danger)
                        .padding(.bottom, 12)
                    Text("You missed a day.")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 36))
                        .tracking(-0.5)
                        .foregroundColor(AppColors.textPrimary)
                        .multilineTextAlignment(.center)
                }
                .opacity(titleOpacity)
                .offset(y: titleOffset)

                breakCard
                    .opacity(cardOpacity)
                    .padding(.top, 32)

                reassurance
                    .opacity(reassureOpacity)
                    .padding(.top, 24)

                Spacer()

                buttons
                    .opacity(buttonOpacity)
                    .padding(.bottom, 60)
            }
            .padding(.horizontal, 24)
        }
        .opacity(backdropOpacity)
        .onAppear(perform: runEntrance)
    }

    // MARK: - Card

    private var breakCard: some View {
        VStack(spacing: 0) {
            cardRow(label: "Previous streak") {
                Text("\(previousStreakDays) \(previousStreakDays == 1 ? "day" : "days")")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                    .tracking(0.5)
                    .foregroundColor(AppColors.textPrimary)
            }
            cardDivider
            cardRow(label: "XP multiplier") {
                if hadBonus {
                    HStack(spacing: 8) {
                        Text(formatMultiplier(previousMultiplier))
                            .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                            .foregroundColor(AppColors.textMuted)
                            .strikethrough(true, color: AppColors.textMuted)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(AppColors.textMuted)
                        Text("1×")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                            .foregroundColor(AppColors.danger)
                    }
                } else {
                    // No bonus was active yet (streaks unlock the multiplier at
                    // 3 days), so nothing is actually lost here.
                    Text("1× · no bonus yet")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                        .foregroundColor(AppColors.textMuted)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.72))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color(.sRGB, red: 255/255, green: 71/255, blue: 87/255, opacity: 0.2), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func cardRow<Value: View>(label: String, @ViewBuilder value: () -> Value) -> some View {
        HStack {
            Text(label)
                .font(.custom(FontFamily.body.rawValue, size: 13))
                .foregroundColor(AppColors.textSecondary)
            Spacer()
            value()
        }
        .padding(.vertical, 6)
    }

    private var cardDivider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.05))
            .frame(height: 1)
            .padding(.vertical, 4)
    }

    // MARK: - Reassurance

    private var reassurance: some View {
        (
            Text("Your ")
                .foregroundColor(AppColors.textSecondary)
            + Text("rank, XP, and achievements")
                .foregroundColor(AppColors.success)
            + Text(" stay exactly where they are — only your streak ")
                .foregroundColor(AppColors.textSecondary)
            + Text("XP multiplier")
                .foregroundColor(AppColors.textPrimary)
            + Text(" resets to 1×. Build the streak back to earn faster again.")
                .foregroundColor(AppColors.textSecondary)
        )
        .font(.custom(FontFamily.body.rawValue, size: 14))
        .lineSpacing(6)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 8)
    }

    // MARK: - Buttons

    @ViewBuilder
    private var buttons: some View {
        VStack(spacing: 12) {
            if recoverable {
                Button(action: { HapticsService.shared.medium(); onRestore() }) {
                    VStack(spacing: 2) {
                        Text("Restore Streak")
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 17))
                            .tracking(-0.1)
                            .foregroundColor(AppColors.textPrimary)
                        Text(recoveriesRemaining == 1
                             ? "1 recovery left this week"
                             : "\(recoveriesRemaining) recoveries left this week")
                            .font(.custom(FontFamily.body.rawValue, size: 12))
                            .foregroundColor(Color.white.opacity(0.7))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.42))
                    .overlay(
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .stroke(Color(.sRGB, red: 120/255, green: 160/255, blue: 255/255, opacity: 0.55), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .shadow(color: AppColors.primary.opacity(0.35), radius: 14, x: 0, y: 4)
                }
                .buttonStyle(PressOpacityButtonStyle())

                Button(action: onDismiss) {
                    Text("Start over")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                        .foregroundColor(AppColors.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(PressOpacityButtonStyle())
            } else {
                Button(action: onDismiss) {
                    Text("Start over")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 17))
                        .tracking(-0.1)
                        .foregroundColor(AppColors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.42))
                        .overlay(
                            RoundedRectangle(cornerRadius: 28, style: .continuous)
                                .stroke(Color(.sRGB, red: 120/255, green: 160/255, blue: 255/255, opacity: 0.55), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                        .shadow(color: AppColors.primary.opacity(0.35), radius: 14, x: 0, y: 4)
                }
                .buttonStyle(PressOpacityButtonStyle())
            }
        }
    }

    // MARK: - Entrance animation

    private func runEntrance() {
        withAnimation(.easeOut(duration: 0.3)) { backdropOpacity = 1 }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            HapticsService.shared.warning()
            withAnimation(.easeOut(duration: 0.6)) {
                titleOpacity = 1
                titleOffset = 0
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            withAnimation(.easeOut(duration: 0.5)) { cardOpacity = 1 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            withAnimation(.easeOut(duration: 0.5)) { reassureOpacity = 1 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.9) {
            withAnimation(.easeOut(duration: 0.5)) { buttonOpacity = 1 }
        }
    }
}
