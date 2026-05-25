//
//  OnboardingNavigator.swift
//  LockedIn
//
//  Owns the 27-route onboarding stack. Drives forward through
//  `onboardingScreenOrder`; renders the persistent `OnboardingProgressBar`
//  above the active route.
//
//  Notes on cross-feature routes:
//   - `OnboardingAuth` mode `signup` → renders `Features/Auth/Screens/SignUpScreen`.
//   - `OnboardingAuth` mode `signin` → renders `Features/Auth/Screens/SignInScreen`.
//   - `Paywall` → renders `Features/Subscription/Screens/PaywallScreen`.
//

import SwiftUI
import DesignKit

@MainActor
public struct OnboardingNavigator: View {
    @Environment(OnboardingState.self) private var onboarding
    @Environment(AuthState.self) private var auth
    @Environment(SubscriptionState.self) private var subscription

    @State private var path: [OnboardingRoute] = []
    @State private var authMode: OnboardingRoute.AuthMode = .signup

    public init() {}

    private var rootRoute: OnboardingRoute {
        // Resume-on-restart: if we have a persisted screen, use it.
        OnboardingState.persistedScreen() ?? .definition
    }

    private var activeRoute: OnboardingRoute {
        path.last ?? rootRoute
    }

    public var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                OnboardingProgressBar(route: rootRoute)
                screenView(for: rootRoute)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: OnboardingRoute.self) { route in
                VStack(spacing: 0) {
                    OnboardingProgressBar(route: route)
                    screenView(for: route)
                }
                .toolbar(.hidden, for: .navigationBar)
            }
        }
        .background(AppColors.background.ignoresSafeArea())
    }

    // MARK: - Routing

    private func advance(from current: OnboardingRoute) {
        // Find the next route in the canonical ordering. Auth route shares
        // step 22 with AccountPrompt and is reached via push instead of via
        // the linear ordering.
        guard let index = onboardingScreenOrder.firstIndex(of: current) else {
            return
        }
        let next = index + 1 < onboardingScreenOrder.count
            ? onboardingScreenOrder[index + 1]
            : onboardingScreenOrder.last!
        if next != current {
            path.append(next)
        }
    }

    private func push(_ route: OnboardingRoute) {
        path.append(route)
    }

    private func goBack() {
        if !path.isEmpty { path.removeLast() }
    }

    // MARK: - Screen factory

    @ViewBuilder
    private func screenView(for route: OnboardingRoute) -> some View {
        switch route {
        case .definition:
            DefinitionScreen(
                onContinue: { advance(from: .definition) },
                onSignIn: { authMode = .signin; push(.onboardingAuth) }
            )
        case .phoneTimeQuiz:
            PhoneTimeQuizScreen(onContinue: { advance(from: .phoneTimeQuiz) })
        case .wakeUpCall:
            WakeUpCallScreen(onContinue: { advance(from: .wakeUpCall) })
        case .ageQuiz:
            AgeQuizScreen(onContinue: { advance(from: .ageQuiz) })
        case .situation:
            SituationScreen(onContinue: { advance(from: .situation) })
        case .goalQuiz:
            GoalQuizScreen(onContinue: { advance(from: .goalQuiz) })
        case .controlQuiz:
            ControlQuizScreen(onContinue: { advance(from: .controlQuiz) })
        case .triggers:
            TriggersScreen(onContinue: { advance(from: .triggers) })
        case .morningRoutine:
            MorningRoutineScreen(onContinue: { advance(from: .morningRoutine) })
        case .dailyTimeCommitment:
            DailyTimeCommitmentScreen(onContinue: { advance(from: .dailyTimeCommitment) })
        case .whyNow:
            WhyNowScreen(onContinue: { advance(from: .whyNow) })
        case .controlLevel:
            ControlLevelScreen(onContinue: { advance(from: .controlLevel) })
        case .systemAnalysis:
            SystemAnalysisScreen(onContinue: { advance(from: .systemAnalysis) })
        case .statReveal:
            StatRevealScreen(onContinue: { advance(from: .statReveal) })
        case .benefitExecution:
            BenefitExecutionScreen(onContinue: { advance(from: .benefitExecution) })
        case .benefitMissions:
            BenefitMissionsScreen(onContinue: { advance(from: .benefitMissions) })
        case .benefitRanks:
            BenefitRanksScreen(onContinue: { advance(from: .benefitRanks) })
        case .benefitGuilds:
            BenefitGuildsScreen(onContinue: { advance(from: .benefitGuilds) })
        case .benefitReport:
            BenefitReportScreen(onContinue: { advance(from: .benefitReport) })
        case .screenTimePreFrame:
            ScreenTimePreFrameScreen(
                onContinue: { advance(from: .screenTimePreFrame) },
                requestPermission: {
                    let auth = await LockModeService.shared.requestAuthorization()
                    switch auth {
                    case .approved: return .granted
                    case .denied:   return .denied
                    default:        return .unavailable
                    }
                },
                showAppPicker: {
                    _ = await LockModeService.shared.showAppPicker()
                }
            )
        case .notificationPreFrame:
            NotificationPreFrameScreen(
                onContinue: { advance(from: .notificationPreFrame) },
                requestPermission: {
                    await NotificationService.shared.requestAuthorization()
                },
                scheduleDailyNotifications: {
                    NotificationService.shared.scheduleAllDailyNotifications(
                        streak: 0,
                        hasGuild: false,
                        goalMinutes: onboarding.dailyMinutes ?? 60,
                        reminderTime: HourMinute(hour: 9, minute: 0)
                    )
                }
            )
        case .accountPrompt:
            AccountPromptScreen(
                onCreateAccount: { authMode = .signup; push(.onboardingAuth) },
                onSignIn: { authMode = .signin; push(.onboardingAuth) },
                onMaybeLater: { advance(from: .accountPrompt) }
            )
        case .onboardingAuth:
            authView
        case .commitment:
            CommitmentScreen(onContinue: { advance(from: .commitment) })
        case .scheduleSession:
            ScheduleSessionScreen(
                onContinue: { advance(from: .scheduleSession) },
                scheduleNotification: { hour, minute in
                    NotificationService.shared.scheduleDailyReminder(
                        at: HourMinute(hour: hour, minute: minute)
                    )
                }
            )
        case .socialProof:
            SocialProofScreen(onContinue: { advance(from: .socialProof) })
        case .paywall:
            PaywallScreen(
                scheduledSessionTime: onboarding.scheduledSessionTime,
                onComplete: { subscribed in
                    AnalyticsService.shared.track(
                        OnboardingAnalytics.completed,
                        properties: ["subscribed": subscribed]
                    )
                    onboarding.completeOnboarding()
                }
            )
        }
    }

    @ViewBuilder
    private var authView: some View {
        switch authMode {
        case .signup:
            SignUpScreen(
                goToSignIn: { authMode = .signin },
                continueAsGuest: { goBack(); advance(from: .accountPrompt) },
                onSignedUp: { goBack(); advance(from: .accountPrompt) }
            )
        case .signin:
            SignInScreen(
                goToSignUp: { authMode = .signup },
                continueAsGuest: { goBack(); advance(from: .accountPrompt) },
                onSignedIn: { goBack(); advance(from: .accountPrompt) }
            )
        }
    }
}
