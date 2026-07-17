//
//  MainNavigator.swift
//  LockedIn
//
//  Mirrors `MainNavigator.tsx` from the RN app. Wraps the bottom `TabNavigator`
//  and exposes a stack-pushed routes layer for the modals and pushes that
//  live above tabs:
//   - PaywallOffer, PaywallOnboarding (sheet/fullscreen modal)
//   - ExecutionBlock, SessionComplete (driven by LockInCoordinator)
//   - SignUp, SignIn, EditProfile (full-screen modals)
//   - WeeklyReport (full-screen modal)
//   - GuildDetail / CreateGuild / JoinGuild (pushed stack routes)
//
//  We use a `MainNavigatorPath` object-environment so any screen can push a
//  detail route by mutating `mainStack.path.append(...)`.
//

import SwiftUI
import DesignKit

/// Routes pushed onto the main navigation stack.
public enum MainStackRoute: Hashable {
    case signUp
    case signIn
    case editProfile
    case guildDetail(guildId: String)
    case createGuild
    case joinGuild
    case weeklyReport
    case scheduledSessions
}

/// Holds the navigation stack path. Provided as `@EnvironmentObject` so child
/// screens can push detail routes without owning a binding.
@MainActor
public final class MainNavigatorPath: ObservableObject {
    @Published public var path: [MainStackRoute] = []
    public init() {}
}

@MainActor
public struct MainNavigator: View {
    /// Guards one-time, process-lifetime NotificationCenter registrations so a
    /// MainNavigator re-mount (e.g. a logout→login cycle swaps the navigator
    /// back to Main) can't stack duplicate observers that double-count events.
    private static var didRegisterAnalyticsObservers = false

    @Environment(AuthState.self) private var auth
    @Environment(HomeState.self) private var home
    @Environment(MissionsState.self) private var missions
    @Environment(OnboardingState.self) private var onboarding
    @Environment(GuildState.self) private var guild
    @Environment(SubscriptionState.self) private var subscription
    @Environment(ScheduledSessionsStore.self) private var scheduledSessions
    @Environment(ActiveSessionStore.self) private var activeSession

    @StateObject private var stack = MainNavigatorPath()
    @StateObject private var lockIn = LockInCoordinator()

    @Environment(\.scenePhase) private var scenePhase

    public init() {}

