//
//  QuickStartWidget.swift
//  LockedInWidgets — Agent 5 (Wave 2, Interactive Widget)
//
//  Single-purpose Home Screen widget: one large tap target that fires
//  `StartLockInIntent` with a 25-minute duration. Visual signature is the
//  LockedIn Discipline-Blue HUD panel — solid blue surface, white HUD
//  corner brackets, uppercase "LOCK IN" label.
//
//  The timeline reads `LockInAppGroupGate` (AppIntentsKit) so the widget
//  renders honestly against the SAME App Group state the intent gates on:
//   - Unsubscribed → non-interactive deep-link layout (default widget tap
//     opens the app, where the paywall lives).
//   - Session active → non-interactive "LOCKED IN" status (tap opens the
//     app to the running timer). The timeline schedules its next refresh
//     just after the session's known end so the tap target comes back
//     without waiting for an app-side reload.
//   - Otherwise → `widgetURL` deep link (`lockedin://quickstart`): the
//     system opens the containing app and delivers the URL to
//     `RootView.onOpenURL`, which runs the FULL in-process gate stack
//     (subscription / active session / Family Controls / allowlist) before
//     starting. NOT `Button(intent:)`: an intent performed in the
//     widget-extension process cannot reach the session machinery
//     (locator nil) and `ForegroundContinuableIntent` is unavailable in
//     app extensions — the tap would run headless and look dead.
//
//  `SubscriptionState.setSubscribed` reloads this widget's timeline (by
//  kind) on every entitlement flip, so layout switches are immediate.
//
//  Vibrant-render constraints honored (per fleet briefing):
//   - Background opacity ≥ 0.7 — Discipline Blue at 0.92.
//   - Border ≥ 2pt @ `Color.white.opacity(0.18)`.
//   - No GlowOrb, no LinearGradient surfaces.
//   - Tap target spans the full body — ≥ 44pt accessibility minimum.
//

import SwiftUI
import WidgetKit
import DesignKit
import AppIntentsKit

struct QuickStartWidget: Widget {
    /// Timeline-reload identity. Duplicated (as a string literal) in
    /// `SubscriptionState.quickStartWidgetKind` — the app target can't
    /// import this file. Keep the two in lockstep.
    let kind: String = "LockedInQuickStartWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickStartTimelineProvider()) { entry in
            QuickStartEntryView(entry: entry)
        }
        .configurationDisplayName("Quick Lock In")
        .description("Start a 25-minute lock-in with one tap.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - Timeline (gate-aware)

/// Entry state read from the App Group at timeline build. Both flags come
/// from `LockInAppGroupGate` so the widget can never render an interactive
/// start button the intent's own gates would refuse.
struct QuickStartTimelineEntry: TimelineEntry {
    let date: Date
    /// Entitlement mirror (`@lockedin/is_subscribed`). Missing key = false —
    /// the widget renders its non-interactive deep-link layout, matching the
    /// intent's fail-closed subscription gate.
    let isSubscribed: Bool
    /// True while any persisted session signal is live (execution block /
    /// break state / fail-safe timestamp / live scheduled auto-block
    /// window) — renders the LOCKED IN status.
    let isSessionActive: Bool
}

struct QuickStartTimelineProvider: TimelineProvider {
    typealias Entry = QuickStartTimelineEntry

    /// Gallery / placeholder shows the happy-path tap target — previews must
    /// sell the widget, not the paywall.
    func placeholder(in context: Context) -> QuickStartTimelineEntry {
        QuickStartTimelineEntry(date: Date(), isSubscribed: true, isSessionActive: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickStartTimelineEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
            return
        }
        completion(currentEntry(now: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickStartTimelineEntry>) -> Void) {
        let now = Date()
        let entry = currentEntry(now: now)

        // While a session is running, refresh just past its known end so the
        // widget flips back to the tap target on its own. Otherwise the
        // content only changes on entitlement/session transitions, which the
        // app pushes via `WidgetCenter.reloadTimelines(ofKind:)` — a 24h
        // fallback keeps a missed push from going stale forever.
        let next = LockInAppGroupGate.activeSessionEndDate(now: now)
            .map { $0.addingTimeInterval(1) }
            ?? now.addingTimeInterval(24 * 60 * 60)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func currentEntry(now: Date) -> QuickStartTimelineEntry {
        QuickStartTimelineEntry(
            date: now,
            isSubscribed: LockInAppGroupGate.isSubscribed,
            isSessionActive: LockInAppGroupGate.isSessionActive(now: now)
        )
    }
}

// MARK: - Entry view

struct QuickStartEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: QuickStartTimelineEntry

    var body: some View {
        Group {
            if entry.isSessionActive {
                // A session owns the shield — show status, not a start
                // button (the intent refuses "already locked in" anyway).
                // Default tap deep-links into the app's running timer.
                activeBody
            } else if !entry.isSubscribed {
                // Pro gate: non-interactive deep-link layout. Tapping opens
                // the app (paywall) — no start URL attached.
                bodyContent
            } else {
                // Subscribed + idle → quick-start deep link. `widgetURL` is
                // the supported widget→app handoff: the tap opens the app
                // and `RootView.onOpenURL` re-runs every start gate
                // in-process. (A `Button(intent:)` here performs in the
                // widget-extension process, which can neither reach the
                // session machinery nor foreground the app —
                // `ForegroundContinuableIntent` is
                // `@available(iOSApplicationExtension, unavailable)` — so
                // the tap did nothing visible.)
                bodyContent
                    .widgetURL(Self.quickStartURL)
            }
        }
        .containerBackground(for: .widget) {
            // Solid Discipline Blue at 0.92 alpha — vibrant-render safe
            // (≥ 0.7 per briefing) and stays on-palette.
            AppColors.primary.opacity(0.92)
        }
    }

    /// Visible content — extracted so iOS 17+ Button and the non-interactive
    /// fallbacks share identical layout. The iOS widget container supplies
    /// the curved chrome; no inner border or corner bracket overlay so we
    /// don't fight the system's continuous corner radius.
    private var bodyContent: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
    }

    /// LOCKED IN status — same framing treatment as `bodyContent`.
    private var activeBody: some View {
        activeContent
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .systemMedium:
            QuickStartMediumLayout()
        default:
            QuickStartSmallLayout()
        }
    }

    @ViewBuilder
    private var activeContent: some View {
        switch family {
        case .systemMedium:
            QuickStartActiveMediumLayout()
        default:
            QuickStartActiveSmallLayout()
        }
    }

    /// Quick-start deep link consumed by `RootView.onOpenURL`. The 25-minute
    /// duration matches the widget's visible label; the handler clamps to the
    /// intent floor and re-runs every start gate, so the URL is a REQUEST,
    /// not an authorization. Scheme registered in the app's Info.plist
    /// (`CFBundleURLTypes` → `lockedin`); host/query literals are duplicated
    /// in `RootView.handleQuickStartDeepLink` — keep in lockstep.
    fileprivate static let quickStartURL = URL(string: "lockedin://quickstart?minutes=25")
}

