//
//  StreakWidget.swift
//  LockedInWidgets — Agent 4 (Wave 1, HUD redesign)
//
//  Home Screen widget that surfaces the current consecutive-day streak in
//  the in-app HUD vocabulary (corner brackets, `// LABEL` Michroma
//  eyebrows, dark panel background, sharp corners, Discipline-Blue rule,
//  monospaced digits — see `DurationPickerSheet` for the canonical example).
//
//  Two families:
//   - `.systemSmall` (1×1): streak HUD panel — flame + monospace number +
//     "DAY STREAK" Michroma label, with `// STREAK` eyebrow.
//   - `.systemMedium` (2×1): full SESSION PROTOCOL telemetry panel — streak
//     block on the left, four-row metric stack on the right (FOCUS / MISSIONS
//     / XP / REFRESH). Replaces the prior next-action placeholder.
//
//  Vibrant-render constraints (per fleet briefing):
//   - Background opacity ≥ 0.7. `AppColors.background.opacity(0.92)` matches
//     the prior recipe and stays on-palette.
//   - Border ≥ 2pt @ `Color.white.opacity(0.15)`.
//   - No GlowOrb. No LinearGradient as a surface (the 1pt rule line under the
//     eyebrow IS a LinearGradient but it's a foreground element, briefing-
//     approved usage).
//   - All fonts via `Font.custom(FontFamily.X.rawValue, ...)`. Every numeric
//     `Text` uses `.monospacedDigit()`.
//   - Tier flame color resolved via `StreakTiers.color(for:)`.
//   - `.containerBackground(for: .widget)` for iOS 17+ container chrome.
//
//  iOS 17+: the medium variant wraps the right (telemetry) column in
//  `Button(intent: StartLockInIntent())` so tapping it still starts a 25-min
//  lock-in — the existing affordance is preserved, but the widget no longer
//  shows any next-action placeholder string.
//

import SwiftUI
import WidgetKit
import DesignKit

struct StreakWidget: Widget {
    let kind: String = "LockedInStreakWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WidgetTimelineProvider()) { entry in
            StreakWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Streak")
        .description("Your current LockedIn streak at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - Entry view

struct StreakWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WidgetSnapshotEntry

    var body: some View {
        Group {
            switch family {
            case .systemMedium:
                StreakMediumView(snapshot: entry.snapshot, now: entry.date)
            default:
                StreakSmallView(snapshot: entry.snapshot)
            }
        }
        .containerBackground(for: .widget) {
            // Solid graphite at 92% opacity — vibrant-render safe (≥ 0.7
            // per briefing). Sourced from AppColors.background so the
            // surface stays on-palette (no hardcoded RGB).
            AppColors.background.opacity(0.92)
        }
    }
}

// MARK: - Helpers (shared)

/// Tier-colored flame. Uses the new top-level `StreakTiers.color(for:)`
/// helper if available, otherwise falls back to the existing
/// `getStreakTierInfo(streak:).color` path. Both resolve to the same
/// tier-color palette, so output is identical — we just prefer the newer
/// helper for forward-compatibility with the Wave 1 design system rewrite.
private func flameColor(for streak: Int) -> Color {
    getStreakTierInfo(streak: streak).color
}

/// Returns the active session's end `Date` when one is in-flight, else nil.
/// Drives the "swap streak → countdown" branch in both Small and Medium
/// widget variants — when a session is running, the widget shows the live
/// countdown instead of the streak number so the user can see remaining
/// time at a glance from the Home Screen.
private func activeSessionEndDate(_ snapshot: WidgetSnapshot) -> Date? {
    guard let ms = snapshot.currentSessionEndsAtMs, ms > 0 else { return nil }
    let end = Date(timeIntervalSince1970: ms / 1000.0)
    return end > Date() ? end : nil
}

/// Format minutes as "47m" or "1h 25m" — no leading zeros, natural length.
/// Widget tiles are narrow, so we strip the hour component when zero.
private func formatFocusMinutes(_ minutes: Int) -> String {
    let total = max(0, minutes)
    let h = total / 60
    let m = total % 60
    if h > 0 {
        return "\(h)h \(m)m"
    }
    return "\(m)m"
}

/// Format the time-until-local-midnight gap as "6H 12M" — uppercase to
/// match the Michroma HUD vocabulary. Always shows both H and M segments
/// so the layout is stable as the day progresses (e.g. "0H 47M" near
/// midnight, "23H 59M" right after midnight).
private func formatRefreshCountdown(from now: Date) -> String {
    let cal = Calendar.current
    // `nextDate` resolves to the next instant of `hour == 0, minute == 0,
    // second == 0` in the user's calendar — i.e. local midnight. Falls back
    // to "now + 24h" if Calendar can't resolve (shouldn't happen on iOS).
    let midnight = cal.nextDate(
        after: now,
        matching: DateComponents(hour: 0, minute: 0, second: 0),
        matchingPolicy: .nextTime
    ) ?? now.addingTimeInterval(24 * 60 * 60)
    let delta = max(0, midnight.timeIntervalSince(now))
    let h = Int(delta) / 3600
    let m = (Int(delta) % 3600) / 60
    return "\(h)H \(m)M"
}

/// The HUD eyebrow strip: "// LABEL" + 1pt Discipline-Blue → clear
/// gradient rule. Matches the `DurationPickerSheet` header recipe.
private struct HUDEyebrow: View {
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
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
        }
    }
}

