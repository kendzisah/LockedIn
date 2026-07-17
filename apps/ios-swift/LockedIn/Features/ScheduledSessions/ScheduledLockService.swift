//
//  ScheduledLockService.swift
//  LockedIn — Scheduled Lock-In Sessions
//
//  Registers/removes the DeviceActivity schedules that auto-apply the shield at
//  each scheduled session's start (even with the app closed) and clear it at the
//  end. Wraps `DeviceActivityCenter` directly — NOT `ScreenTimeModule.beginSession`,
//  which shields immediately; scheduled sessions must not shield until their start.
//
//  The manual `"LockedInSession"` activity is never touched here.
//

import Foundation
import DeviceActivity

@MainActor
public final class ScheduledLockService {

    public static let shared = ScheduledLockService()
    private init() {}

    /// iOS caps simultaneously-monitored activities (~20). The manual session
    /// reserves one slot; keep a margin. A 7-day recurring session = 7 activities.
    private let maxScheduledActivities = 18

    /// Re-register every enabled+valid session's auto-block schedules from
    /// scratch (stop-all then re-add — simplest correct model). Returns true if
    /// at least one activity was registered.
    @discardableResult
    public func resyncAll(_ sessions: [ScheduledSession]) -> Bool {
        guard #available(iOS 16.0, *) else { return false }

        // Check authorization BEFORE tearing anything down. Auto-block requires
        // Family Controls authorization; if it isn't approved (e.g. a transient
        // `.notDetermined` read at cold launch), bail WITHOUT stopping monitors
        // or wiping the activity map — preserving the last good registration.
        // Wiping here previously killed background blocking on every cold launch
        // that raced the authorization status.
        guard ScreenTimeModule.shared.getAuthorizationStatus() == .approved else {
            return false
        }

        let now = Date()
        let cal = Calendar.current

        // Preserve a currently-active window's monitor — but ONLY if it's already
        // registered. Stopping an in-progress interval makes the extension fire
        // `intervalDidEnd` → `clearShield()` (un-blocking apps mid-session) and
        // queues a spurious completion the app then credits, killing the session.
        // A session created/enabled DURING its window isn't registered yet, so it
        // must still be registered below — else it never blocks at all.
        let previousMap: [String: ScheduledActivityMeta] = {
            guard let data = SharedScreenTime.sharedDefaults()?.data(forKey: SharedScreenTime.Keys.scheduledActivityMap),
                  let m = try? JSONDecoder().decode([String: ScheduledActivityMeta].self, from: data)
            else { return [:] }
            return m
        }()
        let alreadyRegistered = Set(previousMap.keys)
        let liveSession = sessions.first { $0.enabled && $0.isValid && $0.activeWindow(now: now) != nil }
        let liveName = liveSession.map { Self.scheduledActivityName(for: $0) }
        let preserveLive = liveName.map { alreadyRegistered.contains($0) } ?? false

        // Auth confirmed → rebuild everything, preserving only an ALREADY-registered
        // live window so its running monitor isn't stopped/re-created mid-session.
        stopAllScheduled(excluding: (preserveLive ? liveName : nil).map { Set([$0]) } ?? [])

        struct Candidate {
            let name: String
            let schedule: DeviceActivitySchedule
            let meta: ScheduledActivityMeta
            let when: Date
        }

        var candidates: [Candidate] = []

        for s in sessions where s.enabled && s.isValid {
            if preserveLive, s.id == liveSession?.id { continue }  // leave the running monitor untouched
            if s.isOneOff {
                if let live = s.activeWindow(now: now) {
                    // The one-off's window is LIVE RIGHT NOW but its monitor was
                    // never registered (this branch is only reachable when
                    // `preserveLive` didn't claim it — e.g. the setup banner's
                    // resync after a mid-window auth grant, the exact flow the
                    // un-registered-live-window fix added). `nextOccurrence` is
                    // strictly future, so pinning to it would arm a phantom
                    // monitor for the NEXT day instead of covering today's
                    // in-progress window — no window-end monitor today (shield
                    // stranded if the app dies) plus a bogus auto-block +
                    // full-duration completion tomorrow. Register the live
                    // REMAINDER as an absolute-dated non-repeating interval
                    // (same shape as the break-resume monitor); the ≥16-min
                    // clamp mirrors `beginSession` — short remainders overrun
                    // the OS backstop by design, the in-app end path un-shields
                    // at the real window end.
                    let comps: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
                    let monitorEnd = max(live.end, now.addingTimeInterval(16 * 60))
                    candidates.append(Candidate(
                        name: "\(SharedScreenTime.scheduledActivityPrefix).\(s.id).oneoff",
                        schedule: DeviceActivitySchedule(
                            intervalStart: cal.dateComponents(comps, from: now),
                            intervalEnd: cal.dateComponents(comps, from: monitorEnd),
                            repeats: false
                        ),
                        meta: ScheduledActivityMeta(
                            sessionId: s.id,
                            durationMinutes: s.durationMinutes,
                            startMinutesOfDay: s.startMinutesOfDay,
                            endMinutesOfDay: s.endMinutesOfDay,
                            occurrenceYMD: ScheduledCompletionRecord.localYMD(now)
                        ),
                        when: now
                    ))
                    continue
                }
                guard let next = s.nextOccurrence(after: now) else { continue }
                // Pin the one-off to the concrete weekday of its next occurrence
                // rather than a bare hour/minute. A fully-specified
                // weekday+hour+minute interval resolves unambiguously for the OS;
                // bare hour/minute is the least-specified form and the most prone
                // to `intervalDidStart` not firing reliably. The window cannot
                // cross midnight (validated), so start/end share a weekday.
                let oneOffWeekday = cal.component(.weekday, from: next)
                candidates.append(Candidate(
                    name: "\(SharedScreenTime.scheduledActivityPrefix).\(s.id).oneoff",
                    schedule: DeviceActivitySchedule(
                        intervalStart: Self.components(weekday: oneOffWeekday, hour: s.startHour, minute: s.startMinute),
                        intervalEnd: Self.components(weekday: oneOffWeekday, hour: s.endHour, minute: s.endMinute),
                        repeats: false
                    ),
                    // Window minutes-of-day let the extension derive the day a
                    // boundary callback belongs to (midnight drift) and detect
                    // back-to-back windows at `intervalDidEnd`. `occurrenceYMD`
                    // pins the one-off's liveness scans to its single concrete
                    // date — without it a lingering entry matches EVERY later
                    // day whose time-of-day fits.
                    meta: ScheduledActivityMeta(
                        sessionId: s.id,
                        durationMinutes: s.durationMinutes,
                        startMinutesOfDay: s.startMinutesOfDay,
                        endMinutesOfDay: s.endMinutesOfDay,
                        occurrenceYMD: ScheduledCompletionRecord.localYMD(next)
                    ),
                    when: next
                ))
            } else {
                // Register ONE *daily* schedule (hour/minute only, repeats:true)
                // rather than one per weekday. A plain daily schedule fires
                // `intervalDidStart` far more reliably in the background than
                // weekday-qualified schedules (which often only fire when the app
                // re-registers in the foreground). The extension filters to the
                // selected weekdays via `meta.weekdays`, so non-selected days are
                // skipped there. Also keeps us well under the activity cap.
                let when = s.nextOccurrence(after: now) ?? now
                candidates.append(Candidate(
                    name: "\(SharedScreenTime.scheduledActivityPrefix).\(s.id).daily",
                    schedule: DeviceActivitySchedule(
                        intervalStart: DateComponents(hour: s.startHour, minute: s.startMinute),
                        intervalEnd: DateComponents(hour: s.endHour, minute: s.endMinute),
                        repeats: true
                    ),
                    meta: ScheduledActivityMeta(
                        sessionId: s.id,
                        durationMinutes: s.durationMinutes,
                        weekdays: s.weekdays,
                        startMinutesOfDay: s.startMinutesOfDay,
                        endMinutesOfDay: s.endMinutesOfDay
                    ),
                    when: when
                ))
            }
        }

        candidates.sort { $0.when < $1.when }
        let dropped = max(0, candidates.count - maxScheduledActivities)
        let selected = Array(candidates.prefix(maxScheduledActivities))

        let center = DeviceActivityCenter()
        var map: [String: ScheduledActivityMeta] = [:]
        var failedCount = 0
        var lastFailureReason: String?

        for c in selected {
            var ok = false
            var startError: Error?
            do {
                try ObjCExceptionCatcher.execute {
                    do {
                        try center.startMonitoring(DeviceActivityName(c.name), during: c.schedule)
                        ok = true
                    } catch {
                        ok = false
                        startError = error
                    }
                }
            } catch {
                ok = false
                startError = error
            }
            if ok {
                map[c.name] = c.meta
            } else if let err = startError {
                failedCount += 1
                lastFailureReason = err.localizedDescription
                AnalyticsService.shared.captureException(err, properties: [
                    "context": "scheduled_activity_start",
                    "activity": c.name,
                ])
            }
        }

        // Keep the preserved live window's meta in the map (it was skipped above so
        // its running monitor stays untouched) so the extension can still recover
        // its session id + duration when its interval ends.
        //
        // WINDOW FIELDS COME FROM THE PRIOR REGISTRATION, not the (possibly
        // just-edited) session: a running DeviceActivity interval cannot be
        // re-pointed without stopping it, so the monitor still runs the
        // schedule it was REGISTERED with. An edit that kept the occurrence
        // live (same id + date) but moved the times would otherwise make the
        // extension's gates and its completion record describe a window the
        // monitor never ran — e.g. extending 9–10 to 9–12 mid-window leaves
        // the monitor ending at 10:00 while a session-derived meta would
        // credit a 180-minute duration for it. Weekdays DO come fresh from
        // the session so a weekday edit still gates future daily fires until
        // the post-window resync rebuilds everything.
        if preserveLive, let liveSession, let liveName {
            let prior = previousMap[liveName]
            map[liveName] = ScheduledActivityMeta(
                sessionId: liveSession.id,
                durationMinutes: prior?.durationMinutes ?? liveSession.durationMinutes,
                weekdays: liveSession.weekdays,
                startMinutesOfDay: prior?.startMinutesOfDay ?? liveSession.startMinutesOfDay,
                endMinutesOfDay: prior?.endMinutesOfDay ?? liveSession.endMinutesOfDay,
                // The preserved window is live NOW, so a one-off's single
                // occurrence date is today (recurring stays weekday-gated).
                occurrenceYMD: liveSession.isOneOff
                    ? ScheduledCompletionRecord.localYMD(now)
                    : nil
            )
        }

        // Surface registration outcome for the in-app diagnostics.
        let status: String = {
            if failedCount == 0 { return "\(map.count) ok" }
            return "\(map.count) ok · \(failedCount) failed: \(lastFailureReason ?? "unknown")"
        }()
        SharedScreenTime.sharedDefaults()?.set(status, forKey: SharedScreenTime.Keys.scheduledRegistrationStatus)

        // Persist the map (App Group) so the extension can recover session id +
        // duration when an interval ends.
        if !map.isEmpty, let data = try? JSONEncoder().encode(map) {
            SharedScreenTime.sharedDefaults()?.set(data, forKey: SharedScreenTime.Keys.scheduledActivityMap)
        } else {
            SharedScreenTime.sharedDefaults()?.removeObject(forKey: SharedScreenTime.Keys.scheduledActivityMap)
        }

        // Append the registered names to the cleanup ledger (bounded) so a later
        // corrupted/cleared map can still reach them in `stopAllScheduled`.
        if !map.isEmpty {
            var ledger = Set(Defaults.codable([String].self,
                                              SharedScreenTime.Keys.scheduledActivityLedger,
                                              scope: .appGroup) ?? [])
            ledger.formUnion(map.keys)
            Defaults.setCodable(Array(ledger.suffix(64)),
                                SharedScreenTime.Keys.scheduledActivityLedger,
                                scope: .appGroup)
        }

        if dropped > 0 {
            AnalyticsService.shared.track("scheduled_activity_cap_exceeded", properties: [
                "dropped": dropped,
                "registered": map.count,
            ])
        }

        return !map.isEmpty
    }

