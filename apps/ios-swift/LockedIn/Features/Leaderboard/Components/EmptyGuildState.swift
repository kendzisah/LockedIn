import SwiftUI
import DesignKit

/// EmptyGuildState — Shown on BoardTab when the user is in no guilds yet.
/// HUD panel with shield icon + two CTAs (CREATE GUILD / JOIN WITH CODE).
///
/// Port of `apps/mobile/src/features/leaderboard/components/EmptyGuildState.tsx`.
struct EmptyGuildState: View {
    let onCreateGuild: () -> Void
    let onJoinGuild: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Reuse HUDPanel from the Home feature — same chrome (// HEADER bar
            // + corner brackets + bg). HUDPanel is internal to LockedIn so we
            // can use it here.
            HUDPanel(headerLabel: "GUILD") {
                VStack(spacing: 0) {
                    Image(systemName: "shield")
                        .font(.system(size: 40, weight: .light))
                        .foregroundColor(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.45))
                        .padding(.vertical, 12)

                    Text("YOU'RE NOT IN A GUILD YET.")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                        .tracking(1.6)
                        .foregroundColor(SystemTokens.textPrimary)
                        .multilineTextAlignment(.center)
                        .padding(.top, 4)

                    Text("Guilds compete weekly. Every session and mission earns points for your squad — and inviting friends grows your Social stat.")
                        .font(.custom(FontFamily.body.rawValue, size: 13))
                        .foregroundColor(SystemTokens.textMuted)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4) // ~18 line-height vs 13 font ⇒ ~5 spacing
                        .padding(.top, 10)
                        .padding(.bottom, 18)

                    Button(action: onCreateGuild) {
                        Text("⟐  CREATE GUILD")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                            .tracking(1.8)
                            .foregroundColor(SystemTokens.glowAccent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.18))
                            .overlay(
                                Rectangle()
                                    .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.45), lineWidth: 1)
                            )
                    }
                    .buttonStyle(PressOpacityButtonStyle())

                    Button(action: onJoinGuild) {
                        Text("JOIN WITH CODE")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                            .tracking(1.6)
                            .foregroundColor(SystemTokens.textSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.white.opacity(0.02))
                            .overlay(
                                Rectangle()
                                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                            )
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                    .padding(.top, 10)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }
}
