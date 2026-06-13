//
//  UniversalMissionPools.swift
//  LockedIn
//
//  Five guild-agnostic 10-template pools — one per primary stat. Used by
//  Agent 2's mission-tag fan-out and the Stat Rotation slot (Wave 1) to
//  surface a stat-specific universal mission when the user's primary goal
//  doesn't already cover that stat axis.
//
//  Templates here are PURELY DATA. Logic (selection, slot assignment, tier
//  scaling) lives in `MissionsEngine`. The `MissionType` for each template
//  is chosen so `MissionTypeStats.map[type]` produces the intended stat tag
//  set — see `MissionsEngine.swift:118-132`.
//
//  Type → stat mapping reference (do not break without coordinating):
//    .social      → [.social]
//    .discipline  → [.discipline]
//    .reading     → [.focus]              // pure FOC (no execution drag)
//    .planning    → [.execution]          // pure EXE
//    .lifestyle   → [.consistency]        // pure CON
//
//  XP is the existing easy/medium/hard tier shape via `MissionXPTier`.
//  Baseline is 15/20/25; CON + SOC nudge up to 20/25/30 because completing
//  a routine / a social touchpoint feels heavier per-attempt than ticking
//  a planning checkbox, and the fleet briefing flagged those two stats as
//  the ones to lean XP into.
//

import Foundation
import DesignKit

public enum UniversalMissionPools {

    // MARK: - SOC universal (10 templates)

    public static let socialUniversal: [MissionTemplate] = [
        MissionTemplate(
            title: "Appreciate a Friend",
            description: "Text a friend something specific you appreciate about them",
            type: .social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Send the Thoughtful Reply",
            description: "Send a thoughtful reply to a message you've been ignoring",
            type: .social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Specific Compliment",
            description: "Compliment a coworker on something specific they did",
            type: .social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Ask 3 Questions",
            description: "Ask 3 questions in your next meeting or conversation",
            type: .social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Call Family",
            description: "Call a parent or sibling for 5+ minutes",
            type: .social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Share Your Goal",
            description: "Share your goal of the week with someone you trust",
            type: .social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Help One Person",
            description: "Help one person today — advice, intro, edit, or debug",
            type: .social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Reconnect",
            description: "Catch up with someone you haven't talked to in 30+ days",
            type: .social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Public Learning",
            description: "Post something you learned online (LinkedIn, X, etc.)",
            type: .social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Ask for Feedback",
            description: "Request feedback from a peer or mentor on your work",
            type: .social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        )
    ]

    // MARK: - DIS universal (10 templates)