// MARK: - Small layout (1×1) — just LOCK IN + 25 MIN

private struct QuickStartSmallLayout: View {
    var body: some View {
        VStack(spacing: 6) {
            Text("LOCK IN")
                .font(.custom(FontFamily.headingBold.rawValue, size: 22))
                .tracking(1.6)
                .foregroundStyle(Color.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Text("25 MIN")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 12))
                .tracking(1.4)
                .foregroundStyle(Color.white.opacity(0.85))
                .monospacedDigit()
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
    }
}

// MARK: - Medium layout (2×1) — ornament + LOCK IN 25 MIN + subtitle

private struct QuickStartMediumLayout: View {
    var body: some View {
        HStack(spacing: 18) {
            // Ornament — diamond glyph, the LockedIn HUD focus mark.
            Image(systemName: "diamond.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.95))

            VStack(alignment: .leading, spacing: 6) {
                Text("LOCK IN")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 28))
                    .tracking(1.6)
                    .foregroundStyle(Color.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                HStack(spacing: 10) {
                    Text("25 MIN")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 12))
                        .tracking(1.4)
                        .foregroundStyle(Color.white.opacity(0.85))
                        .monospacedDigit()
                        .lineLimit(1)

                    // HUD-style separator dot
                    Circle()
                        .fill(Color.white.opacity(0.6))
                        .frame(width: 3, height: 3)

                    Text("INSTANT FOCUS")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                        .tracking(1.4)
                        .foregroundStyle(Color.white.opacity(0.7))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 22)
    }
}

// MARK: - Active-session layouts — LOCKED IN status (non-interactive)

/// 1×1 status shown while a session is running. Mirrors the idle layout's
/// typography so the flip reads as a state change, not a different widget.
private struct QuickStartActiveSmallLayout: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "lock.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.95))

            Text("LOCKED IN")
                .font(.custom(FontFamily.headingBold.rawValue, size: 18))
                .tracking(1.6)
                .foregroundStyle(Color.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Text("IN SESSION")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                .tracking(1.4)
                .foregroundStyle(Color.white.opacity(0.85))
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
    }
}

/// 2×1 status shown while a session is running.
private struct QuickStartActiveMediumLayout: View {
    var body: some View {
        HStack(spacing: 18) {
            // Ornament — locked padlock replaces the diamond focus mark.
            Image(systemName: "lock.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.95))

            VStack(alignment: .leading, spacing: 6) {
                Text("LOCKED IN")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 28))
                    .tracking(1.6)
                    .foregroundStyle(Color.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                HStack(spacing: 10) {
                    Text("IN SESSION")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 12))
                        .tracking(1.4)
                        .foregroundStyle(Color.white.opacity(0.85))
                        .lineLimit(1)

                    // HUD-style separator dot
                    Circle()
                        .fill(Color.white.opacity(0.6))
                        .frame(width: 3, height: 3)

                    Text("STAY FOCUSED")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                        .tracking(1.4)
                        .foregroundStyle(Color.white.opacity(0.7))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 22)
    }
}
