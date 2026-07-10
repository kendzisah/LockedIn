import Foundation
#if canImport(ManagedSettings) && canImport(FamilyControls)
import ManagedSettings
import FamilyControls
#endif

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

    /// iOS silently caps `shield.applications` / `shield.webDomains` at 50
    /// tokens per ManagedSettingsStore — tokens beyond 50 on one store are
    /// arbitrarily dropped (Set order!), so which apps stay unblocked is
    /// random. Selections are therefore SHARDED across multiple named stores.
    public static let maxTokensPerStore = 50

    /// Number of shard stores the app + extension apply AND clear. 8 shards
    /// × 50 tokens = 400 individually-blockable apps, far beyond realistic
    /// selections. Clearing a never-used named store is a harmless no-op, so
    /// the clear path always sweeps all shards.
    public static let shieldShardCount = 8

    /// Shard store names. Shard 0 keeps the legacy un-suffixed name so
    /// shields applied by older builds are still cleared by new builds.
    public static func shieldStoreName(shard: Int) -> String {
        shard == 0 ? managedSettingsStoreName : "\(managedSettingsStoreName).\(shard)"
    }

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

        /// Diagnostics breadcrumb: `"<epochMs>|<activityName>"` written by the
        /// DAM extension whenever `intervalDidStart` / `intervalDidEnd` actually
        /// fires. The main app logs these on launch to confirm (on a physical
        /// device) whether the OS is waking the extension for scheduled windows
        /// — the crux of the "background blocking never engages" investigation.
        public static let damLastStart = "@lockedin/dam_last_start"
        public static let damLastEnd = "@lockedin/dam_last_end"
        /// Capped JSON array of `"<epochMs>|<start|end>|<outcome>|<activity>"`
        /// strings the extension appends on every interval callback. Lets the
        /// in-app diagnostics show whether a *background* `intervalDidStart`
        /// fired at the scheduled time (vs only on a foreground re-register) and
        /// whether the shield was applied or weekday-skipped.
        public static let damEventLog = "@lockedin/dam_event_log"
        /// Append-only ledger of every scheduled DeviceActivity name ever
        /// registered. `stopAllScheduled` stops the union of this + the live map,
        /// so a corrupted/cleared map can't orphan previously-registered
        /// activities (e.g. old per-weekday names from a prior app version).
        public static let scheduledActivityLedger = "@lockedin/scheduled_activity_ledger"
        /// Last scheduled-registration outcome summary the app writes after a
        /// resync — e.g. "0 failed" or "1 failed: <reason>". Surfaced in the
        /// in-app diagnostics so a dropped window (rejected `startMonitoring`)
        /// is visible instead of silently absent.
        public static let scheduledRegistrationStatus = "@lockedin/scheduled_registration_status"
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

#if canImport(ManagedSettings) && canImport(FamilyControls)
/// Sharded shield application, shared verbatim by the main app's
/// `ScreenTimeModule` and the DAM extension so the two processes can never
/// disagree about how tokens map onto stores.
///
/// Why sharding exists: iOS caps each ManagedSettingsStore's
/// `shield.applications` (and `shield.webDomains`) at 50 tokens. Writing more
/// does NOT error — iOS keeps an arbitrary 50 (token sets are unordered) and
/// silently ignores the rest, so a 78-app selection left random apps
/// unblocked. Splitting tokens into ≤50-token chunks across multiple named
/// stores lifts the effective cap to `shieldShardCount × 50`.
@available(iOS 16.0, *)
public enum SharedShieldApplier {

    /// All shard stores, shard 0 (legacy name) first.
    public static func shardStores() -> [ManagedSettingsStore] {
        (0..<SharedScreenTime.shieldShardCount).map {
            ManagedSettingsStore(named: .init(SharedScreenTime.shieldStoreName(shard: $0)))
        }
    }

    /// Apply `selection` across the shard stores. Application and web-domain
    /// tokens are chunked into groups of ≤`maxTokensPerStore`; category
    /// policies are single values and live on shard 0. Unused shards are
    /// explicitly nil-ed so a shrinking selection can't leave stale shields.
    public static func apply(_ selection: FamilyActivitySelection) {
        let appChunks = chunk(Array(selection.applicationTokens))
        let webChunks = chunk(Array(selection.webDomainTokens))
        for (i, store) in shardStores().enumerated() {
            let apps: Set<ApplicationToken> = i < appChunks.count ? Set(appChunks[i]) : []
            let webs: Set<WebDomainToken> = i < webChunks.count ? Set(webChunks[i]) : []
            store.shield.applications = apps.isEmpty ? nil : apps
            store.shield.webDomains = webs.isEmpty ? nil : webs
            if i == 0 {
                store.shield.applicationCategories = selection.categoryTokens.isEmpty
                    ? nil
                    : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
                store.shield.webDomainCategories = selection.categoryTokens.isEmpty
                    ? nil
                    : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
            } else {
                store.shield.applicationCategories = nil
                store.shield.webDomainCategories = nil
            }
        }
    }

    /// Clear every shard store. Always sweeps all `shieldShardCount` shards —
    /// clearing a store that was never written is a no-op, and sweeping all of
    /// them guarantees no shard orphaned by an older build stays shielding.
    public static func clearAll() {
        for store in shardStores() {
            store.shield.applications = nil
            store.shield.applicationCategories = nil
            store.shield.webDomains = nil
            store.shield.webDomainCategories = nil
        }
    }

    private static func chunk<T>(_ items: [T]) -> [[T]] {
        guard !items.isEmpty else { return [] }
        let size = SharedScreenTime.maxTokensPerStore
        return stride(from: 0, to: items.count, by: size).map {
            Array(items[$0..<min($0 + size, items.count)])
        }
    }
}
#endif
