import Foundation

/// OnboardingFlow — defines the 27 routes of the onboarding stack and their
/// step number used by the persistent `OnboardingProgressBar`.
///
/// Port of `apps/mobile/src/features/onboarding/hooks/useOnboardingTracking.ts`
/// (`SCREEN_STEP_MAP`, `ONBOARDING_SCREEN_ORDER`, `TOTAL_STEPS`).
///
/// Each case's `rawValue` is the exact RN route name from
/// `OnboardingStackParamList` (see `apps/mobile/src/types/navigation.ts`).
/// Workers downstream (deep linking, analytics, resume) consume these strings,
/// so they must NOT drift.
public enum OnboardingRoute: String, CaseIterable, Codable, Sendable, Identifiable {
    case definition          = "Definition"
    case phoneTimeQuiz       = "PhoneTimeQuiz"
    case wakeUpCall          = "WakeUpCall"
    case ageQuiz             = "AgeQuiz"
    case situation           = "Situation"
    case goalQuiz            = "GoalQuiz"
    case controlQuiz         = "ControlQuiz"
    case triggers            = "Triggers"
    case morningRoutine      = "MorningRoutine"
    case dailyTimeCommitment = "DailyTimeCommitment"
    case whyNow              = "WhyNow"
    case controlLevel        = "ControlLevel"
    case systemAnalysis      = "SystemAnalysis"
    case statReveal          = "StatReveal"
    case benefitExecution    = "BenefitExecution"
    case benefitMissions     = "BenefitMissions"
    case benefitRanks        = "BenefitRanks"
    case benefitGuilds       = "BenefitGuilds"
    case benefitReport       = "BenefitReport"
    case screenTimePreFrame  = "ScreenTimePreFrame"
    case notificationPreFrame = "NotificationPreFrame"
    case accountPrompt       = "AccountPrompt"
    /// Auth form lives in `Features/Auth/`; the routes share step 22 with
    /// `accountPrompt` so the progress bar doesn't jump when users tap in.
    ///
    /// We use **two** distinct cases (SignUp / SignIn) rather than a
    /// single `.onboardingAuth` route + external `authMode` state.
    /// NavigationStack caches destination views per-route, so swapping
    /// between SignUp ↔ SignIn via external state alone was unreliable
    /// (cached view stuck around, toggle silently no-op'd). Distinct
    /// routes make the toggle = a real pop + push, which NavigationStack
    /// handles cleanly — same pattern MainNavigator uses for the
    /// post-onboarding Settings flow.
    case onboardingSignUp    = "OnboardingSignUp"
    case onboardingSignIn    = "OnboardingSignIn"
    /// Legacy case retained so any persisted "OnboardingAuth" string from
    /// older builds still decodes. New code should push
    /// `.onboardingSignUp` or `.onboardingSignIn` directly.
    case onboardingAuth      = "OnboardingAuth"
    case commitment          = "Commitment"
    case scheduleSession     = "ScheduleSession"
    case socialProof         = "SocialProof"
    /// Paywall lives in `Features/Subscription/` — referenced here only as a
    /// route in the flow so the coordinator can hand off rendering.
    case paywall             = "Paywall"

    public var id: String { rawValue }

    /// Step number in the 26-step progress bar.
    /// `OnboardingAuth` shares step 22 with `AccountPrompt`.
    public var step: Int {
        switch self {
        case .definition:          return 1
        case .phoneTimeQuiz:       return 2
        case .wakeUpCall:          return 3
        case .ageQuiz:             return 4
        case .situation:           return 5
        case .goalQuiz:            return 6
        case .controlQuiz:         return 7
        case .triggers:            return 8
        case .morningRoutine:      return 9
        case .dailyTimeCommitment: return 10
        case .whyNow:              return 11
        case .controlLevel:        return 12
        case .systemAnalysis:      return 13
        case .statReveal:          return 14
        case .benefitExecution:    return 15
        case .benefitMissions:     return 16
        case .benefitRanks:        return 17
        case .benefitGuilds:       return 18
        case .benefitReport:       return 19
        case .screenTimePreFrame:  return 20
        case .notificationPreFrame: return 21
        case .accountPrompt:       return 22
        case .onboardingSignUp:    return 22
        case .onboardingSignIn:    return 22
        case .onboardingAuth:      return 22
        case .commitment:          return 23
        case .scheduleSession:     return 24
        case .socialProof:         return 25
        case .paywall:             return 26
        }
    }

    /// Routes that should hide the progress bar (intro / ritual / paywall).
    public var hidesProgressBar: Bool {
        switch self {
        case .definition, .commitment, .paywall: return true
        default: return false
        }
    }

    /// Mode passed to `OnboardingAuth` when navigating from `AccountPrompt`
    /// or the `Definition` sign-in escape.
    public enum AuthMode: String, Codable, Sendable {
        case signup
        case signin
    }
}

/// Total displayed steps. Mirrors RN `TOTAL_STEPS = 26`.
public let onboardingTotalSteps: Int = 26

/// Ordered list of routes used by the navigator stack (drop retired routes —
/// any persisted screen not in this list falls back to `.definition`).
public let onboardingScreenOrder: [OnboardingRoute] = [
    .definition,
    .phoneTimeQuiz,
    .wakeUpCall,
    .ageQuiz,
    .situation,
    .goalQuiz,
    .controlQuiz,
    .triggers,
    .morningRoutine,
    .dailyTimeCommitment,
    .whyNow,
    .controlLevel,
    .systemAnalysis,
    .statReveal,
    .benefitExecution,
    .benefitMissions,
    .benefitRanks,
    .benefitGuilds,
    .benefitReport,
    .screenTimePreFrame,
    .notificationPreFrame,
    .accountPrompt,
    .commitment,
    .scheduleSession,
    .socialProof,
    .paywall,
]
