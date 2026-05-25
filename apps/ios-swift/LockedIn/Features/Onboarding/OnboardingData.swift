import Foundation
import SwiftUI
import DesignKit

/// OnboardingData — static quiz options + copy.
///
/// Each option list mirrors the inline `OPTIONS: ...` arrays in the
/// matching RN screen file. Values must remain byte-for-byte aligned with
/// `apps/mobile/src/features/onboarding/screens/*Screen.tsx` because they
/// drive downstream features (Mission generation reads `primaryGoal` as a
/// string, etc.).
public enum OnboardingData {

    // MARK: - Step 2: Phone Time

    public struct PhoneTimeOption: Identifiable {
        public let value: String
        public let label: String
        /// Battery fill level shown in the leading icon (0…1).
        public let battery: Double
        public var id: String { value }
    }

    public static let phoneTimeOptions: [PhoneTimeOption] = [
        .init(value: "2 hours", label: "2–3 hours", battery: 0.85),
        .init(value: "4 hours", label: "4–5 hours", battery: 0.5),
        .init(value: "6 hours", label: "6–7 hours", battery: 0.25),
        .init(value: "8 hours", label: "8+ hours",  battery: 0.08),
    ]

    // MARK: - Step 4: Age band

    public struct AgeOption: Identifiable {
        public let value: Int
        public let label: String
        public var id: Int { value }
    }

    public static let ageOptions: [AgeOption] = [
        .init(value: 14, label: "13–15"),
        .init(value: 17, label: "16–18"),
        .init(value: 20, label: "19–21"),
        .init(value: 23, label: "22–25"),
        .init(value: 28, label: "25+"),
    ]

    // MARK: - Step 5: Situation

    public struct SituationOption: Identifiable {
        public let value: Situation
        public let label: String
        public let icon: String   // SF Symbol name
        public var id: String { value.rawValue }
    }

    public static let situationOptions: [SituationOption] = [
        .init(value: .student,      label: "Student",              icon: "book.fill"),
        .init(value: .working,      label: "Working",              icon: "briefcase.fill"),
        .init(value: .figuring,     label: "Figuring it out",      icon: "magnifyingglass"),
        .init(value: .building,     label: "Building something",   icon: "paperplane.fill"),
        .init(value: .startingOver, label: "Starting over",        icon: "arrow.counterclockwise"),
    ]

    // MARK: - Step 6: Primary Goal

    public struct GoalOption: Identifiable {
        public let value: String
        public let icon: String
        public var id: String { value }
    }

    public static let goalOptions: [GoalOption] = [
        .init(value: "Improve my physique",                icon: "dumbbell.fill"),
        .init(value: "Build a business or side project",   icon: "briefcase.fill"),
        .init(value: "Increase discipline & self-control", icon: "brain.head.profile"),
        .init(value: "Advance my career",                  icon: "chart.line.uptrend.xyaxis"),
        .init(value: "Study with consistency",             icon: "book.fill"),
        .init(value: "Reduce distractions",                icon: "shield.slash.fill"),
        .init(value: "Improve emotional control",          icon: "wind"),
    ]

    // MARK: - Step 7: Control Quiz (weaknesses, multi-select up to 2)

    public struct WeaknessOption: Identifiable {
        public let value: String
        public let icon: String
        public var id: String { value }
    }

    public static let weaknessMaxSelect: Int = 2

    public static let weaknessOptions: [WeaknessOption] = [
        .init(value: "I scroll when I should execute", icon: "iphone"),
        .init(value: "I start strong, then fall off",  icon: "flame.fill"),
        .init(value: "I get emotionally reactive",     icon: "bolt.circle.fill"),
        .init(value: "I relapse into distractions",    icon: "gamecontroller.fill"),
        .init(value: "I lack daily consistency",       icon: "chart.line.downtrend.xyaxis"),
    ]

    // MARK: - Step 8: Triggers (multi-select up to 3)

    public struct TriggerOption: Identifiable {
        public let value: Trigger
        public let label: String
        public let icon: String
        public var id: String { value.rawValue }
    }

    public static let triggersMaxSelect: Int = 3

    public static let triggerOptions: [TriggerOption] = [
        .init(value: .morning,      label: "First thing in the morning", icon: "sun.max.fill"),
        .init(value: .lateNight,    label: "Late at night",              icon: "moon.fill"),
        .init(value: .aroundOthers, label: "When I'm around others",     icon: "person.2.fill"),
        .init(value: .boredAlone,   label: "When I'm bored or alone",    icon: "cloud.fill"),
        .init(value: .afterStress,  label: "After stressful moments",    icon: "bolt.fill"),
        .init(value: .duringBreaks, label: "During breaks",              icon: "cup.and.saucer.fill"),
    ]

