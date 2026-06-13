//
//  TateQuotes.swift
//  LockedIn — Session / Lock-In feature
//
//  Discipline quotes (Andrew Tate voice) shown by the "Pause Protocol" gate on
//  the lock-in timer to discourage taking a break. Picked at random each time.
//

import Foundation

public enum TateQuotes {
    public static let all: [String] = [
        "The temptation to quit will be greatest just before you are about to succeed.",
        "Discipline is doing what you hate to do but doing it like you love it.",
        "You're one decision away from a completely different life. Don't break now.",
        "Hard work and discipline. There is no secret. Sit back down and finish.",
        "The man who can push through when his mind says stop is the man who wins.",
        "Comfort is the enemy. A break is just comfort whispering your name. Ignore it.",
        "Your brain wants to stop because stopping is easy. Easy is for losers.",
        "Every time you quit, you teach your brain that quitting is an option. Don't.",
        "Champions are made in the moments they wanted to stop but didn't.",
        "What is a break? A reward you haven't earned yet. Get back to work.",
        "The matrix wants you distracted. Staying locked in is your rebellion.",
    ]

    /// A random quote, never empty.
    public static func random() -> String {
        all.randomElement() ?? all[0]
    }
}
