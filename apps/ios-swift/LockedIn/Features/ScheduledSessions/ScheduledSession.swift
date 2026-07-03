//
//  ScheduledSession.swift
//  LockedIn — Scheduled Lock-In Sessions
//
//  User-defined schedule for an auto-starting lock-in. At the start time the
//  DeviceActivity schedule (registered by `ScheduledLockService`) auto-applies
//  the distraction shield even if the app is closed; the shield clears at the
//  end time. EXP/missions are credited when the app next opens.
//

import Foundation

/// A user-defined scheduled lock-in. `weekdays` empty == one-off (fires on the
/// next occurrence of the start time, then auto-disables once credited).
public struct ScheduledSession: Codable, Identifiable, Equatable, Sendable {
    public var id: String
    public var label: String
    public var startHour: Int
    public var startMinute: Int
    public var endHour: Int
    public var endMinute: Int
    /// Calendar weekdays (1 = Sunday … 7 = Saturday). Empty == one-off.
    public var weekdays: [Int]
    public var enabled: Bool
    public var createdAt: Double  // epoch ms

    public init(
        id: String = UUID().uuidString,
        label: String = "",
        startHour: Int,
        startMinute: Int,
        endHour: Int,
        endMinute: Int,
        weekdays: [Int] = [],
        enabled: Bool = true,
        createdAt: Double = Date().timeIntervalSince1970 * 1000
    ) {
        self.id = id
        self.label = label
        self.startHour = startHour
        self.startMinute = startMinute
        self.endHour = endHour
        self.endMinute = endMinute
        self.weekdays = weekdays
        self.enabled = enabled
        self.createdAt = createdAt
    }

    // MARK: - Derived

    public var startMinutesOfDay: Int { startHour * 60 + startMinute }
    public var endMinutesOfDay: Int { endHour * 60 + endMinute }

    /// Minutes between start and end. v1 requires end > start same-day
    /// (cross-midnight is out of scope), so this is 0 for invalid ranges.
    public var durationMinutes: Int {
        max(0, endMinutesOfDay - startMinutesOfDay)
    }

    public var isOneOff: Bool { weekdays.isEmpty }

    /// iOS `DeviceActivity` won't reliably monitor an interval shorter than 15
    /// minutes — `startMonitoring` rejects it, so the window silently never
    /// arms. Enforced in the editor and as a registration guard.
    public static let minWindowMinutes = 15

    /// A schedule is registerable only if its same-day duration meets the iOS
    /// DeviceActivity minimum.
    public var isValid: Bool { durationMinutes >= Self.minWindowMinutes }

    // MARK: - Occurrences (local calendar)

    private func startComponents(weekday: Int?) -> DateComponents {
        var c = DateComponents()
        c.hour = startHour
        c.minute = startMinute
        c.second = 0
        if let weekday { c.weekday = weekday }
        return c
    }

    /// If `now` falls inside today's [start, end) window (and, for recurring
    /// sessions, today's weekday is selected), returns the occurrence id and
    /// the window's end `Date`. Used to surface the live in-app timer when the
    /// user opens the app / taps the notification during an auto-block window.
    public func activeWindow(now: Date = Date()) -> (occurrenceId: String, end: Date)? {
        guard isValid, enabled else { return nil }
        let cal = Calendar.current
        if !isOneOff {
            let wd = cal.component(.weekday, from: now)
            guard weekdays.contains(wd) else { return nil }
        }
        guard let start = cal.date(bySettingHour: startHour, minute: startMinute, second: 0, of: now),
              let end = cal.date(bySettingHour: endHour, minute: endMinute, second: 0, of: now),
              now >= start, now < end
        else { return nil }
        let occurrenceId = "\(id).\(ScheduledCompletionRecord.localYMD(end))"
        return (occurrenceId, end)
    }

    /// The soonest start `Date` strictly after `after`. nil if invalid.
    public func nextOccurrence(after: Date = Date()) -> Date? {
        guard isValid else { return nil }
        let cal = Calendar.current
        if isOneOff {
            return cal.nextDate(after: after, matching: startComponents(weekday: nil), matchingPolicy: .nextTime)
        }
        let candidates = weekdays.compactMap { wd in
            cal.nextDate(after: after, matching: startComponents(weekday: wd), matchingPolicy: .nextTime)
        }
        return candidates.min()
    }

