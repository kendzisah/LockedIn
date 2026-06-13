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

    /// A schedule is registerable only if it has a positive same-day duration.
    public var isValid: Bool { durationMinutes > 0 }

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
