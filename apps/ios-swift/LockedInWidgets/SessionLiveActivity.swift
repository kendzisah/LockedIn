//
//  SessionLiveActivity.swift
//  LockedInWidgets — Agent 2 (Live Activity + Always-On Display)
//
//  Renders the ActivityKit Live Activity for an active LockedIn focus
//  session in four presentations:
//
//    1. Lock Screen / banner (the "big" view shown above the wallpaper)
//    2. Dynamic Island — compact (leading + trailing slots)
//    3. Dynamic Island — expanded (full custom layout)
//    4. Dynamic Island — minimal (single tier-colored icon)
//
//  Pairs with the Always-On-Display (AOD) requirement (#C2): SwiftUI
//  handles dim rendering automatically as long as the activity's
//  `staleDate` is set sensibly. `SessionEngine` sets staleDate to
//  `now + remainingSeconds + 5min` on every `.update(...)` — giving the
//  activity headroom to keep rendering for a few minutes past expiry
//  even if the main app is asleep.
//
//  Design constraints (vibrant-render-safe — see fleet briefing
//  "Glass + widget rules"):
//   - Lock Screen background: solid `#151A21 @ 0.85` (≥0.7 alpha).
//   - Borders: 2pt + `Color.white.opacity(0.10)` (fine borders vanish).
//   - NO GlowOrb, NO LinearGradient backgrounds, NO multi-stack alpha.
//   - Compact slots: single element each, ≤80pt.
//   - Minimal slot: one tier-colored flame icon, no text.
//
//  Tier color resolution: `consecutiveStreak` is NOT in
//  `ContentState` (kept lean per the briefing). The widget reads the
//  current streak from the App Group `WidgetSnapshot` and falls back
//  to the default tier color (streak < 3) when the snapshot is
//  missing — e.g. immediately after first install before
//  `WidgetDataPublisher` has written.
//

import ActivityKit
import SwiftUI
import WidgetKit
import DesignKit
import AppIntentsKit

@available(iOS 16.2, *)
struct SessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SessionActivityAttributes.self) { context in
            // Lock Screen / banner view
            LockScreenView(
                attributes: context.attributes,
                state: context.state
            )
            .containerBackground(for: .widget) { Color.clear }
        } dynamicIsland: { context in
            let streak = SessionLiveActivityStreakReader.consecutiveStreak()
            let tier = StreakTiers.color(for: streak)
            let endDate = SessionLiveActivityFormat.endDate(for: context.state)

            return DynamicIsland {
                // Expanded — full custom layout
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 4) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(tier)
                        Text("FOCUS")
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 10))
                            .tracking(1.6)
                            .foregroundStyle(AppColors.textSecondary)
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        SessionLiveActivityTimer(
                            endDate: endDate,
                            fallbackSeconds: context.state.remainingSeconds,
                            font: .custom(FontFamily.headingBold.rawValue, size: 28)
                        )
                        .foregroundStyle(AppColors.textPrimary)
                        Text(context.state.phaseLabel)
                            .font(.custom(FontFamily.body.rawValue, size: 11))
                            .foregroundStyle(AppColors.textSecondary)
                            .lineLimit(1)
                    }
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    // iOS 17+: `Button(intent:)` runs `EndLockInIntent` in
                    // the extension process — no app foregrounding. iOS 16.2
                    // ActivityKit doesn't support the intent-based button
                    // API, so we hide the action on that floor; the user
                    // can still end via the app or the lock-screen banner.
                    if #available(iOS 17.0, *) {
                        Button(intent: EndLockInIntent()) {
                            Text("End early")
                                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 13))
                                .foregroundStyle(AppColors.textPrimary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(AppColors.surface.opacity(0.85))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                                .strokeBorder(Color.white.opacity(0.10), lineWidth: 2)
                                        )
                                )
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 4)
                        .padding(.top, 6)
                    } else {
                        EmptyView()
                    }
                }
            } compactLeading: {
                // Tier-colored lock — communicates "session in progress"
                // without consuming the precious compact-trailing slot the
                // countdown needs. ~14pt fits the bubble without truncation.
                Image(systemName: "lock.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(tier)
            } compactTrailing: {
                // Self-rendering countdown. iOS ticks this every second
                // even when the host app is backgrounded — fixes the
                // "frozen at 0:41" bug from the prior static-text impl.
                SessionLiveActivityTimer(
                    endDate: endDate,
                    fallbackSeconds: context.state.remainingSeconds,
                    font: .custom(FontFamily.headingSemiBold.rawValue, size: 14)
                )
                .foregroundStyle(AppColors.textPrimary)
            } minimal: {
                // Single tier-colored lock icon. No text — minimal bubble
                // is too small for legible time.
                Image(systemName: "lock.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(tier)
            }
            .keylineTint(tier)
        }
    }
}

// MARK: - Self-rendering timer

