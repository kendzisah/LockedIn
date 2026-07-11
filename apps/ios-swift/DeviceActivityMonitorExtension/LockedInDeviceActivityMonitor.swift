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

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        let name = activity.rawValue

        // Manual session → always shield.
        if name == SharedScreenTime.activityName {
            logEvent(phase: "start", activity: name, outcome: "manual")
            applyShieldFromSavedSelection()
            return
        }

        guard name.hasPrefix(SharedScreenTime.scheduledActivityPrefix) else { return }

        // Recurring sessions use a single DAILY schedule, so this fires every
        // day — only shield on a selected weekday (one-offs have empty weekdays
        // and always shield).
        if let meta = scheduledMeta(for: name), !meta.weekdays.isEmpty,
           !meta.weekdays.contains(Calendar.current.component(.weekday, from: Date())) {
            logEvent(phase: "start", activity: name, outcome: "skip_weekday")
            return
        }

        logEvent(phase: "start", activity: name, outcome: "shield")
        applyShieldFromSavedSelection()
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        let name = activity.rawValue

        if name == SharedScreenTime.activityName {
            logEvent(phase: "end", activity: name, outcome: "manual")
            clearShield(removeManualTimestamp: true)
            return
        }

        guard name.hasPrefix(SharedScreenTime.scheduledActivityPrefix) else { return }

        // Daily schedule fires every day — only credit/clear on a day this
        // session actually ran (else we'd queue a bogus completion / EXP).
        if let meta = scheduledMeta(for: name), !meta.weekdays.isEmpty,
           !meta.weekdays.contains(Calendar.current.component(.weekday, from: Date())) {
            logEvent(phase: "end", activity: name, outcome: "skip_weekday")
            return
        }

        logEvent(phase: "end", activity: name, outcome: "record")
        // A scheduled block ended. Record it for the app to credit on next open.
        let record = recordScheduledCompletion(activityName: name)

        // Clear the shield UNLESS a manual session is still running (its
        // fail-safe timestamp is in the future) — don't un-block apps out from
        // under an in-progress manual lock-in. Never wipe the manual timestamp.
        if !manualSessionActive() {
            clearShield(removeManualTimestamp: false)
        }

        // Best-effort guild-points credit — STRICTLY AFTER the un-shield above so
        // the network can never delay un-blocking. Bounded by a hard timeout; any
        // failure leaves the record queued for the app to credit on next open.
        // Guarantees scheduled sessions earn guild points even if the user never
        // reopens the app.
        if let record {
            GuildBackgroundStore.creditScheduledSessionInBackground(record: record)
        }
    }

    /// Look up the activity's metadata (session id, duration, selected weekdays)
    /// from the App-Group map the app writes on every re-sync.
    private func scheduledMeta(for activityName: String) -> ScheduledActivityMeta? {
        guard let data = SharedScreenTime.sharedDefaults()?.data(forKey: SharedScreenTime.Keys.scheduledActivityMap),
              let map = try? JSONDecoder().decode([String: ScheduledActivityMeta].self, from: data)
        else { return nil }
        return map[activityName]
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

    /// Record an interval callback for on-device diagnostics: updates the
    /// last-start/last-end stamps AND appends to a capped event history so the
    /// app can show whether a *background* `intervalDidStart` fired at the
    /// scheduled time (vs only on a foreground re-register) and whether the
    /// shield was applied or weekday-skipped. Cheap — within the callback budget.
    private func logEvent(phase: String, activity: String, outcome: String) {
        let shared = SharedScreenTime.sharedDefaults()
        let ms = Int(Date().timeIntervalSince1970 * 1000)
        let stamp = "\(ms)|\(activity)"
        shared?.set(stamp, forKey: phase == "start"
            ? SharedScreenTime.Keys.damLastStart
            : SharedScreenTime.Keys.damLastEnd)

        let short = activity.replacingOccurrences(
            of: "\(SharedScreenTime.scheduledActivityPrefix).", with: "")
        var log: [String] = []
        if let data = shared?.data(forKey: SharedScreenTime.Keys.damEventLog),
           let existing = try? JSONDecoder().decode([String].self, from: data) {
            log = existing
        }
        log.append("\(ms)|\(phase)|\(outcome)|\(short)")
        if log.count > 12 { log = Array(log.suffix(12)) }
        if let data = try? JSONEncoder().encode(log) {
            shared?.set(data, forKey: SharedScreenTime.Keys.damEventLog)
        }
    }

    private func applyShieldFromSavedSelection() {
        guard let data = SharedScreenTime.sharedDefaults()?
                .data(forKey: SharedScreenTime.Keys.selection),
              let selection = try? PropertyListDecoder()
                .decode(FamilyActivitySelection.self, from: data)
        else { return }

        // Single-store shield (app tokens clamped to 50, broad blocking via
        // category tokens). Must mirror the main app's apply exactly, hence
        // the shared helper.
        SharedShieldApplier.apply(selection)
    }

    private func clearShield(removeManualTimestamp: Bool) {
        // Sweeps the primary store + all legacy shard stores, including any
        // orphaned by older builds.
        SharedShieldApplier.clearAll()
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
    ///
    /// Returns the record for the just-ended occurrence (even when it was already
    /// present in the queue, e.g. a duplicate `intervalDidEnd`), so the caller can
    /// attempt the background guild push — that push has its own dedup via the
    /// guild-credited set, so a duplicate call is harmless. Returns nil only when
    /// the activity's metadata can't be recovered.
    @discardableResult
    private func recordScheduledCompletion(activityName: String) -> ScheduledCompletionRecord? {
        let shared = SharedScreenTime.sharedDefaults()

        // Recover session id + duration for this activity from the map the app wrote.
        guard let mapData = shared?.data(forKey: SharedScreenTime.Keys.scheduledActivityMap),
              let map = try? JSONDecoder().decode([String: ScheduledActivityMeta].self, from: mapData),
              let meta = map[activityName]
        else { return nil }

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
        // Dedupe within the queue (defensive against duplicate intervalDidEnd) —
        // but still return the record so the caller can (idempotently) push guild
        // points for this occurrence.
        guard !queue.contains(where: { $0.occurrenceId == record.occurrenceId }) else { return record }
        queue.append(record)
        // Bound the queue if the app is never opened.
        if queue.count > 50 { queue = Array(queue.suffix(50)) }

        if let encoded = try? JSONEncoder().encode(queue) {
            shared?.set(encoded, forKey: SharedScreenTime.Keys.pendingScheduledCompletions)
        }
        return record
    }
}
