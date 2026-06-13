//
//  ScheduledSessionsStore.swift
//  LockedIn — Scheduled Lock-In Sessions
//
//  @Observable store owning the user's scheduled lock-in sessions. CRUD persists
//  to standard UserDefaults and re-syncs the DeviceActivity auto-block schedules
//  + per-occurrence notifications. Also drains the App-Group completion queue the
//  DAM extension writes, crediting each occurrence once (EXP/missions).
//

import Foundation
import Observation

@MainActor
@Observable
public final class ScheduledSessionsStore {

    /// User-defined schedule list (standard scope).
    public static let storageKey = "@lockedin/scheduled_sessions"
    /// Persisted set of already-credited occurrence ids (double-credit guard).
    public static let creditedSetKey = "@lockedin/credited_scheduled_occurrences"

    public private(set) var sessions: [ScheduledSession] = []
    public private(set) var isHydrated = false

    @ObservationIgnored private var isDraining = false

    public init() {}

    // MARK: - Hydration

    public func hydrate() {
        sessions = Defaults.codable([ScheduledSession].self, Self.storageKey) ?? []
        isHydrated = true
        // Re-register on launch so schedules survive map clears / auth changes.
        resync()
    }

    // MARK: - CRUD

    public func add(_ session: ScheduledSession) {
        sessions.append(session)
        persistAndSync()
    }

    public func update(_ session: ScheduledSession) {
        if let i = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[i] = session
        } else {
            sessions.append(session)
        }
        persistAndSync()
    }

    public func delete(id: String) {
        sessions.removeAll { $0.id == id }
        persistAndSync()
    }

    public func setEnabled(id: String, _ enabled: Bool) {
        guard let i = sessions.firstIndex(where: { $0.id == id }) else { return }
        sessions[i].enabled = enabled
        persistAndSync()
    }

    /// Logout cleanup — clear everything and stop all auto-block schedules.
    public func fullReset() {
        sessions = []
        Defaults.remove(Self.storageKey)
        Defaults.remove(Self.creditedSetKey)
        ScheduledLockService.shared.stopAllScheduled()
        NotificationService.shared.resyncScheduledSessionNotifications([])
        SharedScreenTime.sharedDefaults()?.removeObject(forKey: SharedScreenTime.Keys.scheduledActivityMap)
        SharedScreenTime.sharedDefaults()?.removeObject(forKey: SharedScreenTime.Keys.pendingScheduledCompletions)
    }

    private func persistAndSync() {
        Defaults.setCodable(sessions, Self.storageKey)
        resync()
    }

    private func resync() {
        ScheduledLockService.shared.resyncAll(sessions)
        NotificationService.shared.resyncScheduledSessionNotifications(sessions)
    }

    // MARK: - Panel helpers

    /// Soonest `limit` upcoming occurrences across all enabled sessions,
    /// restricted to the current (Monday-based) week — the panel only surfaces
    /// this week's lock-ins, not future weeks'.
    public func upcomingOccurrences(limit: Int) -> [(session: ScheduledSession, date: Date)] {
        let weekEnd = Self.endOfCurrentWeek()
        var all: [(ScheduledSession, Date)] = []
        for s in sessions where s.enabled {
            for d in s.upcomingOccurrences(limit: limit) where d < weekEnd {
                all.append((s, d))
            }
        }
        return all.sorted { $0.1 < $1.1 }.prefix(limit).map { (session: $0.0, date: $0.1) }
    }

    /// Start of next week (Monday 00:00) — exclusive upper bound for "this week".
    static func endOfCurrentWeek(now: Date = Date()) -> Date {
        var cal = Calendar.current
        cal.firstWeekday = 2 // Monday
        let comps = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: now)
        let weekStart = cal.date(from: comps) ?? now
        return cal.date(byAdding: .day, value: 7, to: weekStart) ?? now
    }

    public var enabledCount: Int { sessions.filter { $0.enabled }.count }

    // MARK: - Live (in-window) occurrence

    /// The scheduled session whose auto-block window currently contains `now`
    /// and hasn't been credited yet — drives the live in-app timer surfaced
    /// when the user taps the notification / opens the app mid-window.
    public func currentActiveOccurrence(now: Date = Date())
        -> (session: ScheduledSession, occurrenceId: String, end: Date)?
    {
        for s in sessions where s.enabled {
            if let w = s.activeWindow(now: now), !isCredited(w.occurrenceId) {
                return (s, w.occurrenceId, w.end)
            }
        }
        return nil
    }

    public func isCredited(_ occurrenceId: String) -> Bool {
        let set = Set(Defaults.codable([String].self, Self.creditedSetKey) ?? [])
        return set.contains(occurrenceId)
    }

    /// Mark an occurrence credited so the queued completion (from the DAM
    /// extension's `intervalDidEnd`) is skipped — the in-app live timer already
    /// credited it. Single-credit guarantee across both paths.
    public func markCredited(_ occurrenceId: String) {
        var set = Set(Defaults.codable([String].self, Self.creditedSetKey) ?? [])
        set.insert(occurrenceId)
        Defaults.setCodable(Array(set), Self.creditedSetKey)
    }

    // MARK: - Deferred credit (drain)

    /// Drain the App-Group completion queue the extension appended to. Calls
    /// `credit(durationMinutes)` exactly once per new occurrence id, then clears
    /// the queue. Returns the number of occurrences credited (for a summary).
    @discardableResult
    public func drainPendingCompletions(credit: (Int) -> Void) -> Int {
        guard !isDraining else { return 0 }
        isDraining = true
        defer { isDraining = false }

        let shared = SharedScreenTime.sharedDefaults()
        guard let data = shared?.data(forKey: SharedScreenTime.Keys.pendingScheduledCompletions),
              let records = try? JSONDecoder().decode([ScheduledCompletionRecord].self, from: data),
              !records.isEmpty
        else { return 0 }

        var credited = Set(Defaults.codable([String].self, Self.creditedSetKey) ?? [])
        var firedOneOffSessionIds = Set<String>()
        var creditedCount = 0

        for r in records {
            if credited.contains(r.occurrenceId) { continue }
            credited.insert(r.occurrenceId)
            guard r.durationMinutes > 0 else { continue }
            credit(r.durationMinutes)
            creditedCount += 1
            firedOneOffSessionIds.insert(r.sessionId)
        }

        // Clear queue + persist the (pruned) credited set.
        shared?.removeObject(forKey: SharedScreenTime.Keys.pendingScheduledCompletions)
        Defaults.setCodable(Array(prune(credited)), Self.creditedSetKey)

        // Auto-disable one-off sessions that have now fired.
        var changed = false
        for sid in firedOneOffSessionIds {
            if let i = sessions.firstIndex(where: { $0.id == sid }), sessions[i].isOneOff, sessions[i].enabled {
                sessions[i].enabled = false
                changed = true
            }
        }
        if changed { persistAndSync() }

        return creditedCount
    }

    /// Keep the credited set bounded — occurrence ids older than ~60 days can't
    /// recur (a weekly schedule revisits a date only after a year).
    private func prune(_ ids: Set<String>) -> Set<String> {
        let cutoff = Calendar.current.date(byAdding: .day, value: -60, to: Date()) ?? .distantPast
        let cutoffYMD = ScheduledCompletionRecord.localYMD(cutoff)
        return ids.filter { id in
            guard let ymd = id.split(separator: ".").last.map(String.init) else { return true }
            return ymd >= cutoffYMD
        }
    }
}