    public var body: some View {
        NavigationStack(path: $stack.path) {
            TabNavigator()
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: MainStackRoute.self) { route in
                    destination(for: route)
                        .toolbar(.hidden, for: .navigationBar)
                }
        }
        .environmentObject(stack)
        .environmentObject(lockIn)
        .task {
            // Hydrate home + missions when entering the main tree.
            if !home.isHydrated { home.hydrate() }
            if !missions.isHydrated { missions.hydrate() }
            if !scheduledSessions.isHydrated { scheduledSessions.hydrate() }
            logDeviceActivityBreadcrumbs()
            // Push current onboarding values into missions state.
            if let goal = onboarding.primaryGoal {
                missions.userGoal = goal
            }
            missions.userWeaknesses = onboarding.selectedWeaknesses
            missions.streak = home.consecutiveStreak

            // Mission completions push guild scores too — focus sessions are
            // handled in `handleSessionFinish`. The cache bump is synchronous
            // on the MainActor (the hook fires inside `completeMission`), so a
            // burst of auto-completions during a session each count exactly
            // once; only the network push is async.
            missions.onMissionCompleted = { [weak home] _ in
                let streak = home?.consecutiveStreak ?? 0
                // Atomic cross-process increment so a concurrent focus credit
                // (from a session finishing, or the DAM extension) can't lose this
                // mission bump.
                let updated = GuildService.shared.creditMissionCompletion(streakDays: streak)
                Task {
                    _ = await GuildService.shared.completeMissionServerSide(
                        focusMinutes: updated.focus_minutes,
                        missionsDone: updated.missions_done,
                        streakDays: updated.streak_days
                    )
                }
            }

            // Forward the feature's analytics events (`Mission Completed`,
            // `All Missions Completed`) into the shared service. Without this
            // the hook is nil and those events never reach PostHog.
            missions.onAnalyticsTrack = { name, properties in
                AnalyticsService.shared.track(name, properties: properties)
            }

            // `Mission Viewed` is posted from `MissionCard` via NotificationCenter
            // (so the card needn't hold the @Observable model). Observe it here
            // and forward to analytics — otherwise the post goes nowhere. The
            // observer captures no view state, so register it once per process
            // (not per view-mount) to avoid stacking duplicates that would
            // double-count `Mission Viewed`.
            if !Self.didRegisterAnalyticsObservers {
                Self.didRegisterAnalyticsObservers = true
                NotificationCenter.default.addObserver(
                    forName: .missionsAnalyticsViewed,
                    object: nil,
                    queue: .main
                ) { note in
                    let props = (note.userInfo as? [String: Any]) ?? [:]
                    Task { @MainActor in
                        AnalyticsService.shared.track(
                            MissionsRoute.AnalyticsEvent.missionViewed,
                            properties: props
                        )
                    }
                }
            }

            // Route a finished manual session into the shared credit fan-out.
            // If the session was promoted from a scheduled window, mark the
            // occurrence credited first so the DAM extension's background
            // completion queue can't double-credit it.
            //
            // Sub-60s bail (actualMinutes == 0) of a promoted scheduled
            // session: the user hold-to-ended within the first minute — the
            // "not now" reaction to an auto-started block. `complete()`
            // already tore the shield down, so blocking has genuinely
            // stopped; POISON the occurrence (not credit) so (a) the
            // still-armed scheduled monitor's full-duration record at window
            // end is dropped by the drain — sub-60s earns nothing, and the
            // window ran unshielded after the cancel — and (b)
            // `currentActiveOccurrence` reads the occurrence as inactive, so
            // the 30s foreground ticker can't re-promote (re-shield + re-
            // present) the session the user just killed.
            activeSession.onFinish = { actualMinutes, wasNatural, scheduledOccurrenceId in
                if actualMinutes == 0, let occ = scheduledOccurrenceId {
                    scheduledSessions.poisonOccurrence(occ)
                }
                if actualMinutes > 0, let occ = scheduledOccurrenceId {
                    // Idempotence (single-credit choke point): the store's
                    // `complete()` runs on a deferred Task hop, so the drain /
                    // expired-block paths can win the race and credit this
                    // occurrence first. Whichever path runs first wins; the
                    // loser skips crediting entirely — it must NOT call
                    // `handleSessionFinish` (XP/streak/guild would double) —
                    // and just resolves the timer cover.
                    guard !scheduledSessions.isCredited(occ) else {
                        lockIn.dismissAll()
                        return
                    }
                    scheduledSessions.markCredited(occ)
                }
                // Forward the occurrence id so the guild credit is deduped against
                // the DAM extension's background push (atomic single-credit).
                handleSessionFinish(
                    actualMinutes: actualMinutes,
                    wasNatural: wasNatural,
                    scheduledOccurrenceId: scheduledOccurrenceId
                )
            }

            // Lets a promoted scheduled session tell, on break-end, whether its
            // fixed OS window is still open — so it re-blocks only within the
            // window and never strands the shield past it.
            activeSession.isScheduledWindowActive = { [weak scheduledSessions] in
                scheduledSessions?.currentActiveOccurrence() != nil
            }

            // Schedule rolling notifications based on current streak.
            NotificationService.shared.refreshScheduleWithStoredStreak()

            // Credit any scheduled lock-in sessions that auto-ran while the app
            // was closed.
            drainScheduledCompletions()

            // Listen for cross-feature `regenerateMissions` posts. Fired by
            // ProfileTab when the user changes their goal or weaknesses.
            NotificationCenter.default.addObserver(
                forName: .lockedInRegenerateMissions,
                object: nil,
                queue: .main
            ) { _ in
                Task { @MainActor in
                    missions.regenerateTodaysMissions(
                        goalOverride: onboarding.primaryGoal,
                        weaknessesOverride: onboarding.selectedWeaknesses
                    )
                }
            }
        }
        .onAppear {
            resumeActiveExecutionBlockIfNeeded()
            // Drain BEFORE the scheduled-live sweep: a completion that arrived
            // while backgrounded/killed marks its occurrence credited (and
            // auto-disables a fired one-off) so the promotion pass below can't
            // promote a window that already finished.
            drainScheduledCompletions()
            resumeScheduledLiveIfNeeded()
        }
        .onChange(of: scenePhase) { _, newPhase in
            // Re-mount the active execution-block screen if the user
            // foregrounds mid-session (e.g. tapped the Live Activity in the
            // Dynamic Island while in another app). Without this, the modal
            // can be missing from the cover stack after re-entry, stranding
            // the user on the home tab while the shield is still up — there's
            // no other way back into the timer short of starting a new
            // session, which would cancel the active one.
            guard newPhase == .active else { return }
            activeSession.syncOnForeground()
            // Re-arm the daily notification set on every foreground. Without
            // this, the streak-risk pings — cleared when a goal is met — would
            // only be re-armed on cold launch, a streak change, or a Home-tab
            // re-appear, so a plain foreground the day after a goal-met day
            // could leave the at-risk day with no reminder.
            NotificationService.shared.refreshScheduleWithStoredStreak()
            // Recover any scheduled DeviceActivity monitoring that was dropped
            // while backgrounded (auth race / OS eviction) so background
            // blocking re-engages for upcoming windows.
            scheduledSessions.resyncMonitoring()
            resumeActiveExecutionBlockIfNeeded()
            // Drain BEFORE the scheduled-live sweep (see `.onAppear`): a
            // fired one-off must be credited + auto-disabled before the
            // promotion pass, or its stale window could promote as a phantom.
            drainScheduledCompletions()
            resumeScheduledLiveIfNeeded()
            // LAST: with every live-session claim above settled, clear any
            // shield stranded by a failed monitor registration + app kill.
            sweepStaleShieldIfNeeded()
        }
        // Contract C4: an EXTERNAL start (Siri / Shortcuts / widget handoff)
        // just persisted its block + applied the shield OUTSIDE the in-app
        // flow. Present the timer immediately — the scenePhase `.active`
        // resume sweep runs BEFORE the async intent start writes the block,
        // so without this observer the session runs headless (shield up, idle
        // Home, no engine) until the next background→foreground cycle.
        // `onReceive` (not a manual `addObserver`) so a navigator re-mount
        // can't stack duplicate or stale-capture observers.
        .onReceive(NotificationCenter.default.publisher(for: .lockedInSessionExternallyStarted)) { _ in
            // A PRE-session modal (duration picker / setup gate) would block
            // the resume — and a later picker confirm would overwrite the
            // just-persisted block mid-run (the stomp defect #6 closed). A
            // lingering completion celebration blocks it too, and its credit
            // was already granted before it presented — dismissing loses
            // nothing. The externally started session takes precedence.
            switch lockIn.activeModal {
            case .durationPicker, .setupRequired, .sessionComplete:
                lockIn.activeModal = nil
            default:
                break
            }
            resumeActiveExecutionBlockIfNeeded()
        }
        // An EXTERNAL start request (widget deep link / pending-intent
        // handoff) was refused because Screen Time setup is incomplete
        // (Family Controls revoked or empty allowlist). Present the same
        // `LockInSetupSheet` the in-app flow uses for exactly this state —
        // without it the tap foregrounds the app to an idle Home with no
        // explanation. Never stomps a live session surface: only presents
        // over no modal or another PRE-session modal.
        .onReceive(NotificationCenter.default.publisher(for: .lockedInExternalStartSetupRequired)) { _ in
            guard !activeSession.isActive else { return }
            let readiness = LockInCoordinator.checkReadiness()
            guard readiness != .ready else { return }
            switch lockIn.activeModal {
            case nil, .durationPicker, .setupRequired:
                AnalyticsService.shared.track("Lock In Setup Required", properties: [
                    "reason": readiness == .needsScreenTimeAuth ? "screen_time_auth" : "app_selection",
                    "source": "external_start",
                ])
                lockIn.activeModal = .setupRequired(readiness)
            default:
                break
            }
        }
        // Auto-present a scheduled window that starts while the app is already
        // foregrounded. `onAppear` / `scenePhase` only fire on launch + resume,
        // so without this a window beginning during active use wouldn't surface
        // the timer until the next foreground. ~30s granularity only affects
        // when the *screen* appears — the shield is unaffected. The task is
        // keyed on `scenePhase`, so it auto-cancels when the app backgrounds.
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30 * 1_000_000_000)
                if Task.isCancelled { return }
                resumeScheduledLiveIfNeeded()
            }
        }
        .fullScreenCover(item: $lockIn.activeModal) { modal in
            switch modal {
            case .paywallOffer:
                // Hard gate before a paid Lock-In. On success, re-run the
                // Screen-Time readiness gate before the duration picker — a
                // fresh subscriber may still be missing Family Controls auth
                // or an allowlist, and their first session must actually
                // block something.
                HUDPaywallScreen(
                    context: .lockIn,
                    isDismissable: false,
                    onSubscribed: {
                        let readiness = LockInCoordinator.checkReadiness()
                        lockIn.activeModal = readiness == .ready
                            ? .durationPicker
                            : .setupRequired(readiness)
                    }
                )
                .environment(subscription)
            case .setupRequired(let readiness):
                // Pre-start gate (Fix 5): resolve missing Screen Time auth /
                // empty allowlist in place. On resolution, re-check — advance
                // to the picker when ready, or swap to the next unmet
                // requirement (auth granted but no apps selected yet). Same
                // modal identity, so the cover updates without re-presenting.
                LockInSetupSheet(
                    readiness: readiness,
                    onResolved: {
                        let next = LockInCoordinator.checkReadiness()
                        lockIn.activeModal = next == .ready
                            ? .durationPicker
                            : .setupRequired(next)
                    },
                    onDismiss: { lockIn.dismissAll() }
                )
            case .durationPicker:
                DurationPickerSheet(
                    isPresented: Binding(
                        get: { lockIn.activeModal == .durationPicker },
                        set: { newValue in if !newValue { lockIn.activeModal = nil } }
                    ),
                    onConfirm: { minutes, hardcore in
                        // Persist hardcore so a minimize / cold-resume keeps no-exit.
                        Defaults.setBool(hardcore, SessionState.activeBlockHardcoreKey)
                        AnalyticsService.shared.track("Session Started", properties: [
                            "duration_minutes": minutes,
                            "hardcore": hardcore,
                        ])
                        activeSession.start(
                            durationMinutes: minutes,
                            hardcore: hardcore,
                            resumeEndTimestamp: nil,
                            goal: onboarding.primaryGoal,
                            streak: home.consecutiveStreak
                        )
                        lockIn.activeModal = .executionBlock
                    }
                )
            case .executionBlock:
                ExecutionBlockScreen(onMinimize: { lockIn.dismissAll() })
            case .sessionComplete(let durationMinutes, let streak):
                SessionCompleteScreen(
                    params: SessionCompleteScreenParams(
                        phase: .executionBlock,
                        durationMinutes: durationMinutes,
                        streak: streak
                    ),
                    onDismiss: { lockIn.dismissAll() }
                )
            }
        }
    }

    // MARK: - Destinations

    @ViewBuilder
    private func destination(for route: MainStackRoute) -> some View {
        switch route {
        case .signUp:
            SignUpScreen(
                goToSignIn: { swapAuthRoute(to: .signIn) },
                continueAsGuest: { stack.path.removeLast() },
                onSignedUp: {
                    // Pop the SignUp page, then push EditProfile on the
                    // next runloop tick — two synchronous path mutations
                    // in one closure leaves NavigationStack mid-animation
                    // (pop + push) and the screen visibly freezes.
                    stack.path.removeLast()
                    DispatchQueue.main.async {
                        stack.path.append(.editProfile)
                    }
                }
            )
        case .signIn:
            SignInScreen(
                goToSignUp: { swapAuthRoute(to: .signUp) },
                continueAsGuest: { stack.path.removeLast() },
                onSignedIn: { stack.path.removeLast() }
            )
        case .editProfile:
            EditProfileScreen(
                source: .signup,
                onClose: { stack.path.removeLast() },
                onSaved: { stack.path.removeLast() }
            )
        case .guildDetail(let guildId):
            GuildDetailScreen(
                state: guild,
                guildId: guildId,
                // Supabase + Postgres store UUIDs lowercase; `Foundation.UUID
                // .uuidString` returns uppercase. Lowercasing here keeps
                // `isOwner`'s string-compare honest — without it the owner
                // can never see "Delete Guild".
                currentUserId: auth.user?.id.uuidString.lowercased(),
                onBack: { stack.path.removeLast() },
                onLeft: { stack.path.removeLast() }
            )
        case .createGuild:
            CreateGuildScreen(
                state: guild,
                isAnonymous: auth.isAnonymous,
                onBack: { stack.path.removeLast() },
                onSignUp: {
                    stack.path.removeLast()
                    stack.path.append(.signUp)
                },
                onCreated: { guildId in
                    stack.path.removeLast()
                    stack.path.append(.guildDetail(guildId: guildId))
                }
            )
        case .joinGuild:
            JoinGuildScreen(
                state: guild,
                onBack: { stack.path.removeLast() },
                onJoined: { guildId in
                    // Pop the JoinGuild screen first, then push the
                    // detail on the next runloop tick. Doing both in
                    // one closure leaves NavigationStack mid-animation
                    // (pop + push) and the screen visibly freezes —
                    // same anti-pattern the SignUp/SignIn flows hit.
                    stack.path.removeLast()
                    DispatchQueue.main.async {
                        stack.path.append(.guildDetail(guildId: guildId))
                    }
                }
            )
        case .weeklyReport:
            weeklyReportDestination
        case .scheduledSessions:
            ScheduledSessionsScreen(
                store: scheduledSessions,
                onBack: { stack.path.removeLast() }
            )
        }
    }

    /// Build the WeeklyReport screen using the live state from the coordinator.
    private var weeklyReportDestination: some View {
        // Generate the report inline; the service's `generateWeeklyReport`
        // is local-only and synchronous-equivalent.
        let dailyCommitment = onboarding.dailyMinutes ?? 60
        let weekMinutes = home.weekCompletedDays.count // proxy until W3/W9 cross-wire
        let report = WeeklyReportService.shared.getLastReport()
            ?? ReportEngine.buildReport(
                sessionsCompletedThisWeek: home.weekCompletedDays.count,
                totalFocusMinutes: home.lifetimeExecutionMinutes,
                completedMissions: missions.completedCount,
                totalMissions: missions.missions.count,
                streakDays: home.consecutiveStreak,
                dailyCommitment: dailyCommitment,
                previousGrade: nil,
                now: Date()
            )
        _ = weekMinutes
        return WeeklyReportScreen(
            report: report,
            currentStats: nil,
            onDismiss: { stack.path.removeLast() }
        )
    }

    /// Pop the current auth route (SignUp ↔ SignIn) and push the requested
    /// twin on the next runloop tick. Doing both in one closure leaves
    /// NavigationStack animating a pop + push simultaneously — the screen
    /// visibly freezes on tap, which is the "Sign in button does nothing"
    /// symptom on the Create Account page.
    private func swapAuthRoute(to route: MainStackRoute) {
        if !stack.path.isEmpty { stack.path.removeLast() }
        DispatchQueue.main.async {
            stack.path.append(route)
        }
    }

    /// On launch, surface the DAM extension's last-fired breadcrumbs (written by
    /// `LockedInDeviceActivityMonitor`). On a physical device this confirms
    /// whether the OS is actually waking the extension for scheduled windows —
    /// the deciding signal for the background-blocking investigation.
    private func logDeviceActivityBreadcrumbs() {
        let shared = SharedScreenTime.sharedDefaults()
        let lastStart = shared?.string(forKey: SharedScreenTime.Keys.damLastStart) ?? "none"
        let lastEnd = shared?.string(forKey: SharedScreenTime.Keys.damLastEnd) ?? "none"
        AnalyticsService.shared.track("dam_breadcrumb_launch", properties: [
            "last_start": lastStart,
            "last_end": lastEnd,
        ])
        #if DEBUG
        print("[DAM] last intervalDidStart: \(lastStart) | last intervalDidEnd: \(lastEnd)")
        #endif
    }

    // MARK: - Session completion fan-out

    /// Fire-and-forget push of the current cumulative monthly guild totals to the
    /// server. Idempotent (server upserts per-field `GREATEST`), so re-flushing the
    /// same totals never regresses or double-counts.
    private func pushGuildScores(_ stats: GuildService.MonthlyGuildStats) {
        Task {
            _ = await GuildService.shared.completeMissionServerSide(
                focusMinutes: stats.focus_minutes,
                missionsDone: stats.missions_done,
                streakDays: stats.streak_days
            )
        }
    }

    private func handleSessionFinish(actualMinutes: Int, wasNatural: Bool, showCompletionUI: Bool = true, occurredAt: Date = Date(), scheduledOccurrenceId: String? = nil) {
        // 0 minutes means the user bailed before the 60s threshold.
        guard actualMinutes > 0 else {
            if showCompletionUI { lockIn.dismissAll() }
            return
        }

        // `occurredAt` is the real session end time — `Date()` for live/manual
        // sessions, the actual past time for a background-drained scheduled one.
        // `isToday` gates today-specific crediting so a session drained on a LATER
        // day can't inflate today's focus bucket / daily goal / streak. Lifetime,
        // EXP, guild, and duration-based missions still credit regardless.
        let todayKey = SessionDayEngine.todayKey()
        let occurredDayKey = SessionDayEngine.dayKey(from: occurredAt)
        let isToday = occurredDayKey == todayKey

        // Update local Home state — cross-day credits lifetime only (no today bucket).
        home.completeExecutionBlock(durationMinutes: actualMinutes, creditToday: isToday)

        // Daily-goal-met check (today only).
        let goal = onboarding.dailyMinutes ?? 60
        let metAfter = isToday && home.dailyFocused(todayKey: todayKey) >= goal
        if metAfter && home.dailyGoalMetDate != todayKey {
            home.dailyGoalMet()
            XPService.award(.perfectDay)
            StatsService.bumpCounter(.totalStreakDays, delta: 1)   // lifetime "days you hit goal"
            StatsService.bumpCounter(.totalPerfectDays, delta: 1)  // CON formula uses this with 2× weight

            // Per-stat XP: daily-goal-met awards CON XP, multiplied by the
            // streak XP modifier. `dailyGoalMet()` has already incremented
            // `consecutiveStreak` so the bonus reflects the streak the user
            // is *about to be on* (rewards crossing milestones like day 3,
            // 7, 30, 60, 90, 180).
            let conXp = RankHelpers.applyStreakMultiplier(
                baseXp: 30,
                streak: home.consecutiveStreak
            )
            StatsService.bumpStatXp(.consistency, delta: conXp)
        }

        // Forward to missions auto-complete.
        let data = SessionCompleteData(
            durationMinutes: actualMinutes,
            dailyFocusedMinutes: home.dailyFocused(todayKey: todayKey),
            streak: home.consecutiveStreak,
            dailyGoalMet: metAfter
        )
        missions.checkAutoComplete(data, now: occurredAt)
        MissionsState.recordActiveDay()

        // Server-side legacy counter bumps (kept populated for admin queries).
        StatsService.bumpCounter(.totalFocusMinutes, delta: actualMinutes)
        StatsService.bumpCounter(.totalSessions, delta: 1)
        if wasNatural {
            StatsService.bumpCounter(.totalCompletedSessions, delta: 1)
        }

        // Persist the streak, then recompute the derived `user_stats` columns
        // (rank_id / numeric ovr) so the guild leaderboard's streak-rank name
        // (NPC → RECRUIT → …) tracks the streak the user already sees on Home.
        let streakForSync = home.consecutiveStreak
        Task { await StatsService.setStreakAndRecompute(streakForSync) }

        // ── Unified per-stat XP bumps ──
        //
        // FOC: 1 XP per focused minute, with a 180/day cap. The cap is the
        // anti-abuse mechanism — a 24-hour lock-in yields no more FOC XP than
        // a 3-hour one. Cap is enforced client-side via HomeState; server
        // accepts whatever delta we send (it has no cross-day context).
        // FOC is day-capped (per-day bucket), so credit it for same-day sessions
        // only — a cross-day drain can't be attributed to a past day's cap.
        if isToday {
            let focusXp = home.eligibleFocusXp(for: actualMinutes, todayKey: todayKey)
            if focusXp > 0 {
                StatsService.bumpStatXp(.focus, delta: focusXp)
                home.recordFocusXpAwarded(focusXp, todayKey: todayKey)
            }
        }

        // DIS: small per-session reward — completing a session counts as
        // "resisting" distractions for that block, regardless of mission tag.
        StatsService.bumpStatXp(.discipline, delta: 5)

        // EXE: every session counts (15 XP). Mission-completion EXE +15 and
        // the perfect-day EXE +50 / CON +30 bonus both fire from
        // `MissionsState.completeMission` — keep them centralized there so a
        // session-end and a mission-tap can't double-credit if the user
        // happens to flip both states on the same tick.
        StatsService.bumpStatXp(.execution, delta: 15)

        // Streak milestone notification.
        NotificationService.shared.scheduleStreakMilestoneIfNeeded(
            currentStreak: home.consecutiveStreak
        )

        // Achievement evaluation pass.
        AchievementService.evaluate(AchievementContext(
            consecutiveStreak: home.consecutiveStreak,
            lifetimeRunsCompleted: home.lifetimeRunsCompleted,
            lifetimeTotalMinutes: home.lifetimeTotalMinutes,
            dailyGoalMet: metAfter
        ))

        // XP for the session.
        XPService.award(.session)

        // Forward into the LockInCoordinator → SessionCompleteScreen. Skipped
        // for reconciled scheduled sessions (credited silently in a batch — a
        // per-session full-screen cover would stack/race).
        if showCompletionUI {
            lockIn.finishSession(
                durationMinutes: actualMinutes,
                wasNatural: wasNatural,
                streak: home.consecutiveStreak
            )
        }

        // Push the focus minutes from this session to every guild. Missions
        // own their own `missions_done` increments via the `onMissionCompleted`
        // hook, so `creditFocusMinutes` only bumps focus + streak.
        //
        // `scheduledOccurrenceId` (set only for a scheduled occurrence credited
        // in-app or via the drain) makes the cache increment single-credit: if the
        // DAM extension already credited this occurrence's guild points in the
        // background, `creditFocusMinutes` returns nil and we skip the push — the
        // increment is atomic + cross-process, so it can't double-add or lose the
        // update against the extension. Manual sessions pass nil and always credit.
        if let updated = GuildService.shared.creditFocusMinutes(
            actualMinutes,
            streakDays: home.consecutiveStreak,
            occurrenceId: scheduledOccurrenceId
        ) {
            pushGuildScores(updated)
        } else {
            // This scheduled occurrence was already guild-credited to the cache by
            // the DAM extension — but the extension's own push may have failed
            // (transient network / invalidated token) while still marking it. Its
            // minutes are in the cache, so re-flush the cumulative totals here to
            // guarantee delivery (idempotent via server GREATEST) rather than
            // relying on some future session to flush them.
            pushGuildScores(GuildService.shared.getMonthlyStats())
        }

        // Re-sync the daily notification set with the fresh goal-met state so
        // the streak-risk pings clear the moment a session meets today's goal —
        // including a background-drained scheduled session credited while the
        // user is on a non-Home tab (where HomeTabScreen wouldn't re-arm).
        NotificationService.shared.scheduleAllDailyNotifications(
            streak: home.consecutiveStreak,
            hasGuild: Defaults.bool("@lockedin/has_active_guild"),
            goalMinutes: goal,
            reminderTime: HourMinute.parse(Defaults.string("@lockedin/reminder_time"))
                ?? HourMinute(hour: 9, minute: 0),
            goalMetToday: home.dailyFocused(todayKey: todayKey) >= goal
                || home.dailyGoalMetDate == todayKey
        )
    }

    /// Restore the active execution-block modal if a session is still in
    /// progress per `LockModeService`. Runs on cold start (`.onAppear`) AND
    /// every foreground (`scenePhase` → `.active`):
    ///
    /// - **Cold start path** (the one that broke after 10+ min in the
    ///   background): iOS killed the process, the user taps the Dynamic
    ///   Island, the splash screen plays, then a fresh `LockInCoordinator` is
    ///   built with `activeModal == nil`. The persisted block in App Group
    ///   storage is the only signal that we're mid-session.
    /// - **Warm foreground path**: covers the rare case where the cover got
    ///   dropped without the process dying.
    ///
    /// Skips when a modal is already up, when the store is mid-credit
    /// (`isFinishing` — crediting the limbo block here is the double-credit
    /// race), when no block is persisted, or when the persisted `endTimestamp`
    /// is already in the past (don't resurrect a stale timer — let the
    /// cold-start sweep clean it up).
    ///
    /// A persisted `ActiveBreakState` (app killed mid-break) is handled first:
    /// still mid-break → resume the break in place; break elapsed but the
    /// fixed end hasn't → resume running (defensively re-shielding — the
    /// break-resume monitor should have, but its registration can fail);
    /// fixed end passed → clear the break and fall through to the normal
    /// expired-block credit (the block's `endTimestamp` was rewritten to the
    /// fixed end at break start, so it credits the right amount).
    private func resumeActiveExecutionBlockIfNeeded() {
        guard lockIn.activeModal == nil else { return }
        guard !activeSession.isFinishing else { return }

        // Live in memory (e.g. cold-start already rehydrated, or the user
        // minimized within the app) → just re-present the screen.
        if activeSession.isActive {
            lockIn.activeModal = .executionBlock
            return
        }

        // ── Break recovery (Fix 7) ──
        if let br = LockModeService.shared.loadActiveBreakState(),
           resumePersistedBreakIfPossible(br) {
            return
        }

        guard let active = LockModeService.shared.loadActiveExecutionBlock() else { return }
        let nowMs = Date().timeIntervalSince1970 * 1000
        if active.endTimestamp > nowMs {
            // Cold start mid-session → rehydrate the store from the persisted
            // block, then present.
            let endDate = Date(timeIntervalSince1970: active.endTimestamp / 1000)
            activeSession.start(
                durationMinutes: active.durationMinutes,
                hardcore: Defaults.bool(SessionState.activeBlockHardcoreKey),
                resumeEndTimestamp: endDate,
                goal: onboarding.primaryGoal,
                streak: home.consecutiveStreak
            )
            lockIn.activeModal = .executionBlock
        } else {
            // Window ended while the app was killed → credit once and clear.
            // Attribute to the real end time so a block that ended on a prior day
            // (app reopened later) doesn't inflate today's bucket/goal/streak.
            LockModeService.shared.endSession()
            handleSessionFinish(
                actualMinutes: active.durationMinutes,
                wasNatural: true,
                showCompletionUI: true,
                occurredAt: Date(timeIntervalSince1970: active.endTimestamp / 1000)
            )
        }
    }

    /// Recover a session whose process died mid-break. Returns `true` when the
    /// break state fully handled the resume (present a screen / nothing left
    /// to do); `false` when the caller should fall through to the normal
    /// persisted-block path (break expired → credit; or stale snapshot).
    private func resumePersistedBreakIfPossible(_ br: ActiveBreakState) -> Bool {
        let now = Date()
        let breakEnd = Date(timeIntervalSince1970: br.breakEndsAtMs / 1000)
        let fixedEnd = Date(timeIntervalSince1970: br.sessionEndsAtMs / 1000)

        if let occ = br.scheduledOccurrenceId {
            // Promoted scheduled session: no manual block is persisted for it,
            // so re-attach via the scheduled window itself. Only resume while
            // THIS occurrence's window is still open and uncredited — after
            // that, the scheduled machinery (drain / extension queue) owns
            // crediting and the snapshot is just stale.
            guard let active = scheduledSessions.currentActiveOccurrence(),
                  active.occurrenceId == occ else {
                LockModeService.shared.clearActiveBreakState()
                NotificationService.shared.cancelBreakEnded()
                return false
            }

            if now >= breakEnd {
                // Break elapsed while dead → back to focus. Defensive shield:
                // the break-resume monitor should have re-applied at breakEnd,
                // but registration can fail and re-applying is idempotent.
                LockModeService.shared.clearActiveBreakState()
                NotificationService.shared.cancelBreakEnded()
                ScreenTimeModule.shared.shieldApps()
                // Mirror `handleBreakEnded`'s scheduled path: tear down the
                // break-resume monitor (manual activity name) + its future
                // `sessionEndTimestamp` so the scheduled window-end
                // `intervalDidEnd` stays the SINGLE owner of the un-shield.
                // Leaving them armed lets a slightly-early window-end callback
                // read `manualSessionActive()` and skip the clear — stranding
                // the shield past the window until the manual monitor's late
                // backstop. (`cancelBreakResume` removes the timestamp BEFORE
                // the stop, so the stale stop callback falls into the
                // scheduled-window-active guard and keeps the shield up.)
                ScreenTimeModule.shared.cancelBreakResume()
            }
            activeSession.start(
                durationMinutes: active.session.durationMinutes,
                hardcore: false, // scheduled sessions allow exit/pause
                resumeEndTimestamp: active.end, // engine end = OS window end (fixed end clamps to it)
                goal: onboarding.primaryGoal,
                streak: home.consecutiveStreak,
                scheduledOccurrenceId: occ
            )
            if now < breakEnd {
                activeSession.resumeBreak(until: breakEnd)
            }
            lockIn.activeModal = .executionBlock
            return true
        }

        // Manual session break. The block survived the break (beginBreak keeps
        // it, endTimestamp rewritten to the fixed end) — it's the source of
        // truth for the resume; a missing block means the session was torn
        // down elsewhere and the snapshot is orphaned.
        guard let active = LockModeService.shared.loadActiveExecutionBlock() else {
            LockModeService.shared.clearActiveBreakState()
            NotificationService.shared.cancelBreakEnded()
            return false
        }

        if now < breakEnd {
            // Still mid-break → resume the break in place. No shield (the
            // break lifted it; the OS re-applies at breakEnd), no budget hit.
            activeSession.start(
                durationMinutes: active.durationMinutes,
                hardcore: br.hardcore,
                resumeEndTimestamp: fixedEnd,
                goal: onboarding.primaryGoal,
                streak: home.consecutiveStreak
            )
            activeSession.resumeBreak(until: breakEnd)
            lockIn.activeModal = .executionBlock
            return true
        }

        if now < fixedEnd {
            // Break over, session still running → resume focus. Defensive
            // shield re-apply (see the scheduled branch above); the
            // break-resume monitor + fixed-end timestamp stay armed for the
            // background un-shield at the fixed end.
            LockModeService.shared.clearActiveBreakState()
            NotificationService.shared.cancelBreakEnded()
            ScreenTimeModule.shared.shieldApps()
            activeSession.start(
                durationMinutes: active.durationMinutes,
                hardcore: br.hardcore,
                resumeEndTimestamp: fixedEnd,
                goal: onboarding.primaryGoal,
                streak: home.consecutiveStreak
            )
            lockIn.activeModal = .executionBlock
            return true
        }

        // The whole session elapsed while dead (break included) → clear the
        // break and let the caller's expired-block path credit it once (the
        // block's endTimestamp == fixed end, so the credit lands correctly).
        LockModeService.shared.clearActiveBreakState()
        NotificationService.shared.cancelBreakEnded()
        return false
    }

    /// If a scheduled session's auto-block window is in progress right now,
    /// **promote it into the normal manual lock-in flow** (e.g. the user tapped
    /// the "locking in" notification mid-window, or the window started while the
    /// app was foregrounded). This gives the scheduled session the full
    /// `ExecutionBlockScreen` — hold-to-exit, the real pause protocol, the
    /// minimized Home FocusRing, and the shared EXP fan-out — instead of a
    /// stripped-down bespoke screen. Crediting is deduped against the DAM
    /// extension's background queue via the occurrence id (see the `onFinish`
    /// wrapper). Skips when any modal is already up or a session is already live.
    private func resumeScheduledLiveIfNeeded() {
        guard scheduledSessions.isHydrated else { return }
        guard lockIn.activeModal == nil else { return }
        guard !activeSession.isActive else { return }
        // Mid-credit limbo: the just-resolved session's deferred `complete()`
        // hasn't run yet — starting a promoted session now would race its
        // teardown. The next foreground/30s pass retries.
        guard !activeSession.isFinishing else { return }
        guard let active = scheduledSessions.currentActiveOccurrence() else { return }

        // A persisted break for THIS occurrence (app killed mid-break) belongs
        // to the break-recovery path — promoting to "running" here would
        // re-shield mid-break and cut a budgeted break short. Delegate: the
        // recovery path re-checks its own guards and either resumes the break
        // or invalidates the stale snapshot (after which the next pass of this
        // sweep promotes normally).
        if let br = LockModeService.shared.loadActiveBreakState(),
           br.scheduledOccurrenceId == active.occurrenceId {
            resumeActiveExecutionBlockIfNeeded()
            return
        }

        // Re-assert the shield immediately as an in-app fail-safe: if the
        // background DAM `intervalDidStart` never landed, opening the app now
        // blocks apps right away. We use `shieldApps()` (not
        // `LockModeService.beginSession`) on purpose — `beginSession` would
        // write a competing manual `activeExecutionBlock` that, alongside the
        // still-registered scheduled DAM completion queue, could double-credit
        // on a cold-start kill. The scheduled DAM stays the single owner of
        // background un-shield + crediting; `markCredited` dedupes the in-app
        // credit.
        ScreenTimeModule.shared.shieldApps()

        activeSession.start(
            durationMinutes: active.session.durationMinutes, // full window → full-window EXP on natural finish
            hardcore: false,                                 // scheduled sessions allow exit/pause
            resumeEndTimestamp: active.end,                  // engine end = OS window end; skips start()'s own shield
            goal: onboarding.primaryGoal,
            streak: home.consecutiveStreak,
            scheduledOccurrenceId: active.occurrenceId
        )
        lockIn.activeModal = .executionBlock
    }

    /// Foreground fail-safe (Fix 16): clear a shield stranded with no owner.
    /// The classic case is a manual session whose DeviceActivity monitor
    /// registration FAILED (so no extension callback will ever un-shield) and
    /// whose app process was then killed — nothing is left to lift the shield
    /// at session end. The App Group `sessionEndTimestamp` has always been
    /// documented as feeding a foreground sweep; this implements it.
    ///
    /// Runs at the END of the scenePhase-active handler so every legitimate
    /// claim on the shield (in-memory session, mid-credit limbo, persisted
    /// break, still-running persisted block, live scheduled window) has been
    /// re-asserted first — each of those is a bail-out below.
    private func sweepStaleShieldIfNeeded() {
        // An unhydrated store cannot prove no scheduled window owns the
        // shield — `currentActiveOccurrence()` silently reads nil over an
        // empty session list, and on a cold launch this scenePhase handler
        // can run before the `.task` hydration. Bail: the sweep re-runs on
        // every foreground, so a genuinely stale shield still gets cleared
        // on the next (hydrated) pass.
        guard scheduledSessions.isHydrated else { return }
        if activeSession.isActive || activeSession.isFinishing { return }
        if LockModeService.shared.loadActiveBreakState() != nil { return }
        if let block = LockModeService.shared.loadActiveExecutionBlock(),
           block.endTimestamp > Date().timeIntervalSince1970 * 1000 { return }
        if scheduledSessions.currentActiveOccurrence() != nil { return }

        // No owner. A PAST `sessionEndTimestamp` means a manual monitor was
        // supposed to clean up and evidently didn't; an in-process shield flag
        // with no owner is stale by definition. Either way, sweep — this also
        // stops the manual monitor and clears the timestamp.
        let endMs = SharedScreenTime.sharedDefaults()?
            .double(forKey: SharedScreenTime.Keys.sessionEndTimestamp) ?? 0
        let hasPastEnd = endMs > 0 && endMs <= Date().timeIntervalSince1970 * 1000
        guard hasPastEnd || ScreenTimeModule.shared.isShielding() else { return }

        ScreenTimeModule.shared.removeShield()
        AnalyticsService.shared.track("stale_shield_swept", properties: [
            "had_past_end_timestamp": hasPastEnd,
        ])
    }

    /// Credit any scheduled lock-in sessions that auto-ran (shield applied by
    /// the DAM extension) while the app was backgrounded or killed. Each
    /// occurrence is credited once via the shared `handleSessionFinish` path,
    /// silently (no per-session completion cover). Safe to call repeatedly —
    /// the store dedupes by occurrence id and single-flights the drain.
    private func drainScheduledCompletions() {
        guard scheduledSessions.isHydrated else { return }
        let credited = scheduledSessions.drainPendingCompletions { occurrenceId, minutes, endedAtMs in
            // Attribute the credit to when the session actually ran, not now.
            let occurredAt = Date(timeIntervalSince1970: endedAtMs / 1000)
            // Pass the occurrence id so the guild credit is single-credited against
            // the DAM extension's background push: `creditFocusMinutes` atomically
            // skips the guild push if the extension already counted it, while
            // EXP/streak still credit here.
            handleSessionFinish(
                actualMinutes: minutes,
                wasNatural: true,
                showCompletionUI: false,
                occurredAt: occurredAt,
                scheduledOccurrenceId: occurrenceId
            )
        }
        if credited > 0 {
            NotificationCenter.default.post(
                name: .lockedInScheduledSessionsCredited,
                object: nil,
                userInfo: ["count": credited]
            )
        }
    }
}

public extension Notification.Name {
    /// Posted after scheduled lock-in sessions are reconciled + credited on
    /// app open. `userInfo["count"]` is the number credited. RootView shows a
    /// lightweight summary toast.
    static let lockedInScheduledSessionsCredited = Notification.Name("lockedInScheduledSessionsCredited")

    /// Posted by `LockInIntentServiceImpl.startSession` after an EXTERNALLY
    /// initiated session (Siri / Shortcuts / widget deep-link handoff)
    /// persisted its block and applied the shield (contract C4 — the name
    /// literal is frozen cross-workstream). `MainNavigator` observes it to
    /// rehydrate the just-written block and present the live timer.
    static let lockedInSessionExternallyStarted = Notification.Name("lockedInSessionExternallyStarted")

    /// Posted by `RootView.startExternallyRequestedSession` when an external
    /// start (widget deep link / pending-intent handoff) was refused with
    /// `IntentServiceError.notAuthorized` / `.setupRequired`. `MainNavigator`
    /// observes it and presents `LockInSetupSheet` so the refusal is visible
    /// and fixable instead of a silently dead tap.
    static let lockedInExternalStartSetupRequired = Notification.Name("lockedInExternalStartSetupRequired")
}