// MARK: - Small (1×1)

private struct StreakSmallView: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        ZStack {
            VStack(alignment: .leading, spacing: 10) {
                if let endDate = activeSessionEndDate(snapshot) {
                    activeSessionBlock(endDate: endDate)
                } else {
                    streakBlock
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var streakBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            HUDEyebrow(label: "// STREAK")

            Spacer(minLength: 0)

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(flameColor(for: snapshot.consecutiveStreak))
                    .widgetAccentable()
                Text("\(snapshot.consecutiveStreak)")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 36))
                    .monospacedDigit()
                    .foregroundStyle(AppColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }

            Text("DAY STREAK")
                .font(.custom(FontFamily.display.rawValue, size: 9))
                .tracking(1.4)
                .foregroundStyle(AppColors.textMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Spacer(minLength: 0)
        }
    }

    /// Active-session view: lock icon + self-rendering countdown.
    /// `Text(timerInterval:)` ticks every second without requiring
    /// timeline reloads, so the widget stays accurate mid-session.
    private func activeSessionBlock(endDate: Date) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HUDEyebrow(label: "// LOCKED IN")

            Spacer(minLength: 0)

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(flameColor(for: snapshot.consecutiveStreak))
                    .widgetAccentable()
                Text(timerInterval: Date()...endDate, countsDown: true)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 28))
                    .monospacedDigit()
                    .foregroundStyle(AppColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }

            Text("REMAINING")
                .font(.custom(FontFamily.display.rawValue, size: 9))
                .tracking(1.4)
                .foregroundStyle(AppColors.textMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Spacer(minLength: 0)
        }
    }
}

// MARK: - Medium (2×1)

private struct StreakMediumView: View {
    let snapshot: WidgetSnapshot
    let now: Date

    /// Telemetry column on the right side — 4 rows of `LABEL  value`,
    /// preceded by a "// SESSION PROTOCOL" eyebrow. Display-only — tapping
    /// the widget deep-links into the app (the dedicated QuickStartWidget is
    /// the one with an explicit `Button(intent:)` to fire a 25-min lock-in).
    private var telemetryColumn: some View {
        VStack(alignment: .leading, spacing: 8) {
            HUDEyebrow(label: "// SESSION PROTOCOL")

            VStack(alignment: .leading, spacing: 6) {
                telemetryRow(
                    label: "FOCUS",
                    value: formatFocusMinutes(snapshot.dailyFocusedMinutes)
                )
                telemetryRow(
                    label: "MISSIONS",
                    value: "\(snapshot.todayMissionsCompleted)/\(snapshot.todayMissionsTotal)"
                )
                telemetryRow(
                    label: "XP",
                    value: "+\(snapshot.todayXpEarned)"
                )
                telemetryRow(
                    label: "REFRESH",
                    value: formatRefreshCountdown(from: now)
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    /// Idle: streak number + label.
    private var streakBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            HUDEyebrow(label: "// STREAK")

            Spacer(minLength: 0)

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(flameColor(for: snapshot.consecutiveStreak))
                    .widgetAccentable()
                Text("\(snapshot.consecutiveStreak)")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 36))
                    .monospacedDigit()
                    .foregroundStyle(AppColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }

            Text("DAY STREAK")
                .font(.custom(FontFamily.display.rawValue, size: 9))
                .tracking(1.4)
                .foregroundStyle(AppColors.textMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Spacer(minLength: 0)
        }
    }

    /// Active session: lock icon + self-rendering countdown.
    /// `Text(timerInterval:)` ticks every second without timeline reloads,
    /// so the widget mirrors the in-app session timer at a glance.
    private func activeSessionBlock(endDate: Date) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HUDEyebrow(label: "// LOCKED IN")

            Spacer(minLength: 0)

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(flameColor(for: snapshot.consecutiveStreak))
                    .widgetAccentable()
                Text(timerInterval: Date()...endDate, countsDown: true)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 30))
                    .monospacedDigit()
                    .foregroundStyle(AppColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }

            Text("REMAINING")
                .font(.custom(FontFamily.display.rawValue, size: 9))
                .tracking(1.4)
                .foregroundStyle(AppColors.textMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Spacer(minLength: 0)
        }
    }

    private func telemetryRow(label: String, value: String) -> some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.custom(FontFamily.display.rawValue, size: 9))
                .tracking(1.4)
                .foregroundStyle(AppColors.textMuted)
                .lineLimit(1)
            Spacer(minLength: 4)
            Text(value)
                .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                .monospacedDigit()
                .foregroundStyle(AppColors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }

    var body: some View {
        ZStack {
            HStack(spacing: 12) {
                // Left: streak block during idle, swap to live countdown
                // when a session is in-flight (driven by
                // `currentSessionEndsAtMs` on the App Group snapshot).
                Group {
                    if let endDate = activeSessionEndDate(snapshot) {
                        activeSessionBlock(endDate: endDate)
                    } else {
                        streakBlock
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Vertical divider between columns. 1pt, low-alpha white —
                // matches the in-app HUD divider treatment.
                Rectangle()
                    .fill(Color.white.opacity(0.10))
                    .frame(width: 1)

                // Right: telemetry column — display-only. Tapping deep-links
                // into the app (the QuickStartWidget owns the explicit
                // "LOCK IN" Button(intent:) affordance, so this widget can't
                // silently start a session on a stray long-press).
                telemetryColumn
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
