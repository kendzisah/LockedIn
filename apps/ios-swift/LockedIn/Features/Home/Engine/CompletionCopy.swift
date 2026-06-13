import Foundation

/// CompletionCopy — Streak checkpoint headlines + rotating completion lines.
///
/// Ported 1:1 from `apps/mobile/src/features/home/engine/CompletionCopy.ts`.
public enum CompletionCopy {
    public enum Phase: String {
        case executionBlock = "execution_block"
    }

    private static let executionBlockMessages: [String] = [
        "Distraction Resisted. Standard Raised.",
        "You chose focus.",
        "Execution over impulse.",
        "Discipline reinforced.",
        "You did what most avoid.",
    ]

    /// Pick a random completion message for the given phase.
    public static func completionMessage(for phase: Phase) -> String {
        switch phase {
        case .executionBlock:
            return executionBlockMessages.randomElement() ?? executionBlockMessages[0]
        }
    }

    public struct StreakCheckpoint: Equatable, Sendable {
        public let headline: String
        public let sub: String
        public let detail: String
        public let showWarning: Bool
    }

    /// Streak headline + sub + detail. Mirrors the RN tier breakpoints.
    public static func streakCheckpoint(streak: Int) -> StreakCheckpoint {
        let detail = "You've shown up \(streak) day\(streak == 1 ? "" : "s") in a row."
        let showWarning = streak >= 7

        let sub: String
        switch streak {
        case 90...:
            sub = "You became what you practiced."
        case 60..<90:
            sub = "Identity reinforced."
        case 30..<60:
            sub = "This is no longer temporary."
        case 14..<30:
            sub = "Standards rising."
        case 7..<14:
            sub = "Consistency forming."
        default:
            sub = "Momentum started."
        }

        return StreakCheckpoint(
            headline: "Consistency Is Compounding.",
            sub: sub,
            detail: detail,
            showWarning: showWarning
        )
    }
}
