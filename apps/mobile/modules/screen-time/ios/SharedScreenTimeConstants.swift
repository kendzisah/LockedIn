import Foundation

/// Constants shared between the main app's ScreenTimeModule and the
/// DeviceActivityMonitor extension. Keeping them in a single file avoids
/// drift between the two processes.
enum SharedScreenTime {
    /// App Group used to share UserDefaults between the main app and the
    /// DeviceActivityMonitor extension. Must match the entitlement on both
    /// targets. Registered via Apple Developer portal / automatic signing.
    static let appGroupId = "group.com.flocktechnologies.lockedin"

    /// Named ManagedSettingsStore. Any process signed by the same team with
    /// FamilyControls entitlement can reference the same store by name, so
    /// the extension's un-shield action takes effect system-wide.
    static let managedSettingsStoreName = "lockedIn"

    /// DeviceActivity activity name. Passed to DeviceActivityCenter.startMonitoring
    /// in the main app and matched against in the extension's interval callbacks.
    static let activityName = "LockedInSession"

    /// UserDefaults keys (shared suite).
    enum Keys {
        static let selection = "com.lockedin.screentime.selection"
        /// Epoch-ms timestamp; used by the extension as a sanity check and
        /// by the main app's foreground sweep as a fail-safe.
        static let sessionEndTimestamp = "com.lockedin.screentime.sessionEndTimestamp"
    }

    static func sharedDefaults() -> UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }
}
