import SwiftUI
import DesignKit

/// Root SwiftUI view. Hosts every @Observable state object as an
/// `.environment(...)` injection and renders the active navigator
/// (`RootNavigator` decides between Onboarding vs Main).
struct RootView: View {
    @State private var auth          = AuthState()
    @State private var onboarding    = OnboardingState()
    @State private var home          = HomeState()
    @State private var missions      = MissionsState()
    @State private var session       = SessionState()
    @State private var guild         = GuildState()
    @State private var subscription  = SubscriptionState()
    @State private var settings      = SettingsState()

    @State private var didBoot = false

    var body: some View {
        RootNavigator()
            .environment(auth)
            .environment(onboarding)
            .environment(home)
            .environment(missions)
            .environment(session)
            .environment(guild)
            .environment(subscription)
            .environment(settings)
            .task {
                await bootIfNeeded()
            }
    }

    private func bootIfNeeded() async {
        guard !didBoot else { return }
        didBoot = true

        // Configure analytics before anything else fires events.
        AnalyticsService.shared.configure()

        // Subscribe every state object to the logout cleanup bus once.
        LogoutCleanupBus.shared.subscribeAll(
            home: home,
            missions: missions,
            session: session,
            onboarding: onboarding,
            guild: guild,
            subscription: subscription
        )

        // Hydrate persisted state up-front.
        await onboarding.hydrate()
        home.hydrate()
        missions.hydrate()
        session.hydrateFromDefaults()

        // Boot auth (anonymous fallback + listener).
        await auth.start()

        // Identify PostHog + register super-properties once we have a user.
        if let user = auth.user {
            AnalyticsService.shared.identify(userId: user.id.uuidString)
            AnalyticsService.shared.registerSuperProperties([
                "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown",
                "os_version": UIDevice.current.systemVersion,
                "is_subscribed": subscription.isSubscribed,
                "current_streak": home.consecutiveStreak,
                "current_rank_id": RankHelpers.rankFromStreak(home.consecutiveStreak).id.rawValue,
            ])
            AnalyticsService.shared.setUserPropertiesOnce([
                "first_seen": ISO8601DateFormatter().string(from: Date()),
            ])
        }

        // Boot RevenueCat — `LockedInApp.configureSDKs` already called
        // `Purchases.configure(...)`; the SubscriptionState.bootstrap binds
        // the listener and reads the initial customer info.
        if let key = LockedInConfig.string(.revenueCatIOSAPIKey) {
            await subscription.bootstrap(apiKey: key)
            await subscription.syncAuthIdentity(uuid: auth.user?.id.uuidString)
        }

        // Push current onboarding state into missions feature so the user's
        // goal / weaknesses are used during mission generation.
        if let goal = onboarding.primaryGoal { missions.userGoal = goal }
        missions.userWeaknesses = onboarding.selectedWeaknesses
        missions.streak = home.consecutiveStreak

        // Cache the streak for the notification scheduler.
        Defaults.setInt(home.consecutiveStreak, "@lockedin/streak_for_notifs")
        Defaults.setInt(onboarding.dailyMinutes ?? 60, "@lockedin/daily_minutes")
    }
}

#Preview {
    RootView()
}
