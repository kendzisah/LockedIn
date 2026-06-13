import SwiftUI
import DesignKit

/// MissionLogCard — HUD-styled quest log row used on the Missions tab.
///
/// Ported 1:1 from
/// `apps/mobile/src/features/missions/components/MissionLogCard.tsx`.
/// Independently tappable to mark complete (with success haptic).
struct MissionLogCard: View {
    let mission: Mission
    let onComplete: (String) -> Void

    private var primaryStat: Stat? { mission.stats?.first }
    private var accent: Color {
        if let s = primaryStat, let c = StatTokens.colors[s] { return c }
        return SystemTokens.glowAccent
    }

    var body: some View {
        Button(action: handlePress) {
            HStack(spacing: 0) {
                // 2px left accent
                Rectangle()
                    .fill(accent)
                    .frame(width: 2)

                VStack(alignment: .leading, spacing: 0) {
                    // Head: status icon + title
                    HStack(alignment: .center, spacing: 10) {
                        statusIcon
                        Text(mission.title)
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 15))
                            .tracking(-0.1)
                            .foregroundColor(mission.completed ? SystemTokens.textMuted : SystemTokens.textPrimary)
                            .strikethrough(mission.completed)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    // Description
                    Text(mission.description)
                        .font(.custom(FontFamily.body.rawValue, size: 13))
                        .foregroundColor(SystemTokens.textMuted)
                        .lineSpacing(18 - 13)
                        .opacity(mission.completed ? 0.6 : 1.0)
                        .padding(.top, 4)
                        .padding(.leading, 28)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    // Time gate (optional)
                    if let tg = mission.timeGate {
                        Text("⏱  \(tg)")
                            .font(.custom(FontFamily.bodyMedium.rawValue, size: 11))
                            .tracking(0.4)
                            .foregroundColor(SystemTokens.gold)
                            .padding(.top, 4)
                            .padding(.leading, 28)
                    }

                    // Meta row: stat pills + XP
                    HStack(spacing: 8) {
                        HStack(spacing: 6) {
                            ForEach(Array((mission.stats ?? []).prefix(2)), id: \.self) { s in
                                statPill(for: s)
                            }
                        }
                        Spacer()
                        Text("+\(mission.xp) XP")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                            .tracking(0.6)
                            .foregroundColor(mission.completed ? SystemTokens.textMuted : SystemTokens.cyan)
                    }
                    .padding(.top, 8)
                    .padding(.leading, 28)
                }
                .padding(.leading, 12)
                .padding(.trailing, 8)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(mission.completed ? Color(.sRGB, red: 0, green: 214/255, blue: 143/255, opacity: 0.04) : Color.white.opacity(0.02))
        }
        .buttonStyle(PressOpacityButtonStyle())
        .disabled(mission.completed)
    }

    // MARK: - Subviews

    @ViewBuilder
    private var statusIcon: some View {
        ZStack {
            if mission.completed {
                Circle()
                    .fill(SystemTokens.green)
                    .frame(width: 16, height: 16)
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
            } else {
                Circle()
                    .stroke(SystemTokens.textMuted, lineWidth: 1.2)
                    .frame(width: 14, height: 14)
            }
        }
        .frame(width: 18, height: 18)
    }

    @ViewBuilder
    private func statPill(for stat: Stat) -> some View {
        let color = StatTokens.colors[stat] ?? SystemTokens.glowAccent
        let label = StatTokens.labels[stat] ?? "—"
        Text("+\(label)")
            .font(.custom(FontFamily.headingBold.rawValue, size: 9))
            .tracking(0.8)
            .foregroundColor(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.10))
            .overlay(
                Rectangle()
                    .stroke(color.opacity(0.33), lineWidth: 1)
            )
    }

    // MARK: - Actions

    private func handlePress() {
        if mission.completed { return }
        HapticsService.shared.success()
        onComplete(mission.id)
    }
}
