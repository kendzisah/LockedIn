import Foundation

/// Shared Codable shapes for the scheduled-lock-in cross-process flow.
///
/// Compiled into BOTH the main app and the DeviceActivityMonitor extension via
/// the `Shared/` source group in `project.yml`, so both processes encode/decode
/// the identical JSON written to the App Group suite.

/// Per-activity metadata the app writes (keyed by `DeviceActivityName.rawValue`)
/// so the extension can recover the owning session + duration when an interval
/// ends, without parsing the activity name.
public struct ScheduledActivityMeta: Codable, Equatable, Sendable {
    public let sessionId: String
    public let durationMinutes: Int
    /// Calendar weekdays (1 = Sun … 7 = Sat) this activity should actually fire
    /// on. Recurring sessions register a single *daily* DeviceActivity schedule
    /// (far more reliable at firing `intervalDidStart` than per-weekday
    /// schedules), so the extension filters by this on each fire. Empty == fire
    /// every day it triggers (one-off, whose schedule already targets one date).
    public let weekdays: [Int]
    /// Window start/end as minutes-of-day (0…1439), mirroring the session's
    /// `startHour * 60 + startMinute` / `endHour * 60 + endMinute`. The
    /// extension needs the actual window instants for two things it cannot
    /// otherwise do correctly:
    ///  1. Midnight-drift weekday gating — a callback delivered slightly across
    ///     midnight would evaluate `weekdays` against the WRONG day if it used
    ///     `now`; with the window time it derives the day the boundary actually
    ///     belongs to.
    ///  2. Back-to-back window detection — on one window's `intervalDidEnd` it
    ///     can tell whether ANOTHER scheduled window contains `now` and, if so,
    ///     keep the shield up instead of un-blocking mid-session.
    /// Optional + default-nil so maps persisted by older builds keep decoding;
    /// nil ⇒ the extension falls back to the legacy `now`-based gating.
    public let startMinutesOfDay: Int?
    public let endMinutesOfDay: Int?
    /// ONE-OFFS ONLY: the concrete local calendar date (`yyyy-MM-dd`, matching
    /// `ScheduledCompletionRecord.localYMD`) this activity's single occurrence
    /// is registered for. A one-off's DeviceActivity schedule is pinned to one
    /// date, but its meta has empty `weekdays` — without this field every
    /// liveness scan (`anotherScheduledWindowActive`, the intents' gate)
    /// treats the entry as "fires any day" and a stale/future one-off reads as
    /// live on every later day whose time-of-day matches. nil for recurring
    /// sessions (weekday-gated) and for maps persisted by older builds;
    /// date-less one-off entries are treated as NOT provably live.
    public let occurrenceYMD: String?

    public init(
        sessionId: String,
        durationMinutes: Int,
        weekdays: [Int] = [],
        startMinutesOfDay: Int? = nil,
        endMinutesOfDay: Int? = nil,
        occurrenceYMD: String? = nil
    ) {
        self.sessionId = sessionId
        self.durationMinutes = durationMinutes
        self.weekdays = weekdays
        self.startMinutesOfDay = startMinutesOfDay
        self.endMinutesOfDay = endMinutesOfDay
        self.occurrenceYMD = occurrenceYMD
    }

    // Tolerant decode: a map persisted before `weekdays` (or the window-time
    // fields) existed decodes with empty/nil values rather than throwing (and
    // failing the whole map).
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sessionId = try c.decode(String.self, forKey: .sessionId)
        durationMinutes = try c.decode(Int.self, forKey: .durationMinutes)
        weekdays = try c.decodeIfPresent([Int].self, forKey: .weekdays) ?? []
        startMinutesOfDay = try c.decodeIfPresent(Int.self, forKey: .startMinutesOfDay)
        endMinutesOfDay = try c.decodeIfPresent(Int.self, forKey: .endMinutesOfDay)
        occurrenceYMD = try c.decodeIfPresent(String.self, forKey: .occurrenceYMD)
    }
}

/// One completed scheduled occurrence, appended by the extension at
/// `intervalDidEnd` and drained + credited by the app on next open.
///
/// `occurrenceId` is deterministic (`"<sessionId>.<localYMD>"`) so a given
/// session credits at most once per calendar date — the core double-credit
/// guard against duplicate `intervalDidEnd` callbacks or re-drains.
public struct ScheduledCompletionRecord: Codable, Equatable, Sendable {
    public let occurrenceId: String
    public let sessionId: String
    public let durationMinutes: Int
    public let endedAtMs: Double

    public init(occurrenceId: String, sessionId: String, durationMinutes: Int, endedAtMs: Double) {
        self.occurrenceId = occurrenceId
        self.sessionId = sessionId
        self.durationMinutes = durationMinutes
        self.endedAtMs = endedAtMs
    }

    /// Local-calendar `yyyy-MM-dd` for an end date — matches the app-side
    /// `SessionDayKey.format` so occurrence ids agree across processes.
    public static func localYMD(_ date: Date) -> String {
        let c = Calendar.current
        let y = c.component(.year, from: date)
        let m = c.component(.month, from: date)
        let d = c.component(.day, from: date)
        return String(format: "%04d-%02d-%02d", y, m, d)
    }

    public static func makeOccurrenceId(sessionId: String, endDate: Date) -> String {
        "\(sessionId).\(localYMD(endDate))"
    }
}
