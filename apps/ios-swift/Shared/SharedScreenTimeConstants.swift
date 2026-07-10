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

    /// iOS caps the number of individual app tokens in a shield at 50 —
    /// CUMULATIVELY across all named ManagedSettingsStores, not per store
    /// (undocumented; confirmed iOS 16/17/17.2 —
    /// https://developer.apple.com/forums/thread/733361). Exceeding it voids
    /// the shield silently. This app therefore blocks with an ALLOWLIST model:
    /// `applicationCategories = .all(except: allowlist)` shields every app on
    /// the device except the user's picks, so there is no ceiling on how many
    /// apps get blocked. The 50-token cap now bounds only the ALLOWLIST (the
    /// `except:` set) — a user can keep at most 50 apps unblocked.
    public static let maxAllowlistTokens = 50

    /// Legacy shard store count. Older builds sharded shields across the
    /// stores `lockedIn`, `lockedIn.1` … `lockedIn.7`. Those extra stores no
    /// longer receive shields, but the apply/clear paths still SWEEP them so a
    /// shield written by a previously-installed build can't stay orphaned (and
    /// keep eating the cumulative 50-token budget) after an update. Apply
    /// itself writes only the primary `managedSettingsStoreName` store.
    public static let legacyShardStoreCount = 8

    /// Store names swept when clearing. Shard 0 is the primary (legacy
    /// un-suffixed) name; 1…7 are the retired shard stores.
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
/// Shield application, shared verbatim by the main app's `ScreenTimeModule`
/// and the DAM extension so the two processes can never disagree about how a
/// selection maps onto ManagedSettings.
///
/// iOS caps individual shield app tokens at 50, CUMULATIVELY across every
/// named ManagedSettingsStore (undocumented; confirmed iOS 16/17). Blocking
/// apps one-token-at-a-time therefore can't exceed 50. To block far more, we
/// invert the model: shield EVERY app via `.all(except: allowlist)` and treat
/// the user's selection as the ALLOWLIST of apps that stay open. The `except:`
/// allowlist is itself capped at 50, so we clamp it. A prior build sharded
/// blocked-app tokens across 8 stores believing the cap was per-store — it
/// isn't. See `SharedScreenTime.maxAllowlistTokens`.
@available(iOS 16.0, *)
public enum SharedShieldApplier {

    /// The one store shields are written to.
    public static func primaryStore() -> ManagedSettingsStore {
        ManagedSettingsStore(named: .init(SharedScreenTime.managedSettingsStoreName))
    }

    /// Primary store + retired legacy shard stores, swept when clearing.
    public static func allStores() -> [ManagedSettingsStore] {
        (0..<SharedScreenTime.legacyShardStoreCount).map {
            ManagedSettingsStore(named: .init(SharedScreenTime.shieldStoreName(shard: $0)))
        }
    }

    /// Apply the ALLOWLIST `selection` to the single primary store.
    ///
    /// - `applicationCategories = .all(except: allowlist)` shields every app on
    ///   the device except the allowlisted tokens — this is what blocks far
    ///   more than 50 apps. Web is inverted the same way. The allowlist is
    ///   clamped to `maxAllowlistTokens` (50); picks beyond 50 can't be
    ///   exempted by iOS, so they end up blocked (the caller warns the user).
    /// - `shield.applications` / `shield.webDomains` are nil'd — the `.all`
    ///   category policy already covers every app, so per-app tokens are
    ///   redundant.
    /// - SAFETY: an EMPTY allowlist is treated as "not configured" and applies
    ///   NO shield. `.all(except: [])` would otherwise lock down the entire
    ///   device — a catastrophic surprise for a user who starts a session
    ///   before choosing any allowed apps.
    /// - Legacy shard stores (`lockedIn.1` … `.7`) are cleared first so a stale
    ///   shield from an older build can't linger alongside the new shield.
    public static func apply(_ selection: FamilyActivitySelection) {
        // Retire any shields written by an older sharding build.
        for shard in 1..<SharedScreenTime.legacyShardStoreCount {
            let store = ManagedSettingsStore(named: .init(SharedScreenTime.shieldStoreName(shard: shard)))
            store.shield.applications = nil
            store.shield.applicationCategories = nil
            store.shield.webDomains = nil
            store.shield.webDomainCategories = nil
        }

        let store = primaryStore()
        let cap = SharedScreenTime.maxAllowlistTokens
        let allowedApps = Set(Array(selection.applicationTokens).prefix(cap))
        let allowedWebs = Set(Array(selection.webDomainTokens).prefix(cap))

        // No allowlist configured → do NOT lock down the whole device.
        guard !allowedApps.isEmpty || !allowedWebs.isEmpty else {
            store.shield.applications = nil
            store.shield.webDomains = nil
            store.shield.applicationCategories = nil
            store.shield.webDomainCategories = nil
            return
        }

        // Allowlist model: block EVERY app / website except the user's picks.
        store.shield.applications = nil
        store.shield.webDomains = nil
        store.shield.applicationCategories = .all(except: allowedApps)
        store.shield.webDomainCategories = .all(except: allowedWebs)
    }

    /// Clear the primary store and every legacy shard store. Clearing a store
    /// that was never written is a no-op, and sweeping all of them guarantees
    /// no shield orphaned by an older build stays active.
    public static func clearAll() {
        for store in allStores() {
            store.shield.applications = nil
            store.shield.applicationCategories = nil
            store.shield.webDomains = nil
            store.shield.webDomainCategories = nil
        }
    }
}
#endif
