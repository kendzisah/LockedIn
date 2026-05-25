//
//  AppNotifications.swift
//  LockedIn
//
//  In-process cross-feature `NotificationCenter` channels. Used for very
//  lightweight one-shot signals where wiring a callback through the
//  navigation tree would be awkward.
//

import Foundation

extension Notification.Name {
    /// Post to ask `MissionsState` to regenerate today's set. Fired when the
    /// user changes their primary goal or weaknesses in Settings.
    public static let lockedInRegenerateMissions = Notification.Name(
        "com.lockedin.regenerate-missions"
    )
}
