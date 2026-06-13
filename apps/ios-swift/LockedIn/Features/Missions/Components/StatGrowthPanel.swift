import SwiftUI
import DesignKit

/// StatGrowthPanel — Aggregates `mission.stats[]` across today's daily
/// missions and shows which stats today's set targets. Also surfaces the
/// user's lowest current stat as a "weakest stat" callout.
///
/// Ported 1:1 from
/// `apps/mobile/src/features/missions/components/StatGrowthPanel.tsx`.
struct StatGrowthPanel: View {
    let missions: [Mission]

    /// Per-stat current values from user_stats. Wired from
    /// `HomeService.shared.getCachedStats()` via `TabNavigator`.
    let statValues: [Stat: Int]

    private static let statFullLabel: [Stat: String] = [
        .discipline:  "Discipline",
        .focus:       "Focus",
        .execution:   "Execution",
        .consistency: "Consistency",
        .social:      "Social"
    ]

    private static let orderedStats: [Stat] = [
        .discipline, .focus, .execution, .consistency, .social
    ]

    private var counts: [Stat: Int] {
        var map: [Stat: Int] = [:]
        for m in missions {
            for s in m.stats ?? [] {
                map[s, default: 0] += 1
            }
        }
        return map
    }

    private var weakestStat: Stat? {
        guard !statValues.isEmpty else { return nil }
        var lowest: Stat = .discipline
        var lowestVal = statValues[.discipline] ?? 1
        for s in Self.orderedStats {
            let v = statValues[s] ?? 1
            if v < lowestVal {
                lowest = s
                lowestVal = v
            }
        }
        return lowest
    }

    var body: some View {
        HUDPanel(headerLabel: "STAT GROWTH") {
            VStack(alignment: .leading, spacing: 0) {
                Text("Today's missions target:")
                    .font(.custom(FontFamily.body.rawValue, size: 12))
                    .tracking(0.4)
                    .foregroundColor(SystemTokens.textMuted)
                    .padding(.bottom, 10)

                // Stat grid (wrapping)
                statGrid

                if let weak = weakestStat {
                    weakestRow(for: weak)
                        .padding(.top, 12)
                }
            }
        }
    }

    @ViewBuilder
    private var statGrid: some View {
        // Use a horizontal stack with wrap behavior via flexible widths.
        // Five cells fit a typical phone width comfortably.
        HStack(spacing: 6) {
            ForEach(Self.orderedStats, id: \.self) { stat in
                statCell(for: stat)
            }
        }
    }

    @ViewBuilder
    private func statCell(for stat: Stat) -> some View {
        let color = StatTokens.colors[stat] ?? SystemTokens.glowAccent
        let count = counts[stat] ?? 0
        let active = count > 0
        VStack(spacing: 2) {
            Text("+\(StatTokens.labels[stat] ?? "—")")
                .font(.custom(FontFamily.headingBold.rawValue, size: 9))
                .tracking(0.8)
                .foregroundColor(active ? color : SystemTokens.textMuted)
            Text("\(count)")
                .font(.custom(FontFamily.headingBold.rawValue, size: 16))
                .tracking(-0.3)
                .foregroundColor(active ? SystemTokens.textPrimary : SystemTokens.textMuted)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, minHeight: 56)
        .background(active ? color.opacity(0.08) : Color.white.opacity(0.02))
        .overlay(
            Rectangle()
                .stroke(active ? color.opacity(0.27) : SystemTokens.divider, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func weakestRow(for stat: Stat) -> some View {
        let color = StatTokens.colors[stat] ?? SystemTokens.glowAccent
        let value = statValues[stat] ?? 1
        let valueStr = String(format: "%02d", value)
        VStack(alignment: .leading, spacing: 4) {
            Text("WEAKEST STAT")
                .font(.custom(FontFamily.headingBold.rawValue, size: 9))
                .tracking(1.6)
                .foregroundColor(SystemTokens.textMuted)
            Text((Self.statFullLabel[stat] ?? "—").uppercased())
                .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                .tracking(1.0)
                .foregroundColor(color)
            Text("\(valueStr) — focus missions in this stat to grow it")
                .font(.custom(FontFamily.body.rawValue, size: 11))
                .tracking(0.3)
                .foregroundColor(SystemTokens.textMuted)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.02))
        .overlay(
            Rectangle()
                .stroke(color.opacity(0.33), lineWidth: 1)
        )
    }
}
