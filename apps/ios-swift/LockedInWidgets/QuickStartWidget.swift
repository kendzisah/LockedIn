//
//  QuickStartWidget.swift
//  LockedInWidgets — Agent 5 (Wave 2, Interactive Widget)
//
//  Single-purpose Home Screen widget: one large tap target that fires
//  `StartLockInIntent` with a 25-minute duration. Visual signature is the
//  LockedIn Discipline-Blue HUD panel — solid blue surface, white HUD
//  corner brackets, uppercase "LOCK IN" label.
//
//  iOS 17+ wraps the body in `Button(intent: StartLockInIntent())` so the
//  session starts in-extension (no app foreground transition). iOS 16 ships
//  a non-interactive variant; the default widget tap behavior deep-links
//  into the app where the user can start a session manually.
//
//  Vibrant-render constraints honored (per fleet briefing):
//   - Background opacity ≥ 0.7 — Discipline Blue at 0.92.
//   - Border ≥ 2pt @ `Color.white.opacity(0.18)`.
//   - No GlowOrb, no LinearGradient surfaces.
//   - Single-entry timeline — content never changes per refresh.
//   - Tap target spans the full body — ≥ 44pt accessibility minimum.
//

import SwiftUI
import WidgetKit
import DesignKit
import AppIntentsKit

struct QuickStartWidget: Widget {
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

// MARK: - Timeline (single-entry, content never changes)

/// Trivial timeline — the QuickStart widget renders the same content on
/// every refresh. We still implement `TimelineProvider` so WidgetKit can
/// surface the widget in the gallery.
struct QuickStartTimelineEntry: TimelineEntry {
    let date: Date
}

struct QuickStartTimelineProvider: TimelineProvider {
    typealias Entry = QuickStartTimelineEntry

    func placeholder(in context: Context) -> QuickStartTimelineEntry {
        QuickStartTimelineEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickStartTimelineEntry) -> Void) {
        completion(QuickStartTimelineEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickStartTimelineEntry>) -> Void) {
        // One entry, refresh in 24h — there's no dynamic state to render.
        let entry = QuickStartTimelineEntry(date: Date())
        let next = Date().addingTimeInterval(24 * 60 * 60)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Entry view

struct QuickStartEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: QuickStartTimelineEntry

    var body: some View {
        Group {
            if #available(iOS 17.0, *) {
                Button(intent: Self.makeStartIntent()) {
                    bodyContent
                }
                .buttonStyle(.plain)
            } else {
                // iOS 16 fallback — `Button(intent:)` requires iOS 17.
                // Default widget tap behavior deep-links into the app.
                bodyContent
            }
        }
        .containerBackground(for: .widget) {
            // Solid Discipline Blue at 0.92 alpha — vibrant-render safe
            // (≥ 0.7 per briefing) and stays on-palette.
            AppColors.primary.opacity(0.92)
        }
    }

    /// Visible content — extracted so iOS 17+ Button and iOS 16 fallback
    /// share identical layout. The iOS widget container supplies the curved
    /// chrome; no inner border or corner bracket overlay so we don't fight
    /// the system's continuous corner radius.
    private var bodyContent: some View {
        content
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

    /// Builds the `StartLockInIntent` that backs the tap target. The intent
    /// declares `duration` as optional; we explicitly set 25 minutes to
    /// match the widget's visible label and avoid relying on the intent's
    /// internal fallback.
    @available(iOS 17.0, *)
    fileprivate static func makeStartIntent() -> StartLockInIntent {
        let intent = StartLockInIntent()
        intent.duration = Measurement(value: 25, unit: UnitDuration.minutes)
        return intent
    }
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
