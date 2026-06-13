//
//  LockedInShortcutsProvider.swift
//  LockedIn
//
//  Declares the canonical Siri voice phrases and Shortcuts gallery entries
//  for the four `AppIntent` types in `AppIntentsKit`. Lives in the main
//  app target (NOT the package) because `AppShortcutsProvider` must be
//  discoverable by the iOS Shortcuts indexer at the app bundle level.
//
//  Phrases use `\(.applicationName)` so the user can invoke them with
//  the localized display name (or any of the alternate names from
//  `INAlternateAppNames` in `Info.plist`).
//
//  Voice-discoverability gotcha: phrases must contain the app name token
//  somewhere, OR Siri won't surface them outside the Shortcuts app. We
//  satisfy that for every phrase here.
//

import AppIntents
import AppIntentsKit

@available(iOS 16.0, *)
public struct LockedInShortcutsProvider: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartLockInIntent(),
            phrases: [
                "Start a \(.applicationName) session",
                "Start a focus session in \(.applicationName)",
                "Lock me in with \(.applicationName)",
            ],
            shortTitle: "Start lock-in",
            systemImageName: "lock.fill"
        )

        AppShortcut(
            intent: EndLockInIntent(),
            phrases: [
                "End my \(.applicationName) session",
                "Stop my \(.applicationName) lock-in",
            ],
            shortTitle: "End lock-in",
            systemImageName: "lock.open.fill"
        )

        AppShortcut(
            intent: QueryStreakIntent(),
            phrases: [
                "What's my streak in \(.applicationName)",
                "How long is my \(.applicationName) streak",
            ],
            shortTitle: "Check streak",
            systemImageName: "flame.fill"
        )

        AppShortcut(
            intent: QueryTodayFocusIntent(),
            phrases: [
                "How much have I focused today in \(.applicationName)",
                "My focus time today in \(.applicationName)",
            ],
            shortTitle: "Today's focus",
            systemImageName: "clock.fill"
        )
    }
}
