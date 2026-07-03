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
    @State private var scheduledSessions = ScheduledSessionsStore()
    @State private var activeSession = ActiveSessionStore()

    @Environment(\.scenePhase) private var scenePhase
    @State private var didBoot = false
    @State private var scheduledCreditSummary: String?

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
            .environment(scheduledSessions)
            .environment(activeSession)
            .task {
                await bootIfNeeded()
            }
            // Present the ATT opt-in prompt once the scene is active. Kept in a
            // separate `.task` so it isn't queued behind `bootIfNeeded()`'s
            // network work — AppsFlyer is waiting on this decision (up to 10s).
            .task {
                await TrackingAuthorization.requestIfNeeded()
            }
            .onReceive(NotificationCenter.default.publisher(for: .lockedInScheduledSessionsCredited)) { note in
                let count = (note.userInfo?["count"] as? Int) ?? 0
                guard count > 0 else { return }
                scheduledCreditSummary = count == 1
                    ? "1 scheduled session credited"
                    : "\(count) scheduled sessions credited"
                Task {
                    try? await Task.sleep(nanoseconds: 3_500_000_000)
                    scheduledCreditSummary = nil
                }
            }
            .onChange(of: scenePhase) { _, newPhase in
                // Sweep orphaned Live Activities every time we come back to
                // foreground — without this, a session that completed while
                // the app was backgrounded leaves the Lock Screen banner
                // stranded showing the last pushed `remainingSeconds`. The
                // sweep also runs at cold start (bootIfNeeded), but
                // backgrounded sessions never trigger that path.
                guard newPhase == .active else { return }
                if #available(iOS 16.2, *) {
                    SessionEngine.performColdStartLiveActivitySweep()
                }
                // Catch a streak broken across midnight while the app was
                // open-but-backgrounded — `reconcileStreak()` is idempotent.
                if home.isHydrated { home.reconcileStreak() }
                // Month-end guild nudge + re-arm the reset reminder (rolls it
                // to next month after it fires). Both gate on the cached
                // has-guild flag, so no network call here.
                let hasGuild = Defaults.bool(GuildService.hasActiveGuildKey)
                guild.evaluateMonthEndPrompt()
                NotificationService.shared.scheduleGuildMonthEndReminder(hasActiveGuild: hasGuild)
            }
            // Global achievement-unlock toast. Listens for the
            // `.achievementsUnlocked` notification and queues one toast per
            // newly-earned id so the user sees every badge, not just the
            // last one in the batch.
            .overlay(alignment: .top) {
                AchievementUnlockToastHost()
                    .allowsHitTesting(true)
            }
            .overlay(alignment: .top) {
                if let summary = scheduledCreditSummary {
                    Text(summary)
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 13))
                        .foregroundColor(SystemTokens.textPrimary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(SystemTokens.panelBg)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(SystemTokens.glowAccent.opacity(0.4), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .padding(.top, 8)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .allowsHitTesting(false)
                }
            }
            .animation(.easeInOut(duration: 0.25), value: scheduledCreditSummary)
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

        // Wire the widget-snapshot provider closures BEFORE hydration so the
        // first `publishWidgetSnapshot()` call (inside `home.hydrate()`) sees
        // accurate `nextMissionTitle` and `dailyGoalMinutes` values instead of
        // the nil / 60-default fallback.
        home.nextMissionTitleProvider = { [weak missions] in
            missions?.nextMissionTitle
        }
        home.dailyGoalMinutesProvider = { [weak onboarding] in
            onboarding?.dailyMinutes ?? 60
        }

        // Scheduled lock-in sessions clean up on logout too (stops auto-block
        // schedules + cancels their notifications).
        LogoutCleanupBus.shared.subscribe { [scheduledSessions] _ in
            scheduledSessions.fullReset()
        }

        // Hydrate persisted state up-front.
        await onboarding.hydrate()
        home.hydrate()
        missions.hydrate()
        session.hydrateFromDefaults()
        // Loads schedules + re-registers DeviceActivity auto-block + notifications.
        scheduledSessions.hydrate()

        // Live Activity cold-start cleanup. If a session id from a prior
        // launch is still in the App Group but no active execution block
        // exists, the user killed the app mid-session and we have an
        // orphaned Lock Screen banner to dismiss.
        if #available(iOS 16.2, *) {
            SessionEngine.performColdStartLiveActivitySweep()
        }

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
                "current_rank_id": RankHelpers.rankFromXp(
                    HomeService.shared.getCachedStats()?.totalRankXp ?? 0
                ).id.rawValue,
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

        // Arm the month-end guild reminder + surface the nudge if today is the
        // last day of the month. Gated on the cached has-guild flag.
        let hasGuild = Defaults.bool(GuildService.hasActiveGuildKey)
        NotificationService.shared.scheduleGuildMonthEndReminder(hasActiveGuild: hasGuild)
        guild.evaluateMonthEndPrompt()
    }
}

#Preview {
    RootView()
}