/// `Text(timerInterval:)` wrapper that handles the two presentation cases:
///  - Active session (`endDate` in the future): hand the date to SwiftUI's
///    timer view so iOS auto-ticks the countdown every second even when
///    the host app is suspended.
///  - Expired session (`endDate` in the past or nil — legacy state from
///    an older app version): fall back to the static `remainingSeconds`
///    label so the visible text doesn't show a negative count-up.
@available(iOS 16.2, *)
private struct SessionLiveActivityTimer: View {
    let endDate: Date?
    let fallbackSeconds: Int
    let font: Font

    var body: some View {
        Group {
            if let endDate, endDate > Date() {
                Text(timerInterval: Date()...endDate, countsDown: true)
                    .font(font)
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .lineLimit(1)
            } else {
                Text(SessionLiveActivityFormat.timer(seconds: fallbackSeconds))
                    .font(font)
                    .monospacedDigit()
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Lock Screen view

@available(iOS 16.2, *)
private struct LockScreenView: View {
    let attributes: SessionActivityAttributes
    let state: SessionActivityAttributes.ContentState

    private var tierColor: Color {
        StreakTiers.color(for: SessionLiveActivityStreakReader.consecutiveStreak())
    }

    var body: some View {
        HStack(spacing: 14) {
            // Lock icon block (left) — communicates "you're locked in".
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(AppColors.surface.opacity(0.85))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.10), lineWidth: 2)
                    )
                    .frame(width: 56, height: 56)
                Image(systemName: "lock.fill")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(tierColor)
            }

            // Timer + phase (right) — self-rendering countdown.
            VStack(alignment: .leading, spacing: 2) {
                SessionLiveActivityTimer(
                    endDate: SessionLiveActivityFormat.endDate(for: state),
                    fallbackSeconds: state.remainingSeconds,
                    font: .custom(FontFamily.headingBold.rawValue, size: 32)
                )
                .foregroundStyle(AppColors.textPrimary)
                Text(state.phaseLabel)
                    .font(.custom(FontFamily.body.rawValue, size: 13))
                    .foregroundStyle(Color.white.opacity(0.7))
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            // Solid backgroundSecondary at 0.85 — vibrant-render safe.
            // Briefing-specified: rgba(21,26,33,0.85).
            Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.85)
        )
        .overlay(
            // 2pt border — fine borders < 1.5pt vanish in vibrant mode.
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.white.opacity(0.10), lineWidth: 2)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

// MARK: - Timer formatting (MM:SS, hours when ≥ 1h)

enum SessionLiveActivityFormat {
    /// MM:SS for sessions under an hour, H:MM:SS otherwise. Matches
    /// `SessionTimeFormatter.format(seconds:)` in the main app so the
    /// Lock Screen / banner shows the same value as the immersive
    /// screen at a glance. Used as a fallback when the activity state
    /// predates `endTimestampMs` (resumed activities from older builds).
    static func timer(seconds: Int) -> String {
        let s = max(0, seconds)
        let h = s / 3600
        let m = (s % 3600) / 60
        let sec = s % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, sec)
        } else {
            return String(format: "%d:%02d", m, sec)
        }
    }

    /// Resolve the session's end `Date` from the activity state. Returns
    /// `nil` for legacy activities that don't carry `endTimestampMs`,
    /// signalling the widget to fall back to the static timer text.
    @available(iOS 16.2, *)
    static func endDate(for state: SessionActivityAttributes.ContentState) -> Date? {
        guard let ms = state.endTimestampMs, ms > 0 else { return nil }
        return Date(timeIntervalSince1970: ms / 1000.0)
    }
}

// MARK: - Streak reader (App Group → WidgetSnapshot)

/// Resolves the current consecutive-day streak from the App Group
/// `WidgetSnapshot` so the flame icon picks up the correct tier color
/// in every Live Activity surface. Falls back to 0 (default tier color)
/// when the snapshot is missing — e.g. before the main app has
/// published its first snapshot.
enum SessionLiveActivityStreakReader {
    static func consecutiveStreak() -> Int {
        guard let defaults = SharedScreenTime.sharedDefaults(),
              let data = defaults.data(forKey: SharedScreenTime.WidgetKeys.snapshotV1) else {
            return 0
        }
        // Swallow decode failure on purpose — a corrupt snapshot should
        // not block the activity from rendering. Falling back to the
        // default tier color is the correct UX.
        return (try? JSONDecoder().decode(WidgetSnapshot.self, from: data))?.consecutiveStreak ?? 0
    }
}

// MARK: - StreakTiers color helper (parity with mobile `StreakTiers.color(for:)`)

extension StreakTiers {
    /// Returns the tier color for the supplied streak length. Mirrors
    /// the helper expected by the briefing — picks the highest tier
    /// whose threshold is ≤ `streak`, defaults to the default tier
    /// color when below the first threshold (< 3 days).
    static func color(for streak: Int) -> Color {
        if streak < (StreakTiers.all.first?.threshold ?? Int.max) {
            return Color(hex: StreakTiers.defaultColorHex)
        }
        for tier in StreakTiers.all.reversed() {
            if streak >= tier.threshold {
                return tier.color
            }
        }
        return Color(hex: StreakTiers.defaultColorHex)
    }
}
