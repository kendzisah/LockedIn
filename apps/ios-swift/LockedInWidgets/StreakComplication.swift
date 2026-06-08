//
//  StreakComplication.swift
//  LockedInWidgets
//
//  Lock Screen widget — three accessory families:
//   - `.accessoryCircular`: flame icon + 2-digit streak count.
//   - `.accessoryRectangular`: flame icon + "DAY \(N)" + "Locked in".
//   - `.accessoryInline`: SF Symbol + "\(N) day streak" single-line text.
//
//  Lock Screen widgets render vibrant — they MUST stay legible on light,
//  dark, and photo wallpapers. We rely on `.containerBackground(.fill.
//  tertiary, for: .widget)` which lets iOS handle the blur+tint correctly
//  across wallpaper variants, and `.widgetAccentable()` on hero elements
//  so the system can boost contrast in vibrant mode.
//

import SwiftUI
import WidgetKit
import DesignKit

struct StreakComplication: Widget {
    let kind: String = "LockedInStreakComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WidgetTimelineProvider()) { entry in
            StreakComplicationEntryView(entry: entry)
        }
        .configurationDisplayName("Streak (Lock Screen)")
        .description("Your LockedIn streak on the Lock Screen.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
        .contentMarginsDisabled()
    }
}

struct StreakComplicationEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WidgetSnapshotEntry

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                CircularStreakView(snapshot: entry.snapshot)
            case .accessoryRectangular:
                RectangularStreakView(snapshot: entry.snapshot)
            case .accessoryInline:
                InlineStreakView(snapshot: entry.snapshot)
            default:
                // Unsupported on this family — fall back to circular so we
                // never crash if iOS adds a new accessory size.
                CircularStreakView(snapshot: entry.snapshot)
            }
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Circular

private struct CircularStreakView: View {
    let snapshot: WidgetSnapshot

    /// 2-digit cap — circular space is ~24×24 visible.
    private var displayStreak: String {
        let n = max(0, snapshot.consecutiveStreak)
        return n > 99 ? "99+" : "\(n)"
    }

    var body: some View {
        ZStack {
            VStack(spacing: 1) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 10, weight: .bold))
                    .widgetAccentable()
                Text(displayStreak)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                    .monospacedDigit()
                    .widgetAccentable()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Rectangular

private struct RectangularStreakView: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "flame.fill")
                .font(.system(size: 18, weight: .bold))
                .widgetAccentable()

            VStack(alignment: .leading, spacing: 1) {
                Text("DAY \(snapshot.consecutiveStreak)")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 15))
                    .monospacedDigit()
                    .widgetAccentable()
                Text("Locked in")
                    .font(.custom(FontFamily.body.rawValue, size: 11))
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Inline

private struct InlineStreakView: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        // Inline accessory is single-line; iOS strips most styling.
        // Image(systemName:) inline works inside Text.
        Text("\(Image(systemName: "flame.fill")) \(snapshot.consecutiveStreak) day streak")
    }
}
