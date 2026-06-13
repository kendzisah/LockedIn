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
        stopAllScheduled()

        guard #available(iOS 16.0, *) else { return false }

        // Auto-block requires Family Controls authorization (same gate as a
        // manual session). If not approved, register nothing and let the
        // notification-only fallback cover the user.
        guard ScreenTimeModule.shared.getAuthorizationStatus() == .approved else {
            SharedScreenTime.sharedDefaults()?.removeObject(forKey: SharedScreenTime.Keys.scheduledActivityMap)
            return false
        }

        struct Candidate {
            let name: String
            let schedule: DeviceActivitySchedule
            let meta: ScheduledActivityMeta
            let when: Date
        }

        let now = Date()
        let cal = Calendar.current
        var candidates: [Candidate] = []

        for s in sessions where s.enabled && s.isValid {
            if s.isOneOff {
                guard let next = s.nextOccurrence(after: now) else { continue }
                candidates.append(Candidate(
                    name: "\(SharedScreenTime.scheduledActivityPrefix).\(s.id).oneoff",
                    schedule: DeviceActivitySchedule(
                        intervalStart: DateComponents(hour: s.startHour, minute: s.startMinute),
                        intervalEnd: DateComponents(hour: s.endHour, minute: s.endMinute),
                        repeats: false
                    ),
                    meta: ScheduledActivityMeta(sessionId: s.id, durationMinutes: s.durationMinutes),
                    when: next
                ))
            } else {
                for wd in s.weekdays {
                    var startWhen = DateComponents()
                    startWhen.weekday = wd
                    startWhen.hour = s.startHour
                    startWhen.minute = s.startMinute
                    let when = cal.nextDate(after: now, matching: startWhen, matchingPolicy: .nextTime) ?? now
                    candidates.append(Candidate(
                        name: "\(SharedScreenTime.scheduledActivityPrefix).\(s.id).\(wd)",
                        schedule: DeviceActivitySchedule(
                            intervalStart: Self.components(weekday: wd, hour: s.startHour, minute: s.startMinute),
                            intervalEnd: Self.components(weekday: wd, hour: s.endHour, minute: s.endMinute),
                            repeats: true
                        ),
                        meta: ScheduledActivityMeta(sessionId: s.id, durationMinutes: s.durationMinutes),
                        when: when
                    ))
                }
            }
        }

        candidates.sort { $0.when < $1.when }
        let dropped = max(0, candidates.count - maxScheduledActivities)
        let selected = Array(candidates.prefix(maxScheduledActivities))

        let center = DeviceActivityCenter()
        var map: [String: ScheduledActivityMeta] = [:]

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
                AnalyticsService.shared.captureException(err, properties: [
                    "context": "scheduled_activity_start",
                    "activity": c.name,
                ])
            }
        }

        // Persist the map (App Group) so the extension can recover session id +
        // duration when an interval ends.
        if !map.isEmpty, let data = try? JSONEncoder().encode(map) {
            SharedScreenTime.sharedDefaults()?.set(data, forKey: SharedScreenTime.Keys.scheduledActivityMap)
        } else {
            SharedScreenTime.sharedDefaults()?.removeObject(forKey: SharedScreenTime.Keys.scheduledActivityMap)
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

    /// Stop every previously-registered scheduled activity (recovered from the
    /// persisted map). Never affects the manual `"LockedInSession"` activity.
    public func stopAllScheduled() {
        guard #available(iOS 16.0, *) else { return }
        guard let data = SharedScreenTime.sharedDefaults()?.data(forKey: SharedScreenTime.Keys.scheduledActivityMap),
              let map = try? JSONDecoder().decode([String: ScheduledActivityMeta].self, from: data),
              !map.isEmpty
        else { return }

        let names = map.keys.map { DeviceActivityName($0) }
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
