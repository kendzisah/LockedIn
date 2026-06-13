import Foundation

/// Constants shared between the main app's `ScreenTimeModule` and the
/// `DeviceActivityMonitor` extension. Keeping them in a single file avoids
/// drift between the two processes.
///
/// This file is compiled into BOTH the main app and the extension target
/// via the `Shared/` source group in `project.yml`.
public enum SharedScreenTime {
    /// App Group used to share UserDefaults between the main app and the
    /// DeviceActivityMonitor extension. Must match the entitlement on both
    /// targets. Registered via Apple Developer portal / automatic signing.
    public static let appGroupId = "group.com.flocktechnologies.lockedin"

    /// Named ManagedSettingsStore. Any process signed by the same team with
    /// FamilyControls entitlement can reference the same store by name, so
    /// the extension's un-shield action takes effect system-wide.
    public static let managedSettingsStoreName = "lockedIn"

    /// DeviceActivity activity name. Passed to DeviceActivityCenter.startMonitoring
    /// in the main app and matched against in the extension's interval callbacks.
    public static let activityName = "LockedInSession"

    /// Prefix for user-scheduled lock-in DeviceActivity names. The extension
    /// matches `activity.rawValue.hasPrefix(scheduledActivityPrefix)` to apply
    /// the shield on auto-start and clear + record a completion on auto-end.
    /// Distinct from `activityName` so the manual-session path is untouched.
    public static let scheduledActivityPrefix = "LockedInScheduled"

    /// UserDefaults keys (shared suite).
    public enum Keys {
        public static let selection = "com.lockedin.screentime.selection"
        /// Epoch-ms timestamp; used by the extension as a sanity check and
        /// by the main app's foreground sweep as a fail-safe.
        public static let sessionEndTimestamp = "com.lockedin.screentime.sessionEndTimestamp"
        /// JSON array of `ScheduledCompletionRecord`. The DAM extension appends
        /// one on a scheduled session's `intervalDidEnd`; the main app drains
        /// and credits them (EXP/missions) on next open.
        public static let pendingScheduledCompletions = "@lockedin/pending_scheduled_completions"
        /// JSON map `[activityName: ScheduledActivityMeta]`. Written by the app
        /// on every re-sync; read by the extension at `intervalDidEnd` to recover
        /// the session id + duration for the fired activity.
        public static let scheduledActivityMap = "@lockedin/scheduled_activity_map"
    }

    public static func sharedDefaults() -> UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    /// App Group keys consumed by the Widget extension and the Live Activity.
    ///
    /// Writers: `WidgetDataPublisher` (snapshot + lastRefresh); `SessionEngine`
    ///          via Live Activity setup (`liveActivitySessionId`).
    /// Readers: `LockedInWidgets` extension + AppIntentsKit intents — these
    ///          must NOT touch the main app's runtime state.
    public enum WidgetKeys {
        /// JSON-encoded `WidgetSnapshot`. Versioned so we can introduce a v2
        /// shape without race-corrupting old installs mid-launch.
        public static let snapshotV1 = "widget.snapshot.v1"

        /// Epoch milliseconds (Double) — last time the publisher wrote a
        /// snapshot. Used by widget timeline providers as a staleness signal.
        public static let lastRefresh = "widget.lastRefresh"

        /// UUID string of the currently-running ActivityKit activity, if any.
        /// Cleared by `SessionEngine.finish()` / `endEarly()`.
        public static let liveActivitySessionId = "live_activity.session_id"
    }
}
