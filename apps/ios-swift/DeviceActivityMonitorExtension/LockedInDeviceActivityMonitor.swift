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

        // Manual session → always shield. The outcome is logged AFTER the apply
        // so a silent no-op (missing/undecodable selection, zero tokens) shows
        // up as "no_selection" in the diagnostics instead of a false "shield".
        if name == SharedScreenTime.activityName {
            let applied = applyShieldFromSavedSelection()
            logEvent(phase: "start", activity: name, outcome: applied ? "shield" : "no_selection")
            return
        }

        guard name.hasPrefix(SharedScreenTime.scheduledActivityPrefix) else { return }

        // Recurring sessions use a single DAILY schedule, so this fires every
        // day — only shield on a selected weekday (one-offs have empty weekdays
        // and always shield). The weekday is evaluated against the DERIVED gate
        // date, not `now`: a callback delivered slightly across midnight (e.g.
        // the OS wakes us at 23:59:58 for a 00:00 start) would otherwise read
        // the wrong weekday and skip/fire incorrectly.
        if let meta = scheduledMeta(for: name), !meta.weekdays.isEmpty {
            let gate = derivedGateDate(meta: meta, phase: .start, now: Date())
            if !meta.weekdays.contains(Calendar.current.component(.weekday, from: gate)) {
                logEvent(phase: "start", activity: name, outcome: "skip_weekday")
                return
            }
        }

        let applied = applyShieldFromSavedSelection()
        logEvent(phase: "start", activity: name, outcome: applied ? "shield" : "no_selection")
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        let name = activity.rawValue
        let now = Date()

        if name == SharedScreenTime.activityName {
            // A FUTURE manual end timestamp means the shield is currently OWNED
            // by a manual session — either a newer session started after the
            // monitor this callback belongs to was stopped (stale async stop
            // callback), or an in-progress break registered a resume monitor
            // whose fixed end is still ahead. Clearing here would wipe the
            // shield + timestamp out from under that live session. Contract C3.
            // This is the ONE caller that tolerates a slack — its own
            // boundary-aligned end can arrive slightly before the timestamp
            // (see `manualSessionActive`).
            if manualSessionActive(slackMs: Self.manualOwnEndSlackMs) {
                logEvent(phase: "end", activity: name, outcome: "manual_skip_active")
                return
            }
            // The manual session is genuinely over (timestamp past/absent), but
            // a scheduled window is live RIGHT NOW → the scheduled session owns
            // the shield. Drop the manual timestamp, keep the shield up.
            if anotherScheduledWindowActive(now: now, excluding: nil) {
                logEvent(phase: "end", activity: name, outcome: "manual_keep_scheduled")
                SharedScreenTime.sharedDefaults()?.removeObject(
                    forKey: SharedScreenTime.Keys.sessionEndTimestamp
                )
                return
            }
            logEvent(phase: "end", activity: name, outcome: "manual")
            clearShield(removeManualTimestamp: true)
            return
        }

        guard name.hasPrefix(SharedScreenTime.scheduledActivityPrefix) else { return }

        // Daily schedule fires every day — only credit/clear on a day this
        // session actually ran (else we'd queue a bogus completion / EXP).
        // Evaluated against the DERIVED gate date so an end callback delayed
        // across midnight (e.g. a 23:00–23:59 window whose end lands at 00:01)
        // still credits/clears under the day the window actually ran on.
        if let meta = scheduledMeta(for: name), !meta.weekdays.isEmpty {
            let gate = derivedGateDate(meta: meta, phase: .end, now: now)
            if !meta.weekdays.contains(Calendar.current.component(.weekday, from: gate)) {
                logEvent(phase: "end", activity: name, outcome: "skip_weekday")
                // No credit on a non-selected day — but still release the
                // shield when nothing else owns it. An app-side edit that
                // removed TODAY from the weekdays mid-window stops the live
                // monitor, and this stop-fired end (reading the rewritten
                // meta) is the LAST callback that window will ever get:
                // returning without the clear would strand the shield the
                // live window applied. On a genuinely idle skip day the
                // shield is already down and the clear is a no-op.
                if !manualSessionActive(), !anotherScheduledWindowActive(now: now, excluding: name) {
                    clearShield(removeManualTimestamp: false)
                }
                return
            }
        }

        // Back-to-back windows: is a DIFFERENT scheduled window live right now?
        // If so this end must NOT un-shield — the next window owns the shield.
        let handoff = anotherScheduledWindowActive(now: now, excluding: name)
        logEvent(phase: "end", activity: name, outcome: handoff ? "record_handoff" : "record")

        // A scheduled block ended. Record it for the app to credit on next open
        // — the completion is recorded regardless of the handoff.
        let record = recordScheduledCompletion(activityName: name)

        if manualSessionActive() {
            // A manual session's fail-safe timestamp is in the future — don't
            // un-block apps out from under it. Never wipe the manual timestamp.
        } else if handoff {
            // Skip the clear AND defensively re-apply: the next window's own
            // `intervalDidStart` can race this callback (boundary callbacks are
            // not ordered) or be dropped entirely, and a re-apply is idempotent.
            applyShieldFromSavedSelection()
        } else {
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

    /// Which interval boundary a callback belongs to — start (shield goes up)
    /// or end (shield comes down + completion recorded).
    private enum IntervalPhase { case start, end }

    /// The calendar date this interval boundary ACTUALLY belongs to.
    ///
    /// Interval callbacks are not delivered exactly at the boundary instant —
    /// the OS can wake the extension a little early or (more commonly) late.
    /// When the boundary sits near midnight, `Calendar.component(.weekday,
    /// from: now)` reads the WRONG day: an end for a 23:00–23:59 window
    /// delivered at 00:01 gates against tomorrow's weekday (skipping the credit
    /// and stranding the shield), and a start for a 00:00 window delivered at
    /// 23:59:58 gates against yesterday's.
    ///
    /// With the window's minutes-of-day from the meta we can reconstruct the
    /// candidate boundary instants and pick the day whose instant is NEAREST
    /// `now`: today vs yesterday for an end (late delivery), today vs tomorrow
    /// for a start (early delivery). Metas persisted by older builds carry no
    /// window times (nil) → fall back to the legacy `now`-based gating.
    private func derivedGateDate(meta: ScheduledActivityMeta, phase: IntervalPhase, now: Date) -> Date {
        let minutesOfDay: Int? = (phase == .start) ? meta.startMinutesOfDay : meta.endMinutesOfDay
        guard let minutesOfDay else { return now }

        let cal = Calendar.current
        guard let todayInstant = cal.date(
            bySettingHour: minutesOfDay / 60, minute: minutesOfDay % 60, second: 0, of: now
        ) else { return now }
        // End callbacks arrive LATE (boundary was today or yesterday); start
        // callbacks can arrive EARLY (boundary is today or tomorrow).
        let dayOffset = (phase == .end) ? -1 : 1
        guard let otherInstant = cal.date(byAdding: .day, value: dayOffset, to: todayInstant) else {
            return todayInstant
        }
        return abs(todayInstant.timeIntervalSince(now)) <= abs(otherInstant.timeIntervalSince(now))
            ? todayInstant
            : otherInstant
    }

    /// True when a scheduled window OTHER than `excluding` contains `now` —
    /// i.e. back-to-back (or boundary-racing) scheduled sessions where this
    /// callback must not take the shield down because the other window still
    /// owns it. Scans the App-Group activity map; entries without window times
    /// (older builds) can't be proven live and are treated as inactive — when
    /// in doubt we prefer un-blocking over a stuck shield.
    private func anotherScheduledWindowActive(now: Date, excluding excludedActivity: String?) -> Bool {
        guard let data = SharedScreenTime.sharedDefaults()?.data(forKey: SharedScreenTime.Keys.scheduledActivityMap),
              let map = try? JSONDecoder().decode([String: ScheduledActivityMeta].self, from: data)
        else { return false }

        let cal = Calendar.current
        for (activityName, meta) in map {
            if activityName == excludedActivity { continue }
            guard let startMin = meta.startMinutesOfDay, let endMin = meta.endMinutesOfDay else { continue }
            // Recurring windows only count on a selected weekday. Windows never
            // cross midnight (validated in the editor), so gating against
            // `now`'s own day is exact here.
            if !meta.weekdays.isEmpty {
                if !meta.weekdays.contains(cal.component(.weekday, from: now)) { continue }
            } else {
                // One-off: its DeviceActivity schedule is pinned to ONE concrete
                // date, so only that date counts — a lingering entry (the map is
                // only pruned on a foreground resync) must not read as live on
                // every later day whose time-of-day matches, which would keep
                // the shield up on a false handoff with no end callback left to
                // clear it. Date-less entries (older builds) can't be proven
                // live and are treated as inactive — prefer un-blocking.
                guard meta.occurrenceYMD == ScheduledCompletionRecord.localYMD(now) else { continue }
            }
            guard let start = cal.date(bySettingHour: startMin / 60, minute: startMin % 60, second: 0, of: now),
                  let end = cal.date(bySettingHour: endMin / 60, minute: endMin % 60, second: 0, of: now)
            else { continue }
            if now >= start, now < end { return true }
        }
        return false
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

    /// Apply the shield from the persisted App-Group selection. Returns whether
    /// a shield was ACTUALLY written: `false` when the selection is missing,
    /// undecodable, or contains zero app + web tokens (the shared applier
    /// deliberately no-ops on an empty allowlist rather than locking down the
    /// device). Callers log "shield" vs "no_selection" from this so the
    /// diagnostics never claim success for a silent no-op.
    @discardableResult
    private func applyShieldFromSavedSelection() -> Bool {
        guard let data = SharedScreenTime.sharedDefaults()?
                .data(forKey: SharedScreenTime.Keys.selection),
              let selection = try? PropertyListDecoder()
                .decode(FamilyActivitySelection.self, from: data)
        else { return false }

        // Single-store shield (app tokens clamped to 50, broad blocking via
        // category tokens). Must mirror the main app's apply exactly, hence
        // the shared helper.
        return SharedShieldApplier.apply(selection)
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

    /// The 2-minute tolerance the MANUAL activity's own `intervalDidEnd`
    /// applies against the fail-safe timestamp — see `manualSessionActive`.
    private static let manualOwnEndSlackMs: Double = 120_000

    /// True while a manual lock-in session's fail-safe end timestamp is still in
    /// the future — used so an interval ending mid-manual-session does not
    /// prematurely un-block apps.
    ///
    /// `slackMs` exists for exactly ONE caller: the manual activity's OWN
    /// `intervalDidEnd`. Its monitor boundary and the timestamp are set from
    /// the same instant (`ScreenTimeModule.beginSession`), and the OS can
    /// deliver the end callback slightly early — plus schedule-boundary
    /// rounding can land it under the seconds-precision timestamp. A
    /// zero-tolerance check there would make that boundary-aligned end skip
    /// (`manual_skip_active`) its OWN un-shield — the non-repeating monitor's
    /// only callback — stranding the shield until the next app open. The
    /// states that caller's guard protects (a break's fixed end, a
    /// freshly-started session stomped by a stale stop callback) keep the
    /// timestamp comfortably past the slack: `ScreenTimeModule` floors the
    /// fail-safe write so even a short post-break remainder can't fall inside
    /// the tolerance and get its fresh shield wiped.
    ///
    /// SCHEDULED callers MUST pass no slack (the default, strict compare):
    /// for them the timestamp belongs to an UNRELATED live manual session,
    /// and subtracting two minutes from its protection would let a scheduled
    /// window's end callback un-shield that session's final two minutes.
    private func manualSessionActive(slackMs: Double = 0) -> Bool {
        guard let endMs = SharedScreenTime.sharedDefaults()?
            .object(forKey: SharedScreenTime.Keys.sessionEndTimestamp) as? Double
        else { return false }
        return endMs > Date().timeIntervalSince1970 * 1000 + slackMs
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
        // Date the occurrence id from the DERIVED gate date — the day the
        // window actually ran — not the delivery time. An end callback
        // drifting past midnight (23:59 window end delivered at 00:01) would
        // otherwise mint TOMORROW's occurrence id: un-deduplicable against
        // the app-side credited/poisoned sets (double credit for a session
        // already credited in-app) and colliding with tomorrow's real
        // completion (which the drain would then silently skip). `endedAtMs`
        // stays the real delivery time for attribution.
        let record = ScheduledCompletionRecord(
            occurrenceId: ScheduledCompletionRecord.makeOccurrenceId(
                sessionId: meta.sessionId,
                endDate: derivedGateDate(meta: meta, phase: .end, now: now)
            ),
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
        //
        // Duplicates are same-id records minted within minutes of each other
        // (a doubled boundary callback). A same-id record minted HOURS apart
        // is not a duplicate — occurrence ids are only date-scoped, so a
        // window edited mid-run to re-run later the SAME day legitimately
        // mints the id twice (the stop-fired record, then the re-run's real
        // completion). Dropping the second would strand the re-run
        // uncreditable: the app's drain kills the first with a one-shot
        // poison and needs the second in the queue to credit. The drain's
        // credited-set dedupe still guarantees at most one credit per id.
        let duplicateWindowMs: Double = 5 * 60 * 1000
        guard !queue.contains(where: {
            $0.occurrenceId == record.occurrenceId
                && abs($0.endedAtMs - record.endedAtMs) < duplicateWindowMs
        }) else { return record }
        queue.append(record)
        // Bound the queue if the app is never opened.
        if queue.count > 50 { queue = Array(queue.suffix(50)) }

        if let encoded = try? JSONEncoder().encode(queue) {
            shared?.set(encoded, forKey: SharedScreenTime.Keys.pendingScheduledCompletions)
        }
        return record
    }
}
