import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

/// DeviceActivityMonitor extension. Runs in its own process; iOS wakes it at
/// the scheduled interval boundaries even when the main app has been killed.
///
/// Responsibilities:
/// - `intervalDidEnd`: primary un-shield. Guarantees apps get unblocked when
///   the Lock In session's scheduled time has elapsed, regardless of main app
///   state.
/// - `intervalDidStart`: defensive re-apply of the shield — the main app
///   already applied it synchronously, but this guards against the main app
///   being killed between calling `startMonitoring` and the shield actually
///   landing.
///
/// Extensions have tight CPU/time budgets per callback. Keep this minimal —
/// no network, no heavy work.
@available(iOS 16.0, *)
final class LockedInDeviceActivityMonitor: DeviceActivityMonitor {

    private lazy var store: ManagedSettingsStore = ManagedSettingsStore(
        named: .init(SharedScreenTime.managedSettingsStoreName)
    )

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        // Manual session OR any user-scheduled session → block apps. Both use
        // the same named ManagedSettingsStore, so applying twice is idempotent.
        if activity.rawValue == SharedScreenTime.activityName
            || activity.rawValue.hasPrefix(SharedScreenTime.scheduledActivityPrefix) {
            applyShieldFromSavedSelection()
        }
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)

        if activity.rawValue == SharedScreenTime.activityName {
            clearShield(removeManualTimestamp: true)
            return
        }

        guard activity.rawValue.hasPrefix(SharedScreenTime.scheduledActivityPrefix) else { return }

        // A scheduled block ended. Record it for the app to credit on next open.
        recordScheduledCompletion(activityName: activity.rawValue)

        // Clear the shield UNLESS a manual session is still running (its
        // fail-safe timestamp is in the future) — don't un-block apps out from
        // under an in-progress manual lock-in. Never wipe the manual timestamp.
        if !manualSessionActive() {
            clearShield(removeManualTimestamp: false)
        }
    }

    override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.eventDidReachThreshold(event, activity: activity)
    }

    override func intervalWillStartWarning(for activity: DeviceActivityName) {
        super.intervalWillStartWarning(for: activity)
    }

    override func intervalWillEndWarning(for activity: DeviceActivityName) {
        super.intervalWillEndWarning(for: activity)
    }

    override func eventWillReachThresholdWarning(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.eventWillReachThresholdWarning(event, activity: activity)
    }

    // MARK: - Private

    private func applyShieldFromSavedSelection() {
        guard let data = SharedScreenTime.sharedDefaults()?
                .data(forKey: SharedScreenTime.Keys.selection),
              let selection = try? PropertyListDecoder()
                .decode(FamilyActivitySelection.self, from: data)
        else { return }

        store.shield.applications = selection.applicationTokens.isEmpty
            ? nil : selection.applicationTokens
        store.shield.applicationCategories = selection.categoryTokens.isEmpty
            ? nil
            : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
        store.shield.webDomains = selection.webDomainTokens.isEmpty
            ? nil : selection.webDomainTokens
        store.shield.webDomainCategories = selection.categoryTokens.isEmpty
            ? nil
            : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
    }

    private func clearShield(removeManualTimestamp: Bool) {
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomains = nil
        store.shield.webDomainCategories = nil
        if removeManualTimestamp {
            SharedScreenTime.sharedDefaults()?.removeObject(
                forKey: SharedScreenTime.Keys.sessionEndTimestamp
            )
        }
    }

    /// True while a manual lock-in session's fail-safe end timestamp is still in
    /// the future — used so a scheduled interval ending mid-manual-session does
    /// not prematurely un-block apps.
    private func manualSessionActive() -> Bool {
        guard let endMs = SharedScreenTime.sharedDefaults()?
            .object(forKey: SharedScreenTime.Keys.sessionEndTimestamp) as? Double
        else { return false }
        return endMs > Date().timeIntervalSince1970 * 1000
    }

    /// Append a `ScheduledCompletionRecord` to the App-Group queue. The app
    /// drains + credits it (EXP/missions) on next open, deduped by occurrenceId.
    private func recordScheduledCompletion(activityName: String) {
        let shared = SharedScreenTime.sharedDefaults()

        // Recover session id + duration for this activity from the map the app wrote.
        guard let mapData = shared?.data(forKey: SharedScreenTime.Keys.scheduledActivityMap),
              let map = try? JSONDecoder().decode([String: ScheduledActivityMeta].self, from: mapData),
              let meta = map[activityName]
        else { return }

        let now = Date()
        let record = ScheduledCompletionRecord(
            occurrenceId: ScheduledCompletionRecord.makeOccurrenceId(sessionId: meta.sessionId, endDate: now),
            sessionId: meta.sessionId,
            durationMinutes: meta.durationMinutes,
            endedAtMs: now.timeIntervalSince1970 * 1000
        )

        var queue: [ScheduledCompletionRecord] = []
        if let data = shared?.data(forKey: SharedScreenTime.Keys.pendingScheduledCompletions),
           let existing = try? JSONDecoder().decode([ScheduledCompletionRecord].self, from: data) {
            queue = existing
        }
        // Dedupe within the queue (defensive against duplicate intervalDidEnd).
        guard !queue.contains(where: { $0.occurrenceId == record.occurrenceId }) else { return }
        queue.append(record)
        // Bound the queue if the app is never opened.
        if queue.count > 50 { queue = Array(queue.suffix(50)) }

        if let encoded = try? JSONEncoder().encode(queue) {
            shared?.set(encoded, forKey: SharedScreenTime.Keys.pendingScheduledCompletions)
        }
    }
}
