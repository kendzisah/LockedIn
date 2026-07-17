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
    /// Persisted set of occurrence ids poisoned by a mid-window disable /
    /// delete / invalidating edit, or by a sub-60s user end of the promoted
    /// timer. The drain consults it to drop the extension's stop/end-triggered
    /// record, and `currentActiveOccurrence` treats poisoned occurrences as
    /// inactive (no re-promotion of a window the user already resolved). It is
    /// deliberately separate from the credited set so `isCredited` stays false
    /// and a still-live promoted in-app session can credit normally through
    /// `onFinish` when it completes.
    public static let poisonedSetKey = "@lockedin/poisoned_scheduled_occurrences"

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
            // Editing a session mid-window can INVALIDATE its live occurrence
            // (times moved off `now`, today's weekday removed, disabled): the
            // resync below then stops the in-progress monitor, and the
            // stop-fired `intervalDidEnd` would mint a full-duration
            // completion for a window the user just cut short — the same
            // defect `delete`/`setEnabled(false)` pre-poison against. If the
            // edited session still covers `now`, the occurrence id is
            // unchanged (same id + date) and must NOT be poisoned.
            if let oldWindow = sessions[i].activeWindow(),
               session.activeWindow()?.occurrenceId != oldWindow.occurrenceId {
                poisonActiveWindowIfNeeded(sessions[i])
            }
            sessions[i] = session
        } else {
            sessions.append(session)
        }
        persistAndSync()
    }

    public func delete(id: String) {
        if let s = sessions.first(where: { $0.id == id }) {
            poisonActiveWindowIfNeeded(s)
        }
        sessions.removeAll { $0.id == id }
        persistAndSync()
    }

    public func setEnabled(id: String, _ enabled: Bool) {
        guard let i = sessions.firstIndex(where: { $0.id == id }) else { return }
        if !enabled {
            poisonActiveWindowIfNeeded(sessions[i])
        }
        sessions[i].enabled = enabled
        if enabled, let w = sessions[i].activeWindow() {
            // Re-enabled MID-WINDOW after a disable poisoned this occurrence:
            // un-poison it, or the re-registered window's legitimate natural
            // completion (extension record at window end) would be dropped by
            // the drain — the user blocked for the rest of the window with
            // zero credit. The re-enable is an explicit "this window is on
            // again", so the occurrence's credit must be possible again.
            removePoisoned(w.occurrenceId)
        }
        persistAndSync()
    }

    /// Disabling or deleting a session WHILE its window is live must not mint a
    /// credit: `persistAndSync` → `resyncAll` stops the in-progress
    /// DeviceActivity monitor, which makes the extension fire `intervalDidEnd`
    /// → record a full-duration completion → the next drain credits a session
    /// the user just cut short. Pre-poisoning makes that stop-triggered record
    /// a drain no-op.
    ///
    /// The poison goes into a SEPARATE set (`poisonedSetKey`), not the
    /// credited set: `onFinish`'s single-credit guard reads `isCredited`, and
    /// poisoning through the credited set would make a still-live PROMOTED
    /// in-app session (the user toggled the schedule off mid-window while
    /// watching the timer) read as "already credited" — zero XP/streak/guild
    /// for a session it visibly ran to completion. The drain checks both sets;
    /// `onFinish` only the credited one.
    private func poisonActiveWindowIfNeeded(_ session: ScheduledSession) {
        guard let w = session.activeWindow(), !isCredited(w.occurrenceId) else { return }
        insertPoisoned(w.occurrenceId)
    }

    /// Logout cleanup — clear everything and stop all auto-block schedules.
    public func fullReset() {
        sessions = []
        Defaults.remove(Self.storageKey)
        Defaults.remove(Self.creditedSetKey)
        Defaults.remove(Self.poisonedSetKey)
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

    /// Re-register the DeviceActivity auto-block schedules + notifications from
    /// the current session list. Safe to call on every app foreground —
    /// `resyncAll` is stop-all-then-re-add and recovers a registration that was
    /// dropped after a Family Controls authorization race or an OS eviction (a
    /// suspected cause of background blocking failing to engage). No-op until
    /// hydrated so we never wipe schedules with an empty in-memory list.
    public func resyncMonitoring() {
        guard isHydrated else { return }
        // ALWAYS roll the notification horizon forward. Scheduled-session
        // notifications are absolute, NON-repeating triggers covering only the
        // next couple of occurrences per session (to stay under iOS's 64-pending
        // cap), so they must be re-armed on every foreground or they run dry.
        // Safe mid-window: it never touches DeviceActivity, and the resync
        // explicitly re-adds the LIVE occurrence's "Session Complete" (which
        // the strictly-future `upcomingOccurrences` alone would drop).
        NotificationService.shared.resyncScheduledSessionNotifications(sessions)
        // Don't re-register while a window is currently active: `resyncAll` calls
        // `stopAllScheduled()`, and stopping an in-progress DeviceActivity
        // interval makes the extension fire `intervalDidEnd` → `clearShield()`,
        // un-blocking apps mid-session. Recovery happens on the next foreground
        // once no window is live (CRUD + launch still resync directly).
        guard currentActiveOccurrence() == nil else { return }
        ScheduledLockService.shared.resyncAll(sessions)
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
    ///
    /// POISONED occurrences read as inactive too: a poison means the user
    /// already resolved this window (sub-60s hold-to-end of the promoted
    /// timer, or a mid-window disable/delete) — reporting it live again would
    /// let the 30s foreground ticker re-promote and re-shield a session the
    /// user just killed.
    public func currentActiveOccurrence(now: Date = Date())
        -> (session: ScheduledSession, occurrenceId: String, end: Date)?
    {
        for s in sessions where s.enabled {
            if let w = s.activeWindow(now: now),
               !isCredited(w.occurrenceId),
               !isPoisoned(w.occurrenceId) {
                return (s, w.occurrenceId, w.end)
            }
        }
        return nil
    }

    public func isCredited(_ occurrenceId: String) -> Bool {
        let set = Set(Defaults.codable([String].self, Self.creditedSetKey) ?? [])
        return set.contains(occurrenceId)
    }

    public func isPoisoned(_ occurrenceId: String) -> Bool {
        let set = Set(Defaults.codable([String].self, Self.poisonedSetKey) ?? [])
        return set.contains(occurrenceId)
    }

    /// Poison an occurrence the user explicitly killed sub-60s (hold-to-end
    /// within the first minute of a promoted scheduled window — the "not now"
    /// reaction to an auto-started block, which earns nothing). The shield is
    /// already down (`endSession` ran) but the OS window keeps running: the
    /// scheduled monitor's `intervalDidEnd` will still record a FULL-duration
    /// completion at window end, and without the poison the next drain would
    /// credit it in full — for a window that ran unshielded after the user
    /// cancelled it. Poisoning (not crediting) drops that record, and
    /// `currentActiveOccurrence` treats the occurrence as inactive so the 30s
    /// foreground ticker can't re-promote the session the user just ended.
    public func poisonOccurrence(_ occurrenceId: String) {
        insertPoisoned(occurrenceId)
    }

    /// Mark an occurrence credited so the queued completion (from the DAM
    /// extension's `intervalDidEnd`) is skipped — the in-app live timer already
    /// credited it. Single-credit guarantee across both paths.
    ///
    /// Side effect: a ONE-OFF session credited through this in-app path is
    /// auto-disabled here, exactly like `drainPendingCompletions` does for the
    /// background path. Without this the one-off stays enabled after its
    /// in-app credit, `nextOccurrence` rolls to tomorrow, and the schedule
    /// silently re-arms and auto-blocks again the next day.
    public func markCredited(_ occurrenceId: String) {
        insertCredited(occurrenceId)

        // occurrenceId is "<sessionId>.<yyyy-MM-dd>" — strip the LAST
        // dot-component only (session ids are UUIDs today, but must not break
        // if an id ever contains dots).
        let sessionId = occurrenceId
            .split(separator: ".")
            .dropLast()
            .joined(separator: ".")
        if let i = sessions.firstIndex(where: { $0.id == sessionId }),
           sessions[i].isOneOff, sessions[i].enabled {
            sessions[i].enabled = false
            persistAndSync()
        }
    }

    /// Raw insert into the persisted credited set — no side effects (unlike
    /// `markCredited`, whose one-off auto-disable would recurse into
    /// `persistAndSync` if invoked mid-mutation).
    private func insertCredited(_ occurrenceId: String) {
        var set = Set(Defaults.codable([String].self, Self.creditedSetKey) ?? [])
        set.insert(occurrenceId)
        Defaults.setCodable(Array(set), Self.creditedSetKey)
    }

    /// Raw insert into the drain-only poison set (see
    /// `poisonActiveWindowIfNeeded` for why this is not the credited set).
    private func insertPoisoned(_ occurrenceId: String) {
        var set = Set(Defaults.codable([String].self, Self.poisonedSetKey) ?? [])
        set.insert(occurrenceId)
        Defaults.setCodable(Array(set), Self.poisonedSetKey)
        // Mirror the poison into the App-Group guild-credited set: this
        // poison set is app-only, so the DAM extension's window-end guild
        // push can't see it — without the mark a cancelled window would
        // still add its FULL duration to the guild month cache (and the
        // server keeps it via GREATEST). Deliberate trade-off: a promoted
        // in-app session that keeps running after a mid-window disable will
        // skip its guild minutes at `onFinish` (XP/streak still credit) —
        // preferred over the full-window guild over-credit for the common
        // app-closed case.
        GuildBackgroundStore.markGuildCredited(occurrenceId)
    }

    /// Remove a poison (mid-window re-enable) so the window's later legitimate
    /// completion can credit again.
    private func removePoisoned(_ occurrenceId: String) {
        var set = Set(Defaults.codable([String].self, Self.poisonedSetKey) ?? [])
        guard set.remove(occurrenceId) != nil else { return }
        Defaults.setCodable(Array(set), Self.poisonedSetKey)
        // Lift the poison-time guild mark too (see `insertPoisoned`), or the
        // re-enabled window's legitimate completion earns zero guild minutes.
        GuildBackgroundStore.removeGuildCredited(occurrenceId)
    }

    // MARK: - Deferred credit (drain)

    /// Drain the App-Group completion queue the extension appended to. Calls
    /// `credit(occurrenceId, durationMinutes, endedAtMs)` exactly once per new
    /// occurrence id, then clears the queue. `occurrenceId` lets the caller check
    /// whether the DAM extension already pushed this occurrence's GUILD points in
    /// the background (and skip re-pushing them). `endedAtMs` lets the caller
    /// attribute the credit to the real session time (time-of-day missions, day
    /// attribution) rather than the time the app happened to open. Returns the
    /// number credited.
    @discardableResult
    public func drainPendingCompletions(credit: (_ occurrenceId: String, _ minutes: Int, _ endedAtMs: Double) -> Void) -> Int {
        guard !isDraining else { return 0 }
        isDraining = true
        defer { isDraining = false }

        let shared = SharedScreenTime.sharedDefaults()
        guard let data = shared?.data(forKey: SharedScreenTime.Keys.pendingScheduledCompletions),
              let records = try? JSONDecoder().decode([ScheduledCompletionRecord].self, from: data),
              !records.isEmpty
        else { return 0 }

        var credited = Set(Defaults.codable([String].self, Self.creditedSetKey) ?? [])
        var poisoned = Set(Defaults.codable([String].self, Self.poisonedSetKey) ?? [])
        var firedOneOffSessionIds = Set<String>()
        var creditedCount = 0

        for r in records {
            if credited.contains(r.occurrenceId) { continue }
            // Mid-window disable/delete/invalidating-edit (or a sub-60s user
            // end) pre-poisoned this occurrence — the record was minted by
            // the monitor STOP / the cancelled window's end, not a real
            // completion. Drop it without marking credited, so a legitimate
            // in-app credit (promoted session still running) stays possible
            // via `onFinish`.
            //
            // The poison is ONE-SHOT: each poison exists to kill exactly one
            // minted record (poison:record is 1:1 by construction — a stop
            // fires one end; a cancelled-but-armed window records once at its
            // end). Occurrence ids are only date-scoped, so an edit that
            // re-runs the window LATER THE SAME DAY mints the SAME id for its
            // legitimate completion — a persistent poison would swallow that
            // too: the user fully blocked with zero credit and no timer UI.
            // Consuming the poison here (and lifting its guild mark) lets the
            // later real record credit normally.
            if poisoned.contains(r.occurrenceId) {
                poisoned.remove(r.occurrenceId)
                GuildBackgroundStore.removeGuildCredited(r.occurrenceId)
                continue
            }
            credited.insert(r.occurrenceId)
            guard r.durationMinutes > 0 else { continue }
            credit(r.occurrenceId, r.durationMinutes, r.endedAtMs)
            creditedCount += 1
            firedOneOffSessionIds.insert(r.sessionId)
        }

        // Clear queue + persist the (pruned) credited + poisoned sets. The
        // poisoned set is written unconditionally — a consumed poison must
        // not survive this drain.
        shared?.removeObject(forKey: SharedScreenTime.Keys.pendingScheduledCompletions)
        Defaults.setCodable(Array(prune(credited)), Self.creditedSetKey)
        Defaults.setCodable(Array(prune(poisoned)), Self.poisonedSetKey)

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
