//
//  TodayWidget.swift
//  LockedInWidgets — Agent 4 (Wave 1, HUD redesign)
//
//  `.systemMedium` only — a 5-row HUD telemetry panel summarizing today's
//  progress. Matches the in-app HUD vocabulary: dark panel, sharp corners,
//  `// LABEL` Michroma eyebrow + 1pt Discipline-Blue gradient rule,
//  HUDCornerBrackets, monospace digits.
//
//  Replaces the prior "streak number + progress bar + next mission title"
//  layout with five LABEL: value rows:
//   - STREAK         🔥 N DAYS
//   - FOCUS          47 MIN
//   - MISSIONS       2/3
//   - XP TODAY       +45
//   - NEXT REFRESH   6H 12M
//
//  Vibrant-render constraints (per fleet briefing):
//   - Background ≥ 0.7 opacity. `AppColors.background.opacity(0.92)`.
//   - Border ≥ 2pt.
//   - No GlowOrb. No LinearGradient as a surface — the eyebrow rule IS a
//     LinearGradient but that's a foreground element (briefing-approved).
//   - All numerics use `.monospacedDigit()`. All fonts via FontFamily.
//   - Flame color via `getStreakTierInfo(streak:).color`.
//

import SwiftUI
import WidgetKit
import DesignKit

struct TodayWidget: Widget {
    let kind: String = "LockedInTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WidgetTimelineProvider()) { entry in
            TodayWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Today's focus telemetry — streak, missions, XP, refresh countdown.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

struct TodayWidgetEntryView: View {
    let entry: WidgetSnapshotEntry

    private var tierColor: Color {
        getStreakTierInfo(streak: entry.snapshot.consecutiveStreak).color
    }

    /// Time-to-local-midnight refresh countdown. Uppercase "6H 12M" style
    /// matches the Michroma HUD vocabulary. Recomputed every render — the
    /// 15-min reload schedule in `WidgetTimelineProvider` keeps this fresh
    /// enough for a daily countdown without exhausting the timeline budget.
    private var refreshCountdown: String {
        let cal = Calendar.current
        let midnight = cal.nextDate(
            after: entry.date,
            matching: DateComponents(hour: 0, minute: 0, second: 0),
            matchingPolicy: .nextTime
        ) ?? entry.date.addingTimeInterval(24 * 60 * 60)
        let delta = max(0, midnight.timeIntervalSince(entry.date))
        let h = Int(delta) / 3600
        let m = (Int(delta) % 3600) / 60
        return "\(h)H \(m)M"
    }

    /// Today's focus minutes — "47 MIN" / "1H 25M" / "0 MIN".
    /// Uppercase suffix keeps the row visually aligned with the other Michroma
    /// labels in the panel.
    private var focusValue: String {
        let total = max(0, entry.snapshot.dailyFocusedMinutes)
        let h = total / 60
        let m = total % 60
        if h > 0 {
            return "\(h)H \(m)M"
        }
        return "\(m) MIN"
    }

    var body: some View {
        ZStack {
            VStack(alignment: .leading, spacing: 8) {
                // Eyebrow strip.
                Text("// TODAY · STATUS")
                    .font(.custom(FontFamily.display.rawValue, size: 9))
                    .tracking(1.6)
                    .foregroundStyle(AppColors.textMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                LinearGradient(
                    colors: [SystemTokens.bracketColor, .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(height: 1)
                .frame(maxWidth: .infinity)

                Spacer(minLength: 2)

                // Five stacked telemetry rows.
                VStack(spacing: 6) {
                    streakRow
                    statRow(label: "FOCUS", value: focusValue)
                    statRow(
                        label: "MISSIONS",
                        value: "\(entry.snapshot.todayMissionsCompleted)/\(entry.snapshot.todayMissionsTotal)"
                    )
                    statRow(
                        label: "XP TODAY",
                        value: "+\(entry.snapshot.todayXpEarned)"
                    )
                    statRow(label: "NEXT REFRESH", value: refreshCountdown)
                }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)

        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
            // Solid graphite at 92% opacity — vibrant-render safe (≥ 0.7
            // per briefing). Sourced from AppColors.background so the
            // surface stays on-palette.
            AppColors.background.opacity(0.92)
        }
    }

    // MARK: - Row builders

    /// Streak gets a custom row so the tier-colored flame icon sits inline
    /// with the value column (between label and number). Every other row
    /// uses the generic `statRow` builder.
    private var streakRow: some View {
        HStack(spacing: 8) {
            Text("STREAK")
                .font(.custom(FontFamily.display.rawValue, size: 9))
                .tracking(1.4)
                .foregroundStyle(AppColors.textMuted)
                .lineLimit(1)
            Spacer(minLength: 4)
            HStack(spacing: 6) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(tierColor)
                    .widgetAccentable()
                Text("\(entry.snapshot.consecutiveStreak) DAYS")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                    .monospacedDigit()
                    .foregroundStyle(AppColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
    }

    private func statRow(label: String, value: String) -> some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.custom(FontFamily.display.rawValue, size: 9))
                .tracking(1.4)
                .foregroundStyle(AppColors.textMuted)
                .lineLimit(1)
            Spacer(minLength: 4)
            Text(value)
                .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                .monospacedDigit()
                .foregroundStyle(AppColors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }
}