    public static let disciplineUniversal: [MissionTemplate] = [
        MissionTemplate(
            title: "Notification Detox",
            description: "Turn off all non-essential notifications for the day",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "No Social Until Lunch",
            description: "Zero social media before 12 PM",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25),
            timeGate: "After 12 PM"
        ),
        MissionTemplate(
            title: "No YouTube / Netflix",
            description: "Zero streaming entertainment for 24 hours",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25),
            timeGate: "After 9 PM"
        ),
        MissionTemplate(
            title: "Phone Out of Reach",
            description: "Phone in another room for 2 hours straight",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Single-Task to Done",
            description: "Single-task one item from start to finish — no switching",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Phone-Free First Hour",
            description: "No checking phone for the first hour after waking",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Skip the Comfort",
            description: "Skip one comfort meal or snack you'd normally reach for",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Cold Shower",
            description: "Take a cold shower (2+ minutes)",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Wake Before Alarm",
            description: "Get out of bed before your alarm goes off",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "No Reactive Replies",
            description: "Wait until tomorrow before replying to anything that triggers you",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        )
    ]

    // MARK: - FOC universal (10 templates)
    //
    // All entries use `.reading` so `MissionTypeStats.map` resolves to
    // `[.focus]` only — these are FOC-pure missions, no execution credit.

    public static let focusUniversal: [MissionTemplate] = [
        MissionTemplate(
            title: "Deep Work Hour",
            description: "Complete a 60-min deep work block on one task",
            type: .reading,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Pomodoro Pair",
            description: "Complete two back-to-back 25-min Pomodoro cycles",
            type: .reading,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Read a Chapter",
            description: "Read one full chapter of a book",
            type: .reading,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "500-Word Reflection",
            description: "Write a 500-word reflection on this week",
            type: .reading,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Tomorrow's Top 3",
            description: "Outline tomorrow's top 3 priorities in detail",
            type: .reading,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25),
            timeGate: "After 6 PM"
        ),
        MissionTemplate(
            title: "Single-Screen Session",
            description: "Work one session on a single screen — no monitor switching",
            type: .reading,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Time-Block the Morning",
            description: "Time-block your morning in 30-min slots before starting",
            type: .reading,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Silent Deep Work",
            description: "Complete a focus session with no music or background noise",
            type: .reading,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Phone in Another Room",
            description: "Keep your phone in another room during one focus session",
            type: .reading,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "One Tab Only",
            description: "Close all but one browser tab for an entire focus session",
            type: .reading,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        )
    ]

    // MARK: - EXE universal (10 templates)
    //
    // All entries use `.planning` so `MissionTypeStats.map` resolves to
    // `[.execution]` only.

    public static let executionUniversal: [MissionTemplate] = [
        MissionTemplate(
            title: "Ship One Thing",
            description: "Take one task all the way to 'done' today",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Decide the Delayed",
            description: "Make a decision you've been delaying",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Send the Email",
            description: "Send the outstanding email you've been avoiding",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Clear 3 Todos",
            description: "Cross 3 items off your todo list today",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Update Project Tracker",
            description: "Update your project tracker with today's progress",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Prune the Task List",
            description: "Review and remove anything from your task list that no longer matters",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "3 Weekly Goals",
            description: "Set 3 measurable goals for the week",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Weekly Review Now",
            description: "Write your weekly review now — don't put it off",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Finish the Half-Done",
            description: "Complete one half-finished task that's been sitting",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        ),
        MissionTemplate(
            title: "Document a Process",
            description: "Write down one process or workflow you do regularly",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25)
        )
    ]

    // MARK: - CON universal (10 templates)
    //
    // All entries use `.lifestyle` so `MissionTypeStats.map` resolves to
    // `[.consistency]` only.

    public static let consistencyUniversal: [MissionTemplate] = [
        MissionTemplate(
            title: "Same Wake-Up Time",
            description: "Get up at the same time you woke up yesterday",
            type: .lifestyle,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Evening Journal",
            description: "Write a journal entry before bed today",
            type: .lifestyle,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30),
            timeGate: "After 8 PM"
        ),
        MissionTemplate(
            title: "Bed-Making Streak",
            description: "Make your bed within 5 minutes of waking",
            type: .lifestyle,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Hydration Check",
            description: "Drink 8 glasses of water by end of day",
            type: .lifestyle,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30),
            timeGate: "After 6 PM"
        ),
        MissionTemplate(
            title: "Same Lunch Time",
            description: "Eat lunch at the same time you ate yesterday",
            type: .lifestyle,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Daily Movement",
            description: "Complete a 10+ min stretch or movement session",
            type: .lifestyle,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Habit Log Update",
            description: "Track today in your habit log before bed",
            type: .lifestyle,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30),
            timeGate: "After 8 PM"
        ),
        MissionTemplate(
            title: "Same Workout Time",
            description: "Train at the same time of day as yesterday",
            type: .lifestyle,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        MissionTemplate(
            title: "Bedtime on Target",
            description: "Be in bed by your target bedtime",
            type: .lifestyle,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30),
            timeGate: "After 10 PM"
        ),
        MissionTemplate(
            title: "Repeat the Ritual",
            description: "Repeat yesterday's highest-impact ritual today",
            type: .lifestyle,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        )
    ]

    // MARK: - Lookup helper

    /// Convenience: return the pool for a given stat tag. Used by the Stat
    /// Rotation slot (Wave 1) to fetch the right pool for the weekday's
    /// scheduled stat.
    public static func pool(for stat: Stat) -> [MissionTemplate] {
        switch stat {
        case .social:      return socialUniversal
        case .discipline:  return disciplineUniversal
        case .focus:       return focusUniversal
        case .execution:   return executionUniversal
        case .consistency: return consistencyUniversal
        }
    }
}