    // MARK: - Step 9: Morning Routine

    public struct MorningRoutineOption: Identifiable {
        public let value: MorningRoutine
        public let label: String
        public let icon: String
        public var id: String { value.rawValue }
    }

    public static let morningRoutineOptions: [MorningRoutineOption] = [
        .init(value: .checkPhone,          label: "Check my phone",     icon: "iphone"),
        .init(value: .scrollNotifications, label: "Scroll notifications", icon: "bell.badge.fill"),
        .init(value: .snooze,              label: "Snooze the alarm",   icon: "alarm.fill"),
        .init(value: .getUp,               label: "Get up and move",    icon: "sunrise.fill"),
    ]

    public struct MorningFlash {
        public let text: String
        public let color: Color
    }

    public static func morningFlash(for value: MorningRoutine) -> MorningFlash {
        switch value {
        case .checkPhone, .scrollNotifications:
            return .init(text: "// NOTED — MORNING VULNERABILITY DETECTED", color: SystemTokens.red)
        case .snooze:
            return .init(text: "// NOTED — CONSISTENCY DEFICIT", color: SystemTokens.gold)
        case .getUp:
            return .init(text: "// NOTED — STRONG FOUNDATION", color: SystemTokens.green)
        }
    }

    // MARK: - Step 10: Daily Time Commitment

    public struct DailyMinuteOption: Identifiable {
        public let minutes: Int
        public let primary: String
        public let unit: String
        public var id: Int { minutes }
    }

    public static let dailyMinuteOptions: [DailyMinuteOption] = [
        .init(minutes: 15,  primary: "15",  unit: "min"),
        .init(minutes: 30,  primary: "30",  unit: "min"),
        .init(minutes: 45,  primary: "45",  unit: "min"),
        .init(minutes: 60,  primary: "1",   unit: "h"),
        .init(minutes: 90,  primary: "1.5", unit: "h"),
        .init(minutes: 120, primary: "2",   unit: "h"),
    ]

    // MARK: - Step 11: Why Now

    public struct WhyNowOption: Identifiable {
        public let value: WhyNow
        public let label: String
        public let icon: String
        public var id: String { value.rawValue }
    }

    public static let whyNowOptions: [WhyNowOption] = [
        .init(value: .tiredWasting,       label: "I'm tired of wasting time",          icon: "exclamationmark.triangle.fill"),
        .init(value: .failingGoal,        label: "I have a goal I keep failing at",    icon: "target"),
        .init(value: .someoneAhead,       label: "Someone I respect is ahead of me",   icon: "person.2.fill"),
        .init(value: .needAccountability, label: "I need accountability",              icon: "shield.fill"),
        .init(value: .proveSomething,     label: "I want to prove something",          icon: "flame.fill"),
    ]

    // MARK: - Step 12: Control Level

    public struct ControlLevelOption: Identifiable {
        public let value: ControlLevel
        public let label: String
        public let icon: String
        public var id: String { value.rawValue }
    }

    public static let controlLevelOptions: [ControlLevelOption] = [
        .init(value: .almostNone, label: "Almost none — I react to everything", icon: "exclamationmark.circle.fill"),
        .init(value: .some,       label: "Some — but I slip often",             icon: "minus.circle.fill"),
        .init(value: .decent,     label: "Decent — I just need structure",      icon: "checkmark.circle.fill"),
        .init(value: .strong,     label: "Strong — I need the next level",      icon: "arrow.up.circle.fill"),
    ]

    // MARK: - Step 14: StatReveal rows

    public struct StatRevealRow: Identifiable {
        public let abbr: String
        public let label: String
        public let colorHex: String
        public var id: String { abbr }
        public var color: Color { Color(hex: colorHex) }
    }

    public static let statRevealRows: [StatRevealRow] = [
        .init(abbr: "DIS", label: "Discipline",  colorHex: "#3A66FF"),
        .init(abbr: "FOC", label: "Focus",       colorHex: "#0BC2F7"),
        .init(abbr: "EXE", label: "Execution",   colorHex: "#00D65F"),
        .init(abbr: "CON", label: "Consistency", colorHex: "#FFCB57"),
        .init(abbr: "SOC", label: "Social",      colorHex: "#AB55F7"),
    ]

