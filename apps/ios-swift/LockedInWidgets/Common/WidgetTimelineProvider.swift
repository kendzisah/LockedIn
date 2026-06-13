//
//  WidgetTimelineProvider.swift
//  LockedInWidgets
//
//  Single `TimelineProvider` shared by the StreakWidget, TodayWidget, and
//  StreakComplication. Reads `WidgetSnapshot` from the App Group
//  `UserDefaults` suite via the well-known `WidgetKeys.snapshotV1` key and
//  feeds a `WidgetSnapshotEntry` into the widget views.
//
//  Refresh policy: a single entry with `.after(now + 15min)` reload — Apple
//  caps timeline budget anyway, and the main app calls
//  `WidgetCenter.shared.reloadAllTimelines()` whenever the publisher writes
//  a fresh snapshot, so the 15-minute floor is just a stale-state catch.
//
//  No catching here is silent: when the App Group store is unreachable or
//  the snapshot is missing, we return the same placeholder we'd render on
//  install, which is the documented widget behavior for "no data yet".
//

import Foundation
import WidgetKit

/// One frame of widget state. `snapshot` is the canonical model; `date` is
/// what WidgetKit uses to schedule rendering.
public struct WidgetSnapshotEntry: TimelineEntry {
    public let date: Date
    public let snapshot: WidgetSnapshot

    public init(date: Date, snapshot: WidgetSnapshot) {
        self.date = date
        self.snapshot = snapshot
    }
}

/// Reloads every 15 minutes; the main app force-reloads via
/// `WidgetCenter.shared.reloadAllTimelines()` when data changes.
struct WidgetTimelineProvider: TimelineProvider {
    typealias Entry = WidgetSnapshotEntry

    /// Demo content shown in the gallery and during widget rehearsals.
    static let placeholderSnapshot = WidgetSnapshot(
        consecutiveStreak: 7,
        dailyFocusedMinutes: 45,
        dailyGoalMinutes: 90,
        dailyGoalMet: false,
        lifetimeLongestStreak: 12,
        currentSessionEndsAtMs: nil,
        rankTierId: "rising",
        nextMissionTitle: "Lock in 30 minutes",
        todayMissionsCompleted: 1,
        todayMissionsTotal: 3,
        todayXpEarned: 25,
        lifetimeFocusedMinutes: 4_320,
        publishedAtMs: Date().timeIntervalSince1970 * 1000
    )

    func placeholder(in _: Context) -> WidgetSnapshotEntry {
        WidgetSnapshotEntry(date: Date(), snapshot: Self.placeholderSnapshot)
    }

    func getSnapshot(in _: Context, completion: @escaping (WidgetSnapshotEntry) -> Void) {
        let snapshot = readSnapshot() ?? Self.placeholderSnapshot
        completion(WidgetSnapshotEntry(date: Date(), snapshot: snapshot))
    }

    func getTimeline(in _: Context, completion: @escaping (Timeline<WidgetSnapshotEntry>) -> Void) {
        let now = Date()
        let snapshot = readSnapshot() ?? Self.placeholderSnapshot
        let entry = WidgetSnapshotEntry(date: now, snapshot: snapshot)

        // If a session is in-flight, schedule the next reload right at the
        // session's natural end (+1s grace). Without this the countdown
        // ticks to 0:00 and stays there forever — even after the session
        // is technically over — because the snapshot's
        // `currentSessionEndsAtMs` only clears the next time the app runs.
        // The `activeSessionEndDate` helper in the widget views treats a
        // past end as "no active session", so after this reload fires we
        // revert to the streak view automatically.
        let nextRefresh: Date = {
            if let ms = snapshot.currentSessionEndsAtMs, ms > 0 {
                let end = Date(timeIntervalSince1970: ms / 1000.0)
                if end > now {
                    return end.addingTimeInterval(1)
                }
            }
            // 15-minute reload floor for the idle case. The main app's
            // publisher triggers a `reloadAllTimelines()` whenever data
            // actually changes — this only covers the "app hasn't run in
            // a while" case.
            return now.addingTimeInterval(15 * 60)
        }()
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }

    // MARK: - App Group read

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        return decoder
    }()

    private func readSnapshot() -> WidgetSnapshot? {
        guard let defaults = SharedScreenTime.sharedDefaults(),
              let data = defaults.data(forKey: SharedScreenTime.WidgetKeys.snapshotV1)
        else {
            return nil
        }
        // Decode errors surface as nil — we fall back to the placeholder so
        // the widget never renders a blank tile. The publisher captures
        // encode failures on the write side via AnalyticsService.
        return try? Self.decoder.decode(WidgetSnapshot.self, from: data)
    }
}
