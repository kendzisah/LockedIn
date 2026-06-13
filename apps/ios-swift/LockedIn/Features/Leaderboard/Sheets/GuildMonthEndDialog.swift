import SwiftUI
import DesignKit

/// GuildMonthEndDialog — HUD-styled month-end nudge shown on the last day of
/// the month when the user is in a guild. Tells them the monthly rankings are
/// about to lock and routes them to the guild board to see where they stand.
///
/// Presented by `TabNavigator` from `GuildState.showMonthEndPrompt`. This view
/// is presentation-only; the coordinator owns the dedupe + navigation.
struct GuildMonthEndDialog: View {
    let onViewBoard: () -> Void
    let onDismiss: () -> Void

    @State private var appear = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.75)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { onDismiss() }

            panel
                .padding(.horizontal, 28)
                .scaleEffect(appear ? 1 : 0.96)
                .opacity(appear ? 1 : 0)
        }
        .onAppear {
            HapticsService.shared.medium()
            withAnimation(.easeOut(duration: 0.28)) { appear = true }
        }
    }

    // MARK: - Panel

    private var panel: some View {
        ZStack {
            Rectangle()
                .fill(SystemTokens.panelBg)
                .overlay(Rectangle().stroke(SystemTokens.panelBorder, lineWidth: 1))

            VStack(spacing: 0) {
                Text("// MONTH-END PROTOCOL")
                    .font(.custom(FontFamily.display.rawValue, size: 11))
                    .tracking(2.5)
                    .foregroundColor(SystemTokens.glowAccent)
                    .padding(.bottom, 16)

                Image(systemName: "trophy.fill")
                    .font(.system(size: 30))
                    .foregroundColor(SystemTokens.gold)
                    .padding(.bottom, 16)

                Text("The board locks tonight.")
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .tracking(-0.3)
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 12)

                Text("Monthly guild rankings reset at midnight. See where you finished — or make one last push to climb before the slate wipes clean.")
                    .font(.custom(FontFamily.body.rawValue, size: 14))
                    .foregroundColor(SystemTokens.textSecondary)
                    .lineSpacing(5)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 4)
                    .padding(.bottom, 24)

                viewBoardButton
                    .padding(.bottom, 10)

                Button(action: onDismiss) {
                    Text("DISMISS")
                        .font(.custom(FontFamily.display.rawValue, size: 11))
                        .tracking(2.0)
                        .foregroundColor(SystemTokens.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(PressOpacityButtonStyle())
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 28)

            HUDCornerBrackets(length: 16, thickness: 1.5, color: SystemTokens.bracketColor, pulses: false)
                .allowsHitTesting(false)
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - CTA

    private var viewBoardButton: some View {
        Button(action: onViewBoard) {
            ZStack {
                Rectangle()
                    .fill(SystemTokens.glowAccentSoft)
                    .overlay(Rectangle().stroke(SystemTokens.bracketColor, lineWidth: 1))

                HStack(spacing: 0) {
                    Rectangle().fill(SystemTokens.bracketColor).frame(width: 2)
                    Spacer(minLength: 0)
                }

                HStack(spacing: 10) {
                    Text("▸")
                        .font(.custom(FontFamily.display.rawValue, size: 10))
                        .foregroundColor(SystemTokens.bracketColor)
                    Text("VIEW STANDINGS")
                        .font(.custom(FontFamily.display.rawValue, size: 12))
                        .tracking(2.0)
                        .foregroundColor(AppColors.textPrimary)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
        }
        .buttonStyle(PressOpacityButtonStyle())
    }
}
