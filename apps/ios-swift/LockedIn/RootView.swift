import AppIntentsKit
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
    /// Tracks whether the app has been backgrounded since the last foreground.
    /// Used to fire a `cold_start: false` `App Opened` only on genuine returns —
    /// iOS steps `.background → .inactive → .active`, so the `.active`
    /// transition alone can't distinguish a return from the launch sequence.
    @State private var wasBackgrounded = false
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
                // Remember we were backgrounded so the next `.active` can be
                // recognized as a real foreground return.
                if newPhase == .background { wasBackgrounded = true }

                // Sweep orphaned Live Activities every time we come back to
                // foreground — without this, a session that completed while
                // the app was backgrounded leaves the Lock Screen banner
                // stranded showing the last pushed `remainingSeconds`. The
                // sweep also runs at cold start (bootIfNeeded), but
                // backgrounded sessions never trigger that path.
                guard newPhase == .active else { return }

                // Foreground-return heartbeat. Gated on a prior background so it
                // doesn't double-fire with the cold-start `App Opened` at launch.
                if wasBackgrounded {
                    wasBackgrounded = false
                    AnalyticsService.shared.track("App Opened", properties: ["cold_start": false])
                }
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
                // Pending-start handoff (contract C4). `StartLockInIntent`
                // parks a request in the App Group when it runs in a process
                // that can't reach the session machinery (defensive extension
                // path — the QuickStart widget itself deep-links via
                // `onOpenURL` below). Consume it here (one-shot, age-capped)
                // on EVERY `.active`, which covers both a cold launch and a
                // background → foreground return.
                consumePendingIntentStartIfNeeded()
            }
            // QuickStart widget deep link (`lockedin://quickstart?minutes=N`).
            // The widget's tap target is a `widgetURL` — an interactive
            // `Button(intent:)` cannot foreground the app from the
            // widget-extension process (`ForegroundContinuableIntent` is
            // unavailable there), so the start REQUEST arrives here and runs
            // the same fully-gated start as the pending-intent handoff.
            .onOpenURL { url in
                handleQuickStartDeepLink(url)
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

    /// Consume a start request parked by `StartLockInIntent` when it ran in
    /// a process without the service locator (defensive extension handoff —
    /// the QuickStart widget itself deep-links via `onOpenURL`). The pending
    /// start is a HANDOFF, not an authorization —
    /// `startExternallyRequestedSession` re-runs every gate (subscription,
    /// active-session check, Family Controls, allowlist) in this process, so
    /// a stale/forged payload can't bypass anything. A 2-minute age cap keeps
    /// a tap the user abandoned from surprise-starting a session on a much
    /// later foreground.
    private func consumePendingIntentStartIfNeeded() {
        guard let minutes = LockInAppGroupGate.consumePendingStart(maxAgeSeconds: 120) else { return }
        startExternallyRequestedSession(minutes: minutes)
    }

    /// Ceiling for a deep-link-requested duration — matches the in-app
    /// duration picker's 23 h 59 m maximum. The URL scheme is an
    /// unauthenticated surface (any app or tapped link can open it), so an
    /// out-of-range `minutes` must not exceed what the user could pick
    /// in-app — without the clamp, `lockedin://quickstart?minutes=43200`
    /// silently starts a 30-day lock-in.
    private static let maximumExternalStartMinutes = 24 * 60 - 1

    /// Handle the QuickStart widget's `widgetURL` deep link
    /// (`lockedin://quickstart?minutes=N`). The URL is a REQUEST, not an
    /// authorization — the shared gated start below re-runs every gate.
    /// Host/query literals are duplicated in `QuickStartWidget` — keep in
    /// lockstep.
    private func handleQuickStartDeepLink(_ url: URL) {
        guard url.scheme?.lowercased() == "lockedin",
              url.host?.lowercased() == "quickstart" else { return }
        let requested = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "minutes" })?
            .value
            .flatMap(Int.init) ?? 25
        startExternallyRequestedSession(
            minutes: min(
                max(StartLockInIntent.minimumMinutes, requested),
                Self.maximumExternalStartMinutes
            )
        )
    }

    /// Shared gated start for EXTERNALLY requested sessions (widget deep
    /// link + pending-intent handoff). The App Group entitlement mirror can
    /// go stale while the app is closed (it is only rewritten when this app
    /// evaluates the entitlement), so wait — bounded — for this process's
    /// own RevenueCat bootstrap and refuse on the FRESH value instead of
    /// starting a Pro session for an expired subscriber off the stale
    /// mirror. If bootstrap never resolves (missing API key / offline hang),
    /// fall through after the cap: `startSession` still re-checks the
    /// mirror, which fails closed for never-subscribed installs.
    private func startExternallyRequestedSession(minutes: Int) {
        Task {
            // ~10s cap — bootIfNeeded's RevenueCat round-trip is normally
            // seconds away in this same process.
            for _ in 0..<40 where subscription.isLoading {
                try? await Task.sleep(nanoseconds: 250_000_000)
            }
            if !subscription.isLoading, !subscription.isSubscribed { return }
            // Gate refusals throw `IntentServiceError`. There is no Siri
            // dialog to surface here, so SETUP refusals (Family Controls
            // revoked / empty allowlist) are forwarded to `MainNavigator`,
            // which presents the same `LockInSetupSheet` the in-app flow
            // uses — otherwise a subscribed-but-unconfigured user's widget
            // tap foregrounds an idle Home and looks dead, every time.
            // Everything else stays swallowed: the impl already tracks
            // `intent_refused`, and the successful path posts
            // `lockedInSessionExternallyStarted` so the navigator presents
            // the timer.
            do {
                try await LockInIntentServiceLocator.shared?.startSession(durationMinutes: minutes)
            } catch let error as IntentServiceError {
                switch error {
                case .notAuthorized, .setupRequired:
                    NotificationCenter.default.post(
                        name: .lockedInExternalStartSetupRequired,
                        object: nil
                    )
                default:
                    break
                }
            } catch {}
        }
    }

    private func bootIfNeeded() async {
        guard !didBoot else { return }
        didBoot = true

        // Configure analytics before anything else fires events.
        AnalyticsService.shared.configure()

        // Fix 13 (contract C5): route the Siri / Shortcuts "end lock-in"
        // intent through the LIVE in-app engine. Without this hook the
        // intent only tore down the persisted shield state while the engine
        // kept counting — and later credited a full "natural" completion for
        // a session the user explicitly ended. Returns `false` when no
        // engine is live so the impl falls back to persisted-state teardown.
        if let impl = LockInIntentServiceLocator.shared as? LockInIntentServiceImpl {
            impl.endActiveSessionHook = { [weak store = activeSession] in
                guard let store, store.isActive else { return false }
                // Hardcore = no early exit and no breaks (Fix 2). Siri /
                // Shortcuts must not be the one entry point that can end a
                // hardcore session — refuse with a concrete dialog instead
                // of tearing it down.
                guard !store.hardcore else { throw IntentServiceError.hardcoreLocked }
                store.endEarly()
                return true
            }
            // Live-engine visibility for the intent start gate: a PROMOTED
            // scheduled session deliberately persists no manual block, and a
            // fresh start's block lands on an async hop — so the App Group
            // signals alone can't always prove "idle". Defect #6 hardening.
            impl.isSessionLiveHook = { [weak store = activeSession] in
                store?.isActive ?? false
            }
        }

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

        // The ACTIVE session cleans up on logout too. Without this a session
        // (or a mid-break break-resume monitor) survives sign-out: the OS
        // re-shields the signed-out user at break end with no session surface
        // to end it, and the engine keeps ticking behind the auth navigator
        // until its fixed end credits whatever account signs in next.
        // `fullReset` cancels the engine WITHOUT crediting and tears down the
        // shield, monitors, persisted state, and notifications.
        LogoutCleanupBus.shared.subscribe { [activeSession] _ in
            activeSession.fullReset()
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

        // Per-launch heartbeat. Fired once after identity is established so it
        // attributes to the signed-in user. Foreground returns emit their own
        // `App Opened` with `cold_start: false` from the scenePhase handler.
        AnalyticsService.shared.track("App Opened", properties: ["cold_start": true])

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