    public static let startingStat: Int = 1
    public static let maxStat: Int = 99

    // MARK: - Step 26: Paywall feature list

    public struct PaywallFeature: Identifiable {
        public let icon: String
        public let label: String
        public var id: String { label }
    }

    public static let paywallFeatures: [PaywallFeature] = [
        .init(icon: "lock.fill",                 label: "Unlimited focus sessions"),
        .init(icon: "bolt.fill",                 label: "Daily personalized missions"),
        .init(icon: "chart.bar.fill",            label: "Full OVR & stat tracking"),
        .init(icon: "trophy.fill",               label: "Rank progression system"),
        .init(icon: "person.2.fill",             label: "Guild leaderboards"),
        .init(icon: "doc.text.fill",             label: "Weekly system reports"),
        .init(icon: "shield.fill",               label: "Streak recovery (1x/week)"),
    ]

    // MARK: - Step 25: Social Proof

    public struct SocialStatCard: Identifiable {
        public let value: String
        public let lines: [String]
        public var id: String { value }
    }

    public static let socialStats: [SocialStatCard] = [
        .init(value: "12K+",  lines: ["USERS", "LOCKED IN"]),
        .init(value: "2.4M+", lines: ["FOCUS", "MINUTES"]),
        .init(value: "28",    lines: ["AVG STREAK", "DAYS"]),
    ]

    public struct Testimonial: Identifiable {
        public let quote: String
        public let author: String
        public var id: String { author }
    }

    public static let testimonials: [Testimonial] = [
        .init(quote: "Went from 8 hours screen time to 2. OVR 74.",          author: "Marcus, 19"),
        .init(quote: "Day 47. Chosen. Never going back.",                    author: "Jayden, 17"),
        .init(quote: "My guild keeps me accountable. Can't let them down.", author: "Lance, 22"),
    ]

    // MARK: - Step 22: AccountPrompt benefits

    public static let accountPromptBenefits: [String] = [
        "Your rank and OVR are saved permanently",
        "Never lose your streak — even if you switch phones",
        "Save every XP point and achievement you earn",
        "Compete in guild leaderboards with your guild",
        "Get personalized weekly system reports",
        "Sync your stats across multiple devices",
        "Customize your display name and avatar",
    ]

    public static let signupPromptDismissedKey = "@lockedin/signup_prompt_dismissed"

    // MARK: - Step 24: ScheduleSession picker ranges

    public static let scheduleHours: [Int] = Array(0..<24)
    public static let scheduleMinutes: [Int] = [0, 15, 30, 45]

    /// Identifier for the locally scheduled "first session" notification.
    /// Matches the RN constant in `ScheduleSessionScreen.tsx`.
    public static let firstSessionNotifId = "@lockedin/first_session_reminder"

    // MARK: - Step 23: Commitment screen blocks

    public struct CommitmentLine {
        public let text: String
        public let color: Color
        public let bold: Bool
        public init(text: String, color: Color, bold: Bool = false) {
            self.text = text
            self.color = color
            self.bold = bold
        }
    }

    public struct CommitmentBlock: Identifiable {
        public let id = UUID()
        public let delay: Double
        public let lines: [CommitmentLine]
    }

    public static let commitmentBlocks: [CommitmentBlock] = [
        .init(delay: 0, lines: [
            .init(text: "Right now, someone your age",     color: AppColors.textPrimary,   bold: true),
            .init(text: "is putting in the work you keep", color: AppColors.textPrimary,   bold: true),
            .init(text: "putting off.",                     color: AppColors.danger,        bold: true),
        ]),
        .init(delay: 2.0, lines: [
            .init(text: "They're locking in while",        color: AppColors.textSecondary),
            .init(text: "you're still deciding.",          color: AppColors.textSecondary),
        ]),
        .init(delay: 3.5, lines: [
            .init(text: "Every day you skip,",             color: AppColors.textPrimary),
            .init(text: "they pull further ahead.",        color: AppColors.danger),
        ]),
        .init(delay: 5.0, lines: [
            .init(text: "Greatness isn't a talent.",       color: AppColors.accent, bold: true),
            .init(text: "It's a decision.",                color: AppColors.accent, bold: true),
        ]),
        .init(delay: 6.0, lines: [
            .init(text: "[ SYSTEM READY ]",                color: AppColors.accent, bold: true),
            .init(text: "Awaiting Player input...",        color: AppColors.textSecondary),
        ]),
    ]

    public static let commitmentCTADelay: Double = 7.2
}
