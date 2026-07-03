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

    public init(sessionId: String, durationMinutes: Int, weekdays: [Int] = []) {
        self.sessionId = sessionId
        self.durationMinutes = durationMinutes
        self.weekdays = weekdays
    }

    // Tolerant decode: a map persisted before `weekdays` existed decodes with
    // an empty list rather than throwing (and failing the whole map).
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sessionId = try c.decode(String.self, forKey: .sessionId)
        durationMinutes = try c.decode(Int.self, forKey: .durationMinutes)
        weekdays = try c.decodeIfPresent([Int].self, forKey: .weekdays) ?? []
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
