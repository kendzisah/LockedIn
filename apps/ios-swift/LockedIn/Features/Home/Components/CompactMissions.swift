import SwiftUI
import DesignKit

/// Lightweight mirror of a daily mission row, sufficient to render the
/// `CompactMissions` panel. The authoritative model belongs to W4's
/// `Features/Missions/` feature — the coordinator should map the missions
/// feature's `Mission` type into `CompactMissionRow` and pass it in.
public struct CompactMissionRow: Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let description: String
    public let stats: [Stat]
    public let xp: Int
    public let completed: Bool

    public init(id: String, title: String, description: String, stats: [Stat], xp: Int, completed: Bool) {
        self.id = id
        self.title = title
        self.description = description
        self.stats = stats
        self.xp = xp
        self.completed = completed
    }
}

/// CompactMissions — Quest-log HUD panel. One row per mission with a
/// stat-color left accent, status icon, name, description, stat pills, and
/// XP value. Bottom row shows the "+50 XP complete all" bonus copy.
///
/// Ported 1:1 from `apps/mobile/src/features/home/components/CompactMissions.tsx`.
struct CompactMissions: View {
    let missions: [CompactMissionRow]
    let completedCount: Int
    let onPress: () -> Void

    private var allDone: Bool {
        !missions.isEmpty && completedCount == missions.count
    }

    var body: some View {
        HUDPanel(
            headerLabel: "MISSIONS",
            headerRight: "\(completedCount)/\(missions.count)",
            onPress: onPress
        ) {
            VStack(spacing: 8) {
                ForEach(Array(missions.prefix(3))) { mission in
                    row(for: mission)
                }
                bonusRow
            }
        }
    }

    @ViewBuilder
    private func row(for mission: CompactMissionRow) -> some View {
        let primary = mission.stats.first
        let accent = primary.flatMap { StatTokens.colors[$0] } ?? SystemTokens.glowAccent

        HStack(spacing: 0) {
            Rectangle()
                .fill(accent)
                .frame(width: 2)

            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    if mission.completed {
                        ZStack {
                            Circle()
                                .fill(SystemTokens.green)
                                .frame(width: 14, height: 14)
                            Image(systemName: "checkmark")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .frame(width: 16, height: 16)
                    } else {
                        Circle()
                            .stroke(SystemTokens.textMuted, lineWidth: 1.2)
                            .frame(width: 12, height: 12)
                            .frame(width: 16, height: 16)
                    }
                    Text(mission.title)
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                        .tracking(-0.1)
                        .foregroundColor(mission.completed ? SystemTokens.textMuted : SystemTokens.textPrimary)
                        .strikethrough(mission.completed)
                        .lineLimit(1)
                }

                Text(mission.description)
                    .font(.custom(FontFamily.body.rawValue, size: 12))
                    .foregroundColor(SystemTokens.textMuted)
                    .lineLimit(2)
                    .padding(.top, 3)
                    .padding(.leading, 24)

                HStack(spacing: 0) {
                    HStack(spacing: 6) {
                        ForEach(Array(mission.stats.prefix(2)), id: \.self) { s in
                            let c = StatTokens.colors[s] ?? SystemTokens.glowAccent
                            let label = StatTokens.labels[s] ?? "—"
                            Text("+\(label)")
                                .font(.custom(FontFamily.headingBold.rawValue, size: 9))
                                .tracking(0.8)
                                .foregroundColor(c)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(c.opacity(0.10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 2)
                                        .stroke(c.opacity(0.33), lineWidth: 1)
                                )
                                .cornerRadius(2)
                        }
                    }
                    Spacer()
                    Text("+\(mission.xp) XP")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                        .tracking(0.6)
                        .foregroundColor(mission.completed ? SystemTokens.textMuted : SystemTokens.cyan)
                }
                .padding(.top, 6)
                .padding(.leading, 24)
            }
            .padding(.leading, 10)
            .padding(.trailing, 4)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.white.opacity(0.02))
    }

    @ViewBuilder
    private var bonusRow: some View {
        VStack(spacing: 0) {
            // Dashed divider — approximated as a Capsule grid since SwiftUI's
            // dashed stroke only paints inside a Shape. A 1px Path with dash
            // gets the same visual effect.
            DashedLine()
                .stroke(style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                .foregroundColor(SystemTokens.divider)
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
    }
}

/// 1-pixel-tall horizontal dashed line, drawn via a `Shape`.
private struct DashedLine: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 0, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.width, y: rect.midY))
        return p
    }
}
