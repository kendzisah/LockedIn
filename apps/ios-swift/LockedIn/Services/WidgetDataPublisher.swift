//
//  WidgetDataPublisher.swift
//  LockedIn
//
//  Single source of truth for cross-process state shared with the
//  `LockedInWidgets` extension. The main app calls `publish(...)` whenever
//  the user-visible numbers change (streak, focus minutes, active session,
//  next mission). The widget extension and App Intents read the encoded
//  `WidgetSnapshot` from the App Group `UserDefaults` suite — they never
//  touch main-app singletons.
//
//  Hook sites (wired later by Agent 3 — Widgets):
//   - `HomeState`: on changes to `consecutiveStreak`, `dailyFocusedMinutes`,
//     `dailyGoalMet`, `lifetimeLongestStreak`.
//   - `SessionEngine`: on session end (clears `currentSessionEndsAtMs`).
//   - `MissionsState`: on next mission change.
//
//  Design notes:
//   - No singleton state beyond `shared`. Every `publish()` call writes the
//     snapshot from its arguments — there is no in-memory cache that could
//     drift from the App Group store.
//   - Errors during encode are surfaced via
//     `AnalyticsService.shared.captureException` so we never silent-catch.
//

import Foundation
import WidgetKit

public final class WidgetDataPublisher {
    public static let shared = WidgetDataPublisher()

    /// JSON encoder reused across publishes. `JSONEncoder` is thread-safe
    /// for encoding when not mutated concurrently, and we don't mutate
    /// `outputFormatting` here.
    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        return encoder
    }()

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        return decoder
    }()

    private init() {}

    // MARK: - Publish

    /// Encode and persist a fresh `WidgetSnapshot` into the App Group
    /// `UserDefaults` suite, then ask WidgetKit to reload all timelines so
    /// any installed widgets pick up the new state on the next refresh
    /// pass (subject to OS-imposed timeline budget).
    public func publish(_ snapshot: WidgetSnapshot) {
        guard let defaults = SharedScreenTime.sharedDefaults() else {
            // App Group entitlement misconfigured — surface so we can fix
            // provisioning rather than silently produce stale widgets.
            let error = NSError(
                domain: "WidgetDataPublisher",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "App Group UserDefaults unavailable"]
            )
            Task { @MainActor in
                AnalyticsService.shared.captureException(
                    error,
                    properties: ["context": "widget_publish"]
                )
            }
            return
        }

        do {
            let data = try encoder.encode(snapshot)
            defaults.set(data, forKey: SharedScreenTime.WidgetKeys.snapshotV1)
            defaults.set(
                snapshot.publishedAtMs,
                forKey: SharedScreenTime.WidgetKeys.lastRefresh
            )
        } catch {
            Task { @MainActor in
                AnalyticsService.shared.captureException(
                    error,
                    properties: ["context": "widget_publish"]
                )
            }
            return
        }

        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: - Read

    /// Read the most recently published snapshot from the App Group store.
    /// Used by App Intents that want to answer questions ("what's my
    /// streak") without launching the main app.
    public func loadSnapshot() -> WidgetSnapshot? {
        guard let defaults = SharedScreenTime.sharedDefaults() else {
            return nil
        }
        guard let data = defaults.data(forKey: SharedScreenTime.WidgetKeys.snapshotV1) else {
            return nil
        }
        do {
            return try decoder.decode(WidgetSnapshot.self, from: data)
        } catch {
            Task { @MainActor in
                AnalyticsService.shared.captureException(
                    error,
                    properties: ["context": "widget_load_snapshot"]
                )
            }
            return nil
        }
    }
}