    // MARK: - Overlap

    /// Days-of-week (1 = Sun … 7 = Sat) this session is active on. For a
    /// recurring session that's its `weekdays`; for a one-off it's the single
    /// weekday of its next occurrence (empty if it has none).
    func activeWeekdays(now: Date = Date()) -> Set<Int> {
        if !isOneOff { return Set(weekdays) }
        guard let next = nextOccurrence(after: now) else { return [] }
        return [Calendar.current.component(.weekday, from: next)]
    }

    /// True if this session's lock-in window collides with `other`'s on a day
    /// both are active. Overlapping windows can fight over the shield — one
    /// window's end un-blocks apps while the other is still mid-session — so the
    /// editor rejects them. Time comparison is half-open `[start, end)`, so a
    /// session ending exactly when another starts is NOT a conflict.
    func overlaps(with other: ScheduledSession, now: Date = Date()) -> Bool {
        guard isValid, other.isValid else { return false }

        // Do they ever share a day?
        if isOneOff && other.isOneOff {
            // Two one-offs only collide if they actually fire on the same date.
            // Comparing real fire dates (not just time-of-day) is intentional:
            // a 9–11 one-off whose 9:00 start already passed today fires
            // *tomorrow*, so it can't clash with a 10–12 one-off firing *today*.
            guard let a = nextOccurrence(after: now),
                  let b = other.nextOccurrence(after: now),
                  Calendar.current.isDate(a, inSameDayAs: b)
            else { return false }
        } else if activeWeekdays(now: now).isDisjoint(with: other.activeWeekdays(now: now)) {
            return false
        }

        // Time-of-day overlap on that shared day.
        return startMinutesOfDay < other.endMinutesOfDay
            && other.startMinutesOfDay < endMinutesOfDay
    }

    /// Up to `limit` upcoming start `Date`s (for the HUD panel preview).
    public func upcomingOccurrences(limit: Int, after: Date = Date()) -> [Date] {
        guard isValid, enabled else { return [] }
        var out: [Date] = []
        var cursor = after
        var guardCount = 0
        while out.count < limit && guardCount < 64 {
            guardCount += 1
            guard let next = nextOccurrence(after: cursor) else { break }
            out.append(next)
            cursor = next.addingTimeInterval(60)  // step past this occurrence
            if isOneOff { break }                  // one-off has a single occurrence
        }
        return out
    }
}

// MARK: - Display helpers

public extension ScheduledSession {
    /// Short weekday names indexed by Calendar weekday (1 = Sun … 7 = Sat).
    static let weekdayShort = ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    /// Single-letter weekday initials for chips.
    static let weekdayInitial = ["", "S", "M", "T", "W", "T", "F", "S"]
    /// Editor chip order: Mon-first.
    static let weekdayChipOrder = [2, 3, 4, 5, 6, 7, 1]

    static func clock(hour: Int, minute: Int) -> String {
        let suffix = hour < 12 ? "AM" : "PM"
        var h = hour % 12
        if h == 0 { h = 12 }
        return String(format: "%d:%02d %@", h, minute, suffix)
    }

    var startTimeString: String { Self.clock(hour: startHour, minute: startMinute) }
    var endTimeString: String { Self.clock(hour: endHour, minute: endMinute) }
    var timeRangeString: String { "\(startTimeString) – \(endTimeString)" }

    var displayLabel: String { label.isEmpty ? "Lock In" : label }

    /// Human-readable recurrence: "Once", "Every day", "Weekdays", "Weekends",
    /// or a comma list ("Mon, Wed, Fri").
    var recurrenceSummary: String {
        if isOneOff { return "Once" }
        let set = Set(weekdays)
        if set == Set(1...7) { return "Every day" }
        if set == Set([2, 3, 4, 5, 6]) { return "Weekdays" }
        if set == Set([1, 7]) { return "Weekends" }
        return Self.weekdayChipOrder
            .filter { set.contains($0) }
            .map { Self.weekdayShort[$0] }
            .joined(separator: ", ")
    }
}