    /// Build `DateComponents` with weekday+time. (The memberwise initializer
    /// orders `weekday` after `hour`/`minute`, so set the properties directly.)
    private static func components(weekday: Int, hour: Int, minute: Int) -> DateComponents {
        var c = DateComponents()
        c.weekday = weekday
        c.hour = hour
        c.minute = minute
        return c
    }

    /// The registered DeviceActivity name for a session — must match the names
    /// built in `resyncAll` (`<prefix>.<id>.oneoff` / `.daily`).
    static func scheduledActivityName(for s: ScheduledSession) -> String {
        let suffix = s.isOneOff ? "oneoff" : "daily"
        return "\(SharedScreenTime.scheduledActivityPrefix).\(s.id).\(suffix)"
    }

    /// Stop every previously-registered scheduled activity (recovered from the
    /// persisted map). Never affects the manual `"LockedInSession"` activity.
    ///
    /// `excluding` names are left running — used to preserve a currently-active
    /// window's monitor, because stopping an in-progress interval makes the
    /// extension fire `intervalDidEnd` → `clearShield()` (un-blocking apps
    /// mid-session) and queues a spurious completion.
    public func stopAllScheduled(excluding: Set<String> = []) {
        guard #available(iOS 16.0, *) else { return }

        // Stop the union of the live map AND the append-only ledger, so a
        // corrupted/cleared map can't orphan old activities (e.g. per-weekday
        // names from a prior app version) with no way to reach them.
        var nameSet = Set<String>()
        if let data = SharedScreenTime.sharedDefaults()?.data(forKey: SharedScreenTime.Keys.scheduledActivityMap),
           let map = try? JSONDecoder().decode([String: ScheduledActivityMeta].self, from: data) {
            nameSet.formUnion(map.keys)
        }
        if let ledger = Defaults.codable([String].self,
                                         SharedScreenTime.Keys.scheduledActivityLedger,
                                         scope: .appGroup) {
            nameSet.formUnion(ledger)
        }
        nameSet.subtract(excluding)
        guard !nameSet.isEmpty else { return }

        let names = nameSet.map { DeviceActivityName($0) }
        do {
            try ObjCExceptionCatcher.execute {
                DeviceActivityCenter().stopMonitoring(names)
            }
        } catch {
            AnalyticsService.shared.captureException(error, properties: [
                "context": "scheduled_activity_stop_all",
            ])
        }
    }
}
