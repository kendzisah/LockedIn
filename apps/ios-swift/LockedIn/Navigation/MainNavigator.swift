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
                let stats = GuildService.shared.getMonthlyStats()
                let nextMissions = stats.missions_done + 1
                GuildService.shared.updateMonthlyStats(
                    missionsDone: nextMissions,
                    streakDays: streak
                )
                let focus = stats.focus_minutes
                Task {
                    _ = await GuildService.shared.completeMissionServerSide(
                        focusMinutes: focus,
                        missionsDone: nextMissions,
                        streakDays: streak
                    )
                }
            }

            // Route a finished manual session into the shared credit fan-out.
            // If the session was promoted from a scheduled window, mark the
            // occurrence credited first so the DAM extension's background
            // completion queue can't double-credit it. Skip marking on the
            // sub-60s bail (actualMinutes == 0) — let the background queue
            // credit it later if the window still runs to completion.
            activeSession.onFinish = { actualMinutes, wasNatural, scheduledOccurrenceId in
                if actualMinutes > 0, let occ = scheduledOccurrenceId {
                    scheduledSessions.markCredited(occ)
                }
                handleSessionFinish(actualMinutes: actualMinutes, wasNatural: wasNatural)
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
            resumeScheduledLiveIfNeeded()
            drainScheduledCompletions()
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
            // Recover any scheduled DeviceActivity monitoring that was dropped
            // while backgrounded (auth race / OS eviction) so background
            // blocking re-engages for upcoming windows.
            scheduledSessions.resyncMonitoring()
            resumeActiveExecutionBlockIfNeeded()
            resumeScheduledLiveIfNeeded()
            drainScheduledCompletions()
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
                PaywallOfferScreen(dailyMinutes: onboarding.dailyMinutes)
                    .environment(subscription)
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

    private func handleSessionFinish(actualMinutes: Int, wasNatural: Bool, showCompletionUI: Bool = true, occurredAt: Date = Date()) {
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
        // own their own `missions_done` increments via the
        // `onMissionCompleted` hook, so forward the cached monthly count
        // unchanged here — re-adding today's `completedCount` would
        // double-count (and any missions auto-completed by this session have
        // already bumped the cache before this Task runs).
        Task {
            let stats = GuildService.shared.getMonthlyStats()
            let nextFocus = stats.focus_minutes + actualMinutes
            let nextStreak = home.consecutiveStreak
            GuildService.shared.updateMonthlyStats(
                focusMinutes: nextFocus,
                streakDays: nextStreak
            )
            _ = await GuildService.shared.completeMissionServerSide(
                focusMinutes: nextFocus,
                missionsDone: stats.missions_done,
                streakDays: nextStreak
            )
        }
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
    /// Skips when a modal is already up, when no block is persisted, or when
    /// the persisted `endTimestamp` is already in the past (don't resurrect a
    /// stale timer — let the cold-start sweep clean it up).
    private func resumeActiveExecutionBlockIfNeeded() {
        guard lockIn.activeModal == nil else { return }

        // Live in memory (e.g. cold-start already rehydrated, or the user
        // minimized within the app) → just re-present the screen.
        if activeSession.isActive {
            lockIn.activeModal = .executionBlock
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
        guard let active = scheduledSessions.currentActiveOccurrence() else { return }

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

    /// Credit any scheduled lock-in sessions that auto-ran (shield applied by
    /// the DAM extension) while the app was backgrounded or killed. Each
    /// occurrence is credited once via the shared `handleSessionFinish` path,
    /// silently (no per-session completion cover). Safe to call repeatedly —
    /// the store dedupes by occurrence id and single-flights the drain.
    private func drainScheduledCompletions() {
        guard scheduledSessions.isHydrated else { return }
        let credited = scheduledSessions.drainPendingCompletions { minutes, endedAtMs in
            // Attribute the credit to when the session actually ran, not now.
            let occurredAt = Date(timeIntervalSince1970: endedAtMs / 1000)
            handleSessionFinish(
                actualMinutes: minutes,
                wasNatural: true,
                showCompletionUI: false,
                occurredAt: occurredAt
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
}
