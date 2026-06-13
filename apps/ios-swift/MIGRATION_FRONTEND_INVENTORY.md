# LockedIn — React Native → Swift iOS Migration: Frontend Inventory

Source root scanned: `/Users/ken/Application/LockedIn/apps/mobile/src/`
Target output: `apps/ios-swift/` (Swift rewrite).
Generated for 11 parallel implementation agents, one per feature folder + shared infra.

---

## 0. Top-level source layout

```
apps/mobile/src/
├── app/App.tsx                  # Root: provider tree + boot side-effects
├── config/env.ts                # EXPO_PUBLIC_* validation (Supabase, RevenueCat, AppsFlyer)
├── design/                      # Design tokens + reusable primitives
│   ├── colors.ts
│   ├── colorUtils.ts
│   ├── rankTiers.ts
│   ├── streakTiers.ts
│   ├── typography.ts
│   └── components/{AppGuideSheet, OptionItem, PrimaryButton, ProgressIndicator, ScreenContainer}.tsx
├── features/{auth,gym,home,leaderboard,missions,onboarding,report,settings,streak,subscription,trial}/
├── navigation/                  # React Navigation graph
│   ├── RootNavigator.tsx
│   ├── MainNavigator.tsx
│   ├── OnboardingNavigator.tsx
│   ├── TabNavigator.tsx
│   ├── LockInContext.ts
│   └── rootNavigationRef.ts
├── services/                    # Singleton service objects (Supabase, Notif, Analytics, etc.)
└── types/navigation.ts          # ParamList types
```

---

## 1. Feature folder map

### 1.1 `features/auth/` — Authentication

Files:
```
AuthProvider.tsx
AuthService.ts
components/AppleAuthButton.tsx
components/SignUpNudgeSheet.tsx
screens/EditProfileScreen.tsx
screens/ProfileTab.tsx         # re-exports SettingsScreen
screens/SignInScreen.tsx
screens/SignUpScreen.tsx
```

Screens:
- **SignUpScreen** (`screens/SignUpScreen.tsx`) — User registration with email/password + Apple Sign-In; glassmorphic gradient panel.
- **SignInScreen** (`screens/SignInScreen.tsx`) — Login with email/password + Apple Sign-In + forgot-password reset email.
- **EditProfileScreen** (`screens/EditProfileScreen.tsx`) — Display name + avatar upload (camera + photo library via expo-image-picker); `source: 'signup'|'profile'` route param.
- **ProfileTab** (`screens/ProfileTab.tsx`) — Single-line file: re-exports `SettingsScreen` as the Profile tab body.

Components:
- **AppleAuthButton** — Wraps `AppleAuthentication.AppleAuthenticationButton` (App Store-required style); iOS-only, returns null on Android.
- **SignUpNudgeSheet** — One-time bottom sheet shown at 3-day streak to nudge anonymous users to sign up; persists shown flag in `@lockedin/signup_nudge_streak3_shown`.

Provider (`AuthProvider.tsx`):
- Context value: `{ user, isAuthenticated, isAnonymous, isLoading, signUp, signIn, signInWithApple, linkAccount, linkAppleAccount, signOut, resetPasswordForEmail }`.
- State: `user: User | null`, `isLoading: boolean`. Computed: `isAuthenticated = user !== null && !user.is_anonymous`, `isAnonymous = user?.is_anonymous ?? false`.
- On mount: subscribes to `AuthService.onAuthStateChange`, then loads current session.
- `signOut` → resets analytics → `clearAllLockedInStorage()` → `emitLogoutCleanup()` → `GuildService.syncHasActiveGuildFlag()` → `NotificationService.cancelAllNotifications()` → re-establishes anonymous session.

Service (`AuthService.ts`) — public methods on singleton:
- `signUpWithEmail(email, password) → AuthResponse`
- `signInWithEmail(email, password) → AuthResponse`
- `signInWithApple() → AuthResponse` (uses `expo-apple-authentication`, requests FULL_NAME + EMAIL, calls `client.auth.signInWithIdToken({ provider:'apple', token })`).
- `linkEmailPassword(email, password) → AuthResponse` (anonymous → permanent via `auth.updateUser`).
- `linkAppleAccount()` (delegates to `signInWithApple`).
- `resetPasswordForEmail(email) → { error }` (uses `ENV.SUPABASE_PASSWORD_RESET_REDIRECT`).
- `signOut() → { error }`
- `getCurrentUser() → { user, session }`
- `onAuthStateChange(cb) → unsubscribe`
- Error mapping helpers handle `email_already_registered`, `email_confirmation_pending`, Apple `ERR_CANCELED`.

---

### 1.2 `features/gym/` — Gym check-in (used inside settings/missions, not a screen)

Files:
```
GymCheckInService.ts
components/GymCheckInCard.tsx
```

- **GymCheckInCard** — Glassmorphic card with weekly dots + streak count. Toggles "checked in today" via service.
- **GymCheckInService** (default export instance, not the singleton-object pattern):
  - `checkIn(date?: string) → void` (toggles)
  - `isCheckedInToday() → boolean`
  - `getWeeklyCount() → number`
  - `getMonthlyCount() → number`
  - `getStreak() → number` (consecutive days)
  - `getWeekCheckIns() → boolean[7]`
  - `getState_Public() → GymCheckInState`
  - `clear() → void`
  - State shape `{ checkins: Record<dateStr, boolean>, weeklyCount, monthlyCount, currentWeekStart, currentMonthStart }`, persisted at `@lockedin/gym_checkin`.

---

### 1.3 `features/home/` — Main HUD + focus session execution

Files:
```
ExecutionBlockScreen.tsx
SessionCompleteScreen.tsx
systemTokens.ts
engine/SessionEngine.ts
engine/CompletionCopy.ts
screens/HomeTab.tsx
state/SessionProvider.tsx
state/types.ts
components/{CompactMissions,FocusRing,HUDCornerBrackets,HUDPanel,MissionCompleteOverlay,
            RankUpOverlay,ScrollPicker,StatBar,StreakAtRiskBanner,StreakBreakOverlay,
            SystemStatusBar,XPBreakdown}.tsx
```

Screens:
- **HomeTab** (`screens/HomeTab.tsx`) — Tab body: gradient background, `StreakAtRiskBanner` if applicable, `SystemStatusBar` (OVR + stats), `FocusRing` (daily goal progress + ACTIVATE SESSION), `CompactMissions`, AppGuide first-run sheet. Handles resume of active execution block via `ACTIVE_EB_KEY` AsyncStorage value; auto-presents `StreakRecoveryModal`, `SignUpNudgeSheet`; fires `expo-store-review` after first tutorial dismiss.
- **ExecutionBlockScreen** (`ExecutionBlockScreen.tsx`) — Standalone immersive lock-in timer. Uses `useKeepAwake`, `expo-haptics`, `BackHandler`. Hold-to-unlock 2s to early-exit. Phase texts cycle every 20%. Drives `LockModeService` shield + `NotificationService.scheduleExecutionBlockDone`. Persists `{ startTimestamp, expectedEndTimestamp, durationMinutes }` at `@lockedin/active_execution_block`.
- **SessionCompleteScreen** (`SessionCompleteScreen.tsx`) — Post-session celebration. Lottie flame (`assets/lottie/fire.json`) with rank-color filter via `getFlameColorFilters`, streak checkpoint copy, `XPBreakdown` panel, `RankUpOverlay` if `RankService.detectRankChange` returns up.

Components (all dark-glassmorphic):
- **HUDPanel** — Shared shell with corner brackets, optional `// HEADER` row with gradient rule. Foundation for every HUD panel.
- **HUDCornerBrackets** — Four L-shaped SVG corner marks, pure SVG.
- **CompactMissions** — Quest-log row list of today's 3 missions; consumes `useMissions()`, tap navigates to MissionsTab.
- **FocusRing** — Reticle ring with SVG gradient stroke progress arc + daily-goal `StatBar` + "ACTIVATE SESSION" button wired to `LockInContext` (duration picker).
- **MissionCompleteOverlay** — 1.5s confetti-style toast; shows mission title + xp + "PERFECT EXECUTION" if all 3 done.
- **RankUpOverlay** — Full-screen takeover when rank threshold crossed; radial glow, heavy haptic, continue after 2s.
- **ScrollPicker** — Drum-roll number picker with haptic snap. Used in duration picker modal.
- **StatBar** — Labeled progress bar (3-letter stat label + bar + numeric value) with 800ms timing animation + 2px leading edge tip.
- **StreakAtRiskBanner** — Danger-color glass banner with `chevron-forward`; tap routes user to start a 15-min session.
- **StreakBreakOverlay** — Full-screen takeover when streak drops to 0; shows previous streak, previous rank, "preserved" reassurance.
- **SystemStatusBar** — Character HUD panel: OVR + rank + 5 stat bars + week blocks + streak readout; subscribes to `StatsService`.
- **XPBreakdown** — Stagger-fade XP rows panel (base + duration bonus + streak multiplier matching `XPService.computeXP`).

Engine:
- **SessionEngine** (`engine/SessionEngine.ts`) — Pure logic: `getTodayKey()`, `getYesterdayKey()`, `dayKeyFromTimestamp(ts)`, `dayKeyDelta(start, end)`, `createSession(durationMinutes)`, `getRemaining(expectedEndTimestamp)`, `getPhaseText(elapsed, total)`, `computeNewStreak(lastSessionDayKey, currentStreak, todayKey)`.
- **CompletionCopy** (`engine/CompletionCopy.ts`) — `getCompletionMessage(phase)` (random from `EXECUTION_BLOCK_MESSAGES`), `getStreakCheckpoint(streak)`.

systemTokens.ts:
- `SystemTokens` — Centralized HUD panel colors (`panelBg`, `panelBorder`, `bracketColor`, `divider`, `glowAccent`, `cyan`, `green`, `gold`, `purple`, `red`).
- `STAT_COLORS` — Per-stat colors (`discipline #3A66FF`, `focus #00C2FF`, `execution #00D68F`, `consistency #FFC857`, `social #A855F7`).
- `STAT_LABELS` — 3-letter codes (`DIS`, `FOC`, `EXE`, `CON`, `SOC`).
- `SectionLabelStyle`, `SectionMetaStyle` — Mono `// LABEL` text styles.
- `getHasBooted()` / `markBooted()` — Module-level one-time boot guard.

State (`state/SessionProvider.tsx`):
- Persistence key: `@lockedin/session_state` (full session state).
- Auxiliary keys: `@lockedin/af_first_session_sent`, `@lockedin/af_streak_milestones_sent`.
- State (`SessionState`): `phase: 'IDLE'|'ANIMATING'`, `programStartDate`, `maxCompletedDay`, `lastSessionDayKey`, `consecutiveStreak`, `lifetimeTotalMinutes`, `lifetimeLongestStreak`, `lifetimeRunsCompleted`, `lifetimeExecutionBlocks`, `lifetimeExecutionMinutes`, `lastLockInCompletedDate`, `dailyFocusedMinutes`, `dailyFocusDate`, `dailyGoalMetDate`, `weekCompletedDays: DayKey[]`.
- Reducer actions: `HYDRATE`, `SET_ANIMATING`, `COMPLETE_EXECUTION_BLOCK`, `ADD_DAILY_FOCUS`, `DAILY_GOAL_MET`, `RESET_PHASE`, `FULL_RESET`.
- Side-effects (in provider useEffects): syncs `Analytics.streakDays` + super props; emits `Streak Broken`, `Lock In Completed`; runs Stats/XP/Achievement pipeline on every execution block; fires AppsFlyer `af_first_lock_in`, `af_achievement_unlocked`, `af_level_achieved` per streak milestone (3, 7, 14, 30, 60, 90).

---

### 1.4 `features/leaderboard/` — Guilds + Discipline Board

Files:
```
GuildService.ts
LeaderboardService.ts
seasonDiscipline.ts
seasonMissionConsistency.ts
components/{EmptyGuildState,GuildCard,InviteCodeCard,MemberRow}.tsx
screens/{BoardTab,CreateGuildScreen,GuildDetailScreen,GuildListScreen,JoinGuildScreen,
         LeaderboardScreen}.tsx
```

Screens:
- **BoardTab** — One-line wrapper: renders `GuildListScreen`.
- **GuildListScreen** — Pull-to-refresh list of user's guilds; shows `EmptyGuildState` if none. Tap → GuildDetail. Action-sheet (iOS) for create/join. Listens for foreground refresh.
- **CreateGuildScreen** — Glass form: guild name input + create CTA. On success → navigate to GuildDetail with generated invite code.
- **JoinGuildScreen** — Animated invite-code entry (6 chars) + join CTA.
- **GuildDetailScreen** — Full guild view: header (name, share invite code), members ranked by `total_score`, leave/kick action sheets, refresh control. Reads `route.params.guild_id`.
- **LeaderboardScreen** — Global Discipline Board (top 50). Not currently linked from MainNavigator (kept for analytics-driven tier UI).

Components:
- **EmptyGuildState** — HUDPanel with shield icon + Create/Join CTAs.
- **GuildCard** — Glass row showing guild name, member count, user rank, top score.
- **InviteCodeCard** — Copy + share invite code; uses `expo-clipboard` and `Share.share`. Tracks `Guild Invite Shared`.
- **MemberRow** — Member row showing rank, avatar, username, focus minutes, missions done, streak, total score, OVR snapshot.

Service (`GuildService.ts`) — singleton object methods:
- `getCurrentWeekKey()` (ISO week, UTC-based, matches edge function)
- `syncHasActiveGuildFlag() → { hadGuildBefore, hasGuildNow }` (writes `@lockedin/has_active_guild`)
- `getMyGuilds() → MyGuildRow[]`
- `getGuildDetails(guildId) → GuildDetails | null`
- `getGuildLeaderboard(guildId) → GuildLeaderboardEntry[]`
- `createGuild(name) → CreateGuildResult | null`
- `joinGuild(code) → JoinGuildResult | null`
- `leaveGuild(guildId) → boolean`
- `kickMember(guildId, targetUserId) → boolean`
- `deleteGuild(guildId) → boolean`
- `getWeeklyStats() → WeeklyGuildStats` (reads `@lockedin/guild_week_stats`)
- `updateWeeklyStats(stats: Partial<WeeklyGuildStats>) → void`
- `completeMissionServerSide(timeGate, focusMinutes, missionsDone, streakDays) → { success, error? }`
- Constants exported: `HAS_ACTIVE_GUILD_STORAGE_KEY = '@lockedin/has_active_guild'`.

Service (`LeaderboardService.ts`):
- `DISCIPLINE_TIERS` — `['Recruit','Soldier','Vet','OG','Elite','Legend','Goat','Immortal','Locked In']`.
- `disciplineTierBadgeShort(tier) → string` (2-char badge label).
- `resolveDisciplineTier(score, lockedInMissionEligible) → DisciplineTier`.
- Singleton methods: `getTier(score)`, `submitWeeklyScore(...)`, `getLeaderboard(limit=50)`, `getUserRank(userId)`, `getTotalUsers()`, `getUserEntry(userId)`, `clear()`.

Season helpers (`seasonDiscipline.ts`):
- `SEASON_LENGTH_DAYS = 90`, anchor `2025-01-01 UTC`.
- `getSeasonIndex(now)`, `getCurrentSeasonId(now)` ("S0","S1",…), `getDayOfSeason(now)`, `getSeasonDaysElapsed(now)`.

Season mission consistency (`seasonMissionConsistency.ts`):
- Storage key `@lockedin/season_perfect_mission_days` → `{ seasonId, perfectDays: string[] }`.
- Exports `recordPerfectMissionDay(dateKey)` + `isLockedInMissionEligible()` (≥ 81/90 perfect days for top tier).

---

### 1.5 `features/missions/` — 3-slot daily mission engine + weekly challenges

Files:
```
MISSIONS_README.md
MissionData.ts
MissionEngine.ts
MissionsProvider.tsx
missionXpSeason.ts
index.ts
components/{DailyActivityCard,MissionCard,MissionHistoryPanel,MissionLogCard,
            MissionsPanel,StatGrowthPanel}.tsx
screens/MissionsTab.tsx
sheets/ActivityLogSheet.tsx
```

Screen:
- **MissionsTab** — Scrolling HUD: `MissionLogCard` (3 daily missions + N weekly), `DailyActivityCard`, `StatGrowthPanel`, `MissionHistoryPanel`. Cancels mission reminder notif when `lockedInToday`.

Components:
- **DailyActivityCard** — Goal-specific check-in. Reads onboarding goal, looks up `DAILY_ACTIVITY_BY_GOAL` template; "LOG ACTIVITY" opens `ActivityLogSheet`. Per-day completion key `@lockedin/daily_activity_done_<YYYY-MM-DD>`.
- **MissionCard** — Glass mission card; tap opens modal with full info + Complete CTA.
- **MissionLogCard** — Richer quest-log row used on MissionsTab; tappable to complete directly, with `Haptics.notificationAsync(Success)`.
- **MissionsPanel** — Standalone 3-mission panel with completion counter (alternative layout).
- **MissionHistoryPanel** — Today's completed/total + season XP + lifetime totals from `user_stats`.
- **StatGrowthPanel** — Aggregates `mission.stats[]` across today's set + surfaces weakest current stat.

Sheet:
- **ActivityLogSheet** — Modal w/ summary + optional note text input. On submit: `StatsService.bumpCounter('total_missions_completed',1)`, `XPService.award({type:'mission_complete'})`, callback up to DailyActivityCard which writes per-day flag.

Engine (`MissionEngine.ts`):
- Generates 3 daily missions (Slot 1 Core / Slot 2 Goal / Slot 3 Weakness).
- Difficulty tiers: Easy (wk 1-2), Medium (wk 3-4), Hard (wk 5+).
- Streak ≥ 7 → +10% XP bonus.
- Exports: `generateDailyMissions`, `generateWeeklyMissions`, `generateWeeklyReplacementMission`, `normalizeWeeklyMissions`, `getMissionWeekKey`, `getRemainingDaysInWeek`, `getCompletedCount`, `calculateTotalXP`, `MAX_WEEKLY_CHALLENGES`, `getMissionsForGoal`, `getPrimaryGoals`, `getWeaknessOptions`, `getDifficultyTier`, `MISSION_TYPE_STATS`.
- Types: `MissionType`, `CompletionType` (`'auto'|'self-report'|'hybrid'`), `DifficultyTier`, `MissionSlot`, `Mission`, `MissionDuration`, `ProgressMetric`.

Data (`MissionData.ts`):
- 10 Core + 105 Goal (7 goals × 15) + 40 Weakness (5 weaknesses × 8) = 155 templates.
- Per template: `{ title, description, type, completionType, xp: {easy,medium,hard}, timeGate?, variants?, duration?, progressTarget?, progressMetric? }`.

XP season (`missionXpSeason.ts`):
- Global 4-month seasons; anchor Jan 2026 = Season 1.
- `getMissionSeasonNumber(d)`, `getMissionSeasonLabel(d)`, storage key `KEY_MISSION_XP_SEASON = '@lockedin/mission_xp_season_number'`.

Provider (`MissionsProvider.tsx`) — full context:
- Storage keys: `KEY_MISSIONS='@lockedin/daily_missions'`, `KEY_DATE='@lockedin/daily_missions_date'`, `KEY_DAILY_PROFILE='@lockedin/daily_missions_profile'`, `KEY_CUMULATIVE_XP='@lockedin/cumulative_xp'`, `KEY_WEEKLY_MISSIONS='@lockedin/weekly_missions'`, `KEY_WEEKLY_WEEK='@lockedin/weekly_missions_week'`, `KEY_WEEKLY_PROFILE='@lockedin/weekly_missions_profile'`, `KEY_ACTIVE_DAYS='@lockedin/weekly_active_days'`, `KEY_EARLY_OPENS='@lockedin/weekly_early_opens'`.
- State (`MissionsState`): `missions, weeklyMissions, weekKey, date, completedCount, dailyXP, totalXP, lockedInToday`.
- Reducer actions: `HYDRATE`, `GENERATE_DAILY`, `COMPLETE_MISSION`, `UPDATE_DAILY_PROGRESS`, `SET_WEEKLY_MISSIONS`, `APPEND_WEEKLY_MISSION`, `UPDATE_WEEKLY_PROGRESS`, `RESET_DAY`, `FULL_LOGOUT_RESET`.
- Exposed API: `missionSeasonNumber`, `missionSeasonLabel`, `completeMission(id)`, `generateDailyMissions(goal)`, `regenerateTodaysMissions(override?)`, `resetDay()`, `checkAutoComplete(SessionCompleteData)`.
- Exported helpers: `recordActiveDay()`, `recordEarlyOpen()`.
- Side-effects: midnight timer to refresh, AppState→active re-hydration, per-mission Mixpanel events, queued `GuildService.completeMissionServerSide` submissions with retry.

`index.ts` — Public barrel exports: `generateDailyMissions`, `getMissionsForGoal`, `getPrimaryGoals`, `getWeaknessOptions`, `calculateTotalXP`, `getCompletedCount`, `getDifficultyTier`, `Mission`/`MissionType`/`CompletionType`/`DifficultyTier`/`MissionSlot`, `MissionsProvider`, `useMissions`, `MissionsState`, `MissionCard`.

---

### 1.6 `features/onboarding/` — 26-step "system awakening" flow

Files:
```
state/OnboardingProvider.tsx
state/types.ts
hooks/useOnboardingTracking.ts
components/{BenefitTemplate,CountUpNumber,HUDOptionCard,HUDSectionLabel,
            OnboardingProgressBar,TerminalLine,TypingText}.tsx
screens/{Definition,PhoneTimeQuiz,WakeUpCall,AgeQuiz,SituationQuiz,GoalQuiz,
         ControlQuiz,TriggersQuiz,MorningRoutineQuiz,DailyTimeCommitment,WhyNowQuiz,
         ControlLevel,SystemAnalysis,StatReveal,BenefitExecution,BenefitMissions,
         BenefitRanks,BenefitGuilds,BenefitReport,ScreenTimePreFrame,
         NotificationPreFrame,AccountPrompt,OnboardingAuth,Commitment,
         ScheduleSession,SocialProof,Paywall}Screen.tsx
```

Screens (one-line purpose each — for full file paths see folder listing):
1. **DefinitionScreen** — System Boot: typed `> SYSTEM INITIALIZING` lines + `INITIALIZE SYSTEM` CTA. Has sign-in escape.
2. **PhoneTimeQuizScreen** — Single-select phone-usage band. Drives Wake-Up Call math.
3. **WakeUpCallScreen** — Shock stat: "years of your life lost" using count-up + animated bars (mirrors Opal Focus Report).
4. **AgeQuizScreen** — Single-select age band; persists midpoint value.
5. **SituationQuizScreen** — Life stage: student/working/figuring/building/starting_over.
6. **GoalQuizScreen** — Primary goal single-select; drives mission slot 2 pool.
7. **ControlQuizScreen** — Weakness multi-select up to 2; drives mission slot 3.
8. **TriggersQuizScreen** — Multi-select up to 3 distraction triggers.
9. **MorningRoutineQuizScreen** — First wake-up action; brief system-response flash.
10. **DailyTimeCommitmentScreen** — Daily focus minutes single-select.
11. **WhyNowQuizScreen** — Motivation reason; selected value used for notif copy.
12. **ControlLevelScreen** — Self-rate control level; starts mission difficulty tier.
13. **SystemAnalysisScreen** — Terminal-style processing screen with `TerminalLine`s and auto-advance.
14. **StatRevealScreen** — Character-creation: OVR=1, stats=1, build summary inside HUD panel; 2s gate.
15. **BenefitExecutionScreen** — Phone-frame mock benefit graphic (uses `BenefitTemplate`).
16. **BenefitMissionsScreen** — Mission-rows benefit graphic.
17. **BenefitRanksScreen** — Rank ladder (top→bottom) using `RANK_TIERS`, highlights NPC.
18. **BenefitGuildsScreen** — Guild leaderboard preview.
19. **BenefitReportScreen** — Weekly report grade-bar preview.
20. **ScreenTimePreFrameScreen** — Lottie lock animation + iOS Family Controls authorization request via `PermissionService.requestScreenTimePermission()`.
21. **NotificationPreFrameScreen** — Lottie bell + push permission request via `PermissionService.requestNotificationPermission()`.
22. **AccountPromptScreen** — "Save my character" with optional skip; navigates to `OnboardingAuth`.
23. **OnboardingAuthScreen** — Inline signup/signin (`mode: 'signup'|'signin'`); Apple Sign-In; on success → Commitment.
24. **CommitmentScreen** — Commit pledge with typing animation.
25. **ScheduleSessionScreen** — Time-of-day picker for first session reminder; schedules local notif.
26. **SocialProofScreen** — Animated testimonial cards.
27. **PaywallScreen** — RevenueCat paywall with skip; fires `Onboarding Completed` analytics.

(Note: SCREEN_STEP_MAP has 26 unique steps — `OnboardingAuth` shares step 22 with `AccountPrompt` so the bar doesn't jump.)

Components:
- **BenefitTemplate** — Common scrollable panel layout for the 5 benefit screens: badge + title + body + `Graphic` slot, `PrimaryButton`, optional panel labels.
- **CountUpNumber** — Animated integer count-up; used for Wake-Up Call years + Stat Reveal OVR.
- **HUDOptionCard** — Shared option card primitive (2px left-border accent, glow when selected).
- **HUDSectionLabel** — Floating `// LABEL` header with gradient rule (used outside HUDPanel).
- **OnboardingProgressBar** — Persistent header above the stack; reads `useNavigationState` route name, tweens fill, hides for intro/immersive/paywall routes.
- **TerminalLine** — Single typed `> ...` line w/ green checkmark on completion.
- **TypingText** — Character-by-character typing primitive (default 40 ms/char).

Hook (`hooks/useOnboardingTracking.ts`):
- `useOnboardingTracking(screen: OnboardingScreenName, step?: number): void` — fires `Onboarding Screen Viewed` on mount, persists `currentScreen`, fires `Onboarding Screen Exited` w/ duration on unmount.
- `TOTAL_STEPS = 26`, key `@lockedin/onboarding_current_screen`.
- Helpers: `getPersistedOnboardingScreen()`, `clearPersistedOnboardingScreen()`.

State (`state/OnboardingProvider.tsx`):
- Storage keys: `@lockedin/onboarding_complete` (boolean flag), `@lockedin/onboarding_data` (JSON blob of all quiz answers).
- State (`OnboardingState`): `selectedWeaknesses: string[]`, `phoneUsageHours: string|null`, `userAge: number|null`, `dailyMinutes: number|null`, `primaryGoal: string|null`, `controlLevel: ControlLevel|null`, `vulnerableTime` (deprecated), `situation: Situation|null`, `triggers: Trigger[]`, `morningRoutine: MorningRoutine|null`, `whyNow: WhyNow|null`, `scheduledSessionTime: string|null`, `screenTimeStatus: ScreenTimeStatus`, `notificationsGranted: bool|null`, `demoCompleted: boolean`, `onboardingComplete: boolean`, `onboardingCompletedAt: string|null`, `currentScreen: string|null`.
- Reducer actions: `SET_WEAKNESSES, SET_PHONE_USAGE, SET_USER_AGE, SET_DAILY_MINUTES, SET_PRIMARY_GOAL, SET_CONTROL_LEVEL, SET_VULNERABLE_TIME, SET_SITUATION, SET_TRIGGERS, SET_MORNING_ROUTINE, SET_WHY_NOW, SET_SCHEDULED_SESSION_TIME, SET_SCREEN_TIME_STATUS, SET_NOTIFICATIONS_GRANTED, SET_DEMO_COMPLETED, COMPLETE_ONBOARDING, SET_CURRENT_SCREEN, HYDRATE_STATE, FULL_RESET`.
- On `COMPLETE_ONBOARDING` flip true: persists flag, clears `currentScreen`, sets Mixpanel user properties (`age, primary_goal, daily_commitment_minutes, phone_usage, weaknesses, situation, triggers, morning_routine, why_now, scheduled_session_time, screen_time_granted, notifications_granted, demo_completed, platform`), seeds `user_stats` via `StatsService.recompute()`.

Types (`state/types.ts`): `ScreenTimeStatus`, `ControlLevel`, `VulnerableTime` (deprecated), `Situation`, `Trigger`, `MorningRoutine`, `WhyNow`, `OnboardingState`, `OnboardingAction`.

---

### 1.7 `features/report/` — Weekly grade report

Files:
```
WeeklyReportService.ts
screens/WeeklyReportScreen.tsx
```

Screen:
- **WeeklyReportScreen** — Full-screen modal. Reads session + missions state, calls `WeeklyReportService.generateWeeklyReport`, renders grade card, animates haptic on view. Fires `Weekly Report Viewed`.

Service (`WeeklyReportService`) — default export instance:
- `generateWeeklyReport(sessionState, missionsState, dailyCommitment) → WeeklyReport` (40% days, 30% focus vs commitment, 30% missions; grades A+ … F).
- `saveReport(report)` (keeps last 12 weeks at `@lockedin/weekly_reports`).
- `getLastReport()`, `getAllReports()`.
- `shouldShowReport()` (Sunday + not yet shown this week per `@lockedin/report_shown_week`).
- `markReportAsShown()`.

---

### 1.8 `features/settings/` — Profile/settings unified screen

Files:
```
settingsConstants.ts
screens/SettingsScreen.tsx
components/{AchievementsRow,RecordsPanel,SettingsRow,SettingsSection,SettingsSheetShell,
            StatDetailSheet,StatPills,SystemStatsCard}.tsx
sheets/{ChangePasswordSheet,DailyCommitmentSheet,DeleteAccountSheet,GoalPickerSheet,
        ReminderTimeSheet,ResetDataSheet,WeaknessPickerSheet}.tsx
```

Screen:
- **SettingsScreen** — Profile tab body. Sections: Identity (avatar + display name), Plan (current entitlement), Notifications (master switch + streak alerts + guild updates + reminder time), Mission Targets (goal + weaknesses + daily commitment), System Stats (`SystemStatsCard`), `RecordsPanel`, `AchievementsRow`, Account (sign in/out, change password, reset data, delete account, edit profile), About (privacy, terms, version, share, rate, store review). Opens 7 different sheets.

Components:
- **AchievementsRow** — Horizontal-scroll badge grid in HUDPanel; queries `user_achievements` by user id; uses `ACHIEVEMENT_CATALOG`.
- **RecordsPanel** — Lifetime stats from `user_stats` row in HUDPanel.
- **SettingsRow** — Single row primitive with icon, label, optional value, optional switch + statusText; haptic on press.
- **SettingsSection** — HUDPanel-wrapped section with header label and dividers between children.
- **SettingsSheetShell** — Bottom-sheet wrapper (KeyboardAvoidingView + Pressable backdrop + cyan handle + mono header + corner brackets).
- **StatDetailSheet** — Per-stat info modal listing growth sources + 3 sample missions.
- **StatPills** — Bracketed 3-letter pills tinted with stat color.
- **SystemStatsCard** — Profile character-sheet panel: OVR + rank pill + 5 tappable stat bars (opens StatDetailSheet).

Sheets (all use `SettingsSheetShell`):
- **ChangePasswordSheet** — Current + new + confirm password, calls `SupabaseService.getClient().auth.updateUser`.
- **DailyCommitmentSheet** — Single-select duration `[15,30,45,60,90,120]` minutes; updates reminder text in NotificationService.
- **DeleteAccountSheet** — Final-confirm delete, calls Supabase RPC, clears all `@lockedin/` storage, fires `Account Deleted`.
- **GoalPickerSheet** — Primary goal picker; emits `Settings Changed` with new goal; triggers mission regeneration.
- **ReminderTimeSheet** — iOS-style Picker hours/AM-PM/minutes; saves via `persistReminderTimeHHmm`; reschedules notifs.
- **ResetDataSheet** — Confirm + run `clearAllLockedInStorage()` + onConfirm callback.
- **WeaknessPickerSheet** — Multi-select up to 2 weakness options.

Constants (`settingsConstants.ts`):
- `IOS_APP_STORE_PAGE_URL` (override via `EXPO_PUBLIC_IOS_APP_STORE_URL`).
- `PRIVACY_POLICY_URL`, `TERMS_URL`.
- `iosAppStoreReviewUrl()`, `iosShareMessage()`.

---

### 1.9 `features/streak/` — Streak recovery

Files:
```
StreakRecoveryService.ts
components/StreakRecoveryModal.tsx
```

Component:
- **StreakRecoveryModal** — Full-screen modal asking the user to commit to a 15-min recovery session.

Service (`StreakRecoveryService` — static class methods):
- Storage key `@lockedin/streak_recovery`.
- State `{ lastRecoveryDate, recoveriesUsedThisWeek, weekStartDate }`.
- `MAX_RECOVERIES_PER_WEEK = 2`, `REQUIRED_SESSION_MINUTES = 15`.
- Methods: `canRecover()`, `useRecovery(currentStreak)`, `getRecoveryStatus() → { available, usedThisWeek, maxPerWeek }`, `resetState()`.

---

### 1.10 `features/subscription/` — RevenueCat paywalls

Files:
```
SubscriptionProvider.tsx
PaywallScreen.tsx          # post-onboarding hard gate (alternative)
PaywallOfferScreen.tsx     # mid-app paywall (Lock In Tab gated)
```

Provider (`SubscriptionProvider.tsx`):
- Context value: `{ isSubscribed, isLoading, showPaywall(), restorePurchases() }`.
- On mount: `SubscriptionService.initialize()`, identify user in Mixpanel with RevenueCat anonymous ID, attach `addListener`.
- Watches auth: on `isAuthenticated && user.id !== loggedInUser` calls `SubscriptionService.logIn(user.id)`.
- On logout cleanup: `Purchases.logOut()`, clears cached state.
- `showPaywall()` → `RevenueCatUI.presentPaywall()` → fires `af_start_trial`/`af_subscribe` + Mixpanel events.

Screens:
- **PaywallScreen** — Post-onboarding hard gate; presents RevenueCat paywall, falls back to "View Plans" / "Restore Purchases" if dismissed.
- **PaywallOfferScreen** — Mid-app version reached from `MainNavigator` when a non-subscribed user taps Lock In; same backing screen, different analytics source label.

---

### 1.11 `features/trial/` — 3-day trial challenge

Files:
```
TrialChallengeService.ts
components/TrialChallengeCard.tsx
```

Component:
- **TrialChallengeCard** — Day-by-day progress card (Day 1, 2, 3 tick markers).

Service (`TrialChallengeService` — static class methods):
- Storage key `@lockedin/trial_challenge`, `TRIAL_DURATION_DAYS = 3`.
- State `{ startDate: ISO, days: TrialDay[3], completed: boolean }`.
- Methods: `initializeTrial()`, `isTrialActive()`, `getTrialDay() → 0|1|2|3`, `updateFocusMinutes(day, minutes)`, `completeTrialTask(day, task)` where `task ∈ 'focusSession'|'beatFocusTime'|'missions'|'disciplineReport'`, `getTrialProgress()`, `getTrialTimeRemaining() → {hours, minutes, expired}`, `resetTrial()`.

---

## 2. Navigation tree

### 2.1 Navigation files

`src/types/navigation.ts` — All `ParamList` types.
`src/navigation/RootNavigator.tsx` — Conditional root.
`src/navigation/OnboardingNavigator.tsx` — Onboarding stack with persistent progress header.
`src/navigation/MainNavigator.tsx` — Main stack + global duration picker modal.
`src/navigation/TabNavigator.tsx` — Bottom tabs (5 tabs).
`src/navigation/LockInContext.ts` — `React.createContext<() => void>` for Lock-In tab callback.
`src/navigation/rootNavigationRef.ts` — `createNavigationContainerRef<RootStackParamList>()` for imperative nav (used by App.tsx notifications and DurationPickerModal).

### 2.2 Hierarchy

```
NavigationContainer (ref=rootNavigationRef)
└─ RootStack (initial=Main or Onboarding, no headers, gestures disabled)
   ├─ "Onboarding" (NavigatorScreenParams<OnboardingStackParamList>)
   │  └─ OnboardingStack
   │     ├─ Definition, PhoneTimeQuiz, WakeUpCall, AgeQuiz, Situation,
   │     │  GoalQuiz, ControlQuiz, Triggers, MorningRoutine,
   │     │  DailyTimeCommitment, WhyNow, ControlLevel, SystemAnalysis,
   │     │  StatReveal, BenefitExecution, BenefitMissions, BenefitRanks,
   │     │  BenefitGuilds, BenefitReport, ScreenTimePreFrame,
   │     │  NotificationPreFrame, AccountPrompt, Commitment,
   │     │  ScheduleSession, SocialProof, Paywall — all `animation: 'fade'`
   │     ├─ OnboardingAuth ({mode?:'signup'|'signin'}) — `animation: 'slide_from_bottom'`
   │     └─ Custom header: <OnboardingProgressBar/> rendered for every screen
   └─ "Main" (NavigatorScreenParams<MainStackParamList>)
      └─ MainStack (default animation = native push)
         ├─ Tabs (NavigatorScreenParams<TabParamList>)
         │  └─ TabNavigator (bottom tabs)
         │     ├─ HomeTab    → HomeTab component, ionicon "home"
         │     ├─ MissionsTab → MissionsTab component, ionicon "flash"
         │     ├─ LockInTab  → empty component + custom <LockInButton> (Lottie lock_close, opens DurationPickerModal)
         │     ├─ BoardTab   → BoardTab (GuildListScreen), label "GUILD", ionicon "shield"
         │     └─ ProfileTab → ProfileTab (SettingsScreen), ionicon "person"
         ├─ PaywallOffer        animation: 'fade'
         ├─ ExecutionBlock      animation: 'none'         params: { durationMinutes, resumeEndTimestamp? }
         ├─ SessionComplete     animation: 'fade'         params: { phase:'execution_block', durationMinutes, streak }
         ├─ SignUp              animation: 'fade'
         ├─ SignIn              animation: 'fade'
         ├─ EditProfile         animation: 'slide_from_right'   params: { source:'signup'|'profile' }
         ├─ WeeklyReport        animation: 'fade'
         ├─ GuildDetail         animation: 'slide_from_right'   params: { guild_id }
         ├─ CreateGuild         animation: 'slide_from_right'
         └─ JoinGuild           animation: 'slide_from_right'

         + DurationPickerModal mounted outside the stack (RN <Modal> with animationType="fade", overlay 0.75 black, HUD card). Opens via LockInContext callback.
```

`RootNavigator` chooses between Onboarding and Main based on `useOnboarding().state.onboardingComplete`.
All param types are 1:1 with `types/navigation.ts`.

---

## 3. State management — All `createContext` providers

Provider nesting in `src/app/App.tsx` (outer → inner):
```
SafeAreaProvider
└─ AuthProvider                  (features/auth/AuthProvider.tsx)
   └─ OnboardingProvider         (features/onboarding/state/OnboardingProvider.tsx)
      └─ SubscriptionProvider    (features/subscription/SubscriptionProvider.tsx)
         └─ SessionProvider      (features/home/state/SessionProvider.tsx)
            └─ MissionsBridge → MissionsProvider   (features/missions/MissionsProvider.tsx)
               └─ NavigationContainer
                  └─ RootNavigator
```

There is also `LockInContext` (`navigation/LockInContext.ts`) — narrow callback context provided inside `MainNavigator` so `TabNavigator.LockInButton` can open the duration picker. Default value: `() => {}`.

### 3.1 AuthProvider
- State: `user: User|null`, `isLoading: bool`. Derived: `isAuthenticated`, `isAnonymous`.
- No reducer. No AsyncStorage (Supabase session persisted to SecureStore via `SupabaseService`).
- Actions exposed as callbacks: `signUp, signIn, signInWithApple, linkAccount, linkAppleAccount, signOut, resetPasswordForEmail`.

### 3.2 OnboardingProvider
- Reducer over `OnboardingState`. See §1.6 for full action list.
- Persistence keys: `@lockedin/onboarding_complete`, `@lockedin/onboarding_data`.
- Listens to `subscribeLogoutCleanup` to fire `FULL_RESET`.

### 3.3 SubscriptionProvider
- Plain `useState<bool>` (`isSubscribed`, `isLoading`).
- No persistence (RevenueCat owns it).

### 3.4 SessionProvider
- Reducer over `SessionState`. See §1.3 for full action list.
- Persistence key: `@lockedin/session_state` (the full `PersistedSessionState`).
- Auxiliary keys: `@lockedin/af_first_session_sent`, `@lockedin/af_streak_milestones_sent`.
- Listens to `subscribeLogoutCleanup` to fire `FULL_RESET`.

### 3.5 MissionsProvider
- Reducer over `MissionsState`. See §1.5 for full action list and storage keys.

### 3.6 LockInContext
- Just `React.createContext<() => void>(() => {})` so `LockInButton` in `TabNavigator` can trigger `MainNavigator`'s duration picker modal.

---

## 4. AsyncStorage keys

Run output (`apps/mobile/src`):

| Key | Owner feature | Notes |
|-----|---------------|-------|
| `@lockedin/active_execution_block` | home (ExecutionBlockScreen) | `{startTimestamp,expectedEndTimestamp,durationMinutes}`; HomeTab also reads to resume. Mirror in App Group if foreground sweep should match extension's `sessionEndTimestamp`. |
| `@lockedin/af_first_session_sent` | home (SessionProvider) | AppsFlyer dedupe. |
| `@lockedin/af_streak_milestones_sent` | home (SessionProvider) | AppsFlyer milestone dedupe. |
| `@lockedin/af_tutorial_home_guide_sent` | home (HomeTab) | AppsFlyer `af_tutorial_completion` dedupe. |
| `@lockedin/crew_cached_rank` | _legacy_ → migrated by `StorageMigrations` | Sentinel `@lockedin/migrations_crew_to_guild_v1`. |
| `@lockedin/crew_first_nudge_sent` | _legacy_ | Migrated to guild_first_nudge_sent. |
| `@lockedin/crew_week_stats` | _legacy_ | Migrated to guild_week_stats. |
| `@lockedin/cumulative_xp` | missions (MissionsProvider) | Season-aware cumulative XP. |
| `@lockedin/daily_activity_done_<YYYY-MM-DD>` | missions (DailyActivityCard) | Per-day completion flag prefix. |
| `@lockedin/daily_missions` | missions (MissionsProvider) | JSON Mission[]. |
| `@lockedin/daily_missions_date` | missions | YYYY-MM-DD. |
| `@lockedin/daily_missions_profile` | missions | `goal::sorted_weaknesses` cache key. |
| `@lockedin/first_session_reminder` | onboarding (ScheduleSessionScreen) — referenced by Notification scheduler. |
| `@lockedin/guide_<screen>` | design (AppGuideSheet) | Per-screen first-run dismissal. |
| `@lockedin/guild_cached_rank` | leaderboard (NotificationService) | Used for guild scheduling. |
| `@lockedin/guild_first_nudge_sent` | leaderboard (NotificationService) | First-time guild nudge dedupe. |
| `@lockedin/guild_week_stats` | leaderboard (GuildService) | `{week_key, focus_minutes, missions_done, streak_days}`. |
| `@lockedin/gym_checkin` | gym (GymCheckInService) | Full check-in state. |
| `@lockedin/has_active_crew` | _legacy_ | Migrated to has_active_guild. |
| `@lockedin/has_active_guild` | leaderboard (GuildService, NotificationService, AnalyticsService) | Boolean string `'true'/'false'`. |
| `@lockedin/has_launched` | services (SupabaseService) | Fresh-install detection; if missing on cold start, signs out stale Keychain session. |
| `@lockedin/last_app_open` | App.tsx, NotificationService | ISO; drives "App Returned" + win-back notifs. |
| `@lockedin/migrations_crew_to_guild_v1` | services (StorageMigrations) | Sentinel for crew→guild migration. |
| `@lockedin/milestone_notifs_sent` | NotificationService | Streak milestone notif dedupe. |
| `@lockedin/mission_xp_season_number` | missions (missionXpSeason) | Resets cumulative XP across 4-month seasons. |
| `@lockedin/notif_crew_updates` | _legacy_ | Migrated to notif_guild_updates. |
| `@lockedin/notif_guild_updates` | NotificationService | Boolean string. |
| `@lockedin/notif_permission_granted` | NotificationService | Cached OS permission. |
| `@lockedin/notif_streak_alerts` | NotificationService | Boolean string. |
| `@lockedin/notif_user_disabled` | NotificationService (exported `KEY_NOTIF_USER_DISABLED`) | User in-app master toggle. |
| `@lockedin/onboarding_complete` | onboarding (OnboardingProvider) | `'true'` once finished. |
| `@lockedin/onboarding_current_screen` | onboarding (useOnboardingTracking) | Resume on restart. |
| `@lockedin/onboarding_data` | onboarding (OnboardingProvider) | JSON quiz answers blob. |
| `@lockedin/pending_signup` | home (HomeTab) | Defers signup nudge until next foreground. |
| `@lockedin/reminder_time` | NotificationService | `{hour, minute}` JSON. |
| `@lockedin/report_shown_week` | report (WeeklyReportService) | Week number string. |
| `@lockedin/season_perfect_mission_days` | leaderboard (seasonMissionConsistency) | `{seasonId, perfectDays}`. |
| `@lockedin/session_state` | home (SessionProvider) | Full `PersistedSessionState`. |
| `@lockedin/signup_nudge_streak3_shown` | auth (SignUpNudgeSheet) | One-time gate. |
| `@lockedin/signup_prompt_dismissed` | — referenced by HomeTab/auth nudge family. |
| `@lockedin/store_review_after_guide` | home (HomeTab) | One-time store review prompt. |
| `@lockedin/streak_recovery` | streak (StreakRecoveryService) | `{lastRecoveryDate, recoveriesUsedThisWeek, weekStartDate}`. |
| `@lockedin/trial_challenge` | trial (TrialChallengeService) | `{startDate, days[3], completed}`. |
| `@lockedin/weekly_active_days` | missions (MissionsProvider.recordActiveDay) | `{weekKey, days[]}`. |
| `@lockedin/weekly_early_opens` | missions (MissionsProvider.recordEarlyOpen) | `{weekKey, days[]}` for pre-9am opens. |
| `@lockedin/weekly_missions` | missions | JSON Mission[]. |
| `@lockedin/weekly_missions_profile` | missions | Same `goal::weaknesses` key. |
| `@lockedin/weekly_missions_week` | missions | ISO week. |
| `@lockedin/weekly_reports` | report (WeeklyReportService) | Last 12 reports. |

> Note: the rg sweep also caught `@lockedin/shared` and `@lockedin/supabase` — these are **package import paths** (`@lockedin/shared-types`, `@lockedin/supabase-client`), not storage keys. Ignore.

### App Group key migration (`group.com.flocktechnologies.lockedin`)

The Device Activity Monitor extension and `ScreenTimeModule.swift` share **UserDefaults** (NOT AsyncStorage) under the suite name `group.com.flocktechnologies.lockedin`. Per `apps/mobile/modules/screen-time/ios/SharedScreenTimeConstants.swift`:

| Shared UserDefaults key | Type | Written by | Read by |
|-------------------------|------|------------|---------|
| `com.lockedin.screentime.selection` | Data (encoded `FamilyActivitySelection`) | `ScreenTimeModule` (main app) | DeviceActivityMonitor extension + main app |
| `com.lockedin.screentime.sessionEndTimestamp` | Int64 epoch-ms | `ScreenTimeModule` | DeviceActivityMonitor extension (sanity check) + main app foreground sweep |

For the Swift migration, the **only** AsyncStorage key that must be **mirrored into the App Group UserDefaults** is the session end-timestamp / lock-mode session info (currently shipped via the dedicated `sessionEndTimestamp` UserDefaults key). The AsyncStorage equivalent `@lockedin/active_execution_block` is JS-only — it should be replaced by the same App Group UserDefaults key already in use. Other AsyncStorage keys do not cross the JS↔extension boundary and can stay in the main app's standard `UserDefaults` / file storage.

---

## 5. Native module / platform usage

Grouped by NPM package, with file:line per call site:

### `expo-notifications`
- `app/App.tsx:4` — `Notifications.addNotificationResponseReceivedListener` for tap deep links.
- `services/NotificationService.ts:8` — scheduleNotificationAsync, cancelScheduledNotificationAsync, setNotificationChannelAsync, getPermissionsAsync, requestPermissionsAsync, AndroidImportance.
- `services/PermissionService.ts:28` — dynamic import + `requestPermissionsAsync`.
- `features/onboarding/screens/ScheduleSessionScreen.tsx:12` — `scheduleNotificationAsync` for first-session reminder.
- `features/settings/screens/SettingsScreen.tsx:47` — permission status read.

### `expo-status-bar`
- `app/App.tsx:5` — `<StatusBar style="light" />`.

### `expo-splash-screen`
- `app/App.tsx:7` — `SplashScreen.preventAutoHideAsync()`, `SplashScreen.hideAsync()`.

### `expo-font`
- `app/App.tsx:8` — `useFonts({Inter_400Regular, Inter_500Medium, InterTight_600SemiBold, InterTight_700Bold, InterTight_800ExtraBold, JetBrainsMono_400Regular, JetBrainsMono_700Bold})`.

### `@expo-google-fonts/inter`, `@expo-google-fonts/inter-tight`, `@expo-google-fonts/jetbrains-mono`
- `app/App.tsx:9-15` — Imports of the 7 weights above.

### `expo-tracking-transparency`
- `app/App.tsx:25` — `requestTrackingPermissionsAsync()` after fonts+auth ready (iOS).

### `expo-apple-authentication`
- `features/auth/AuthService.ts:16` — `isAvailableAsync`, `signInAsync({requestedScopes:[FULL_NAME,EMAIL]})`.
- `features/auth/components/AppleAuthButton.tsx:1` — `AppleAuthenticationButton`, `AppleAuthenticationScope`, `AppleAuthenticationButtonStyle.WHITE`.
- `features/auth/screens/SignUpScreen.tsx:25`, `SignInScreen.tsx:24` — Button type enums.
- `features/onboarding/screens/OnboardingAuthScreen.tsx:32` — Same.

### `expo-linear-gradient`
Used for screen backgrounds, button shines, panel header rules across:
- `navigation/MainNavigator.tsx:5`, `design/components/AppGuideSheet.tsx:28`, `features/auth/screens/SignInScreen.tsx:25`, `features/auth/screens/SignUpScreen.tsx:23`, `features/home/components/HUDPanel.tsx:19`, `features/home/screens/HomeTab.tsx:14`, `features/leaderboard/screens/GuildDetailScreen.tsx:17`, `features/leaderboard/screens/GuildListScreen.tsx:12`, `features/missions/screens/MissionsTab.tsx:10`, `features/onboarding/components/HUDSectionLabel.tsx:10`, `features/onboarding/screens/OnboardingAuthScreen.tsx:29`, `features/onboarding/screens/PaywallScreen.tsx:10`, `features/onboarding/screens/StatRevealScreen.tsx:19`, `features/report/screens/WeeklyReportScreen.tsx:11`, `features/settings/components/SettingsSheetShell.tsx:20`, `features/settings/screens/SettingsScreen.tsx:57`, `features/subscription/PaywallOfferScreen.tsx:12`.

### `expo-haptics`
Tap and selection feedback. Sites (representative):
- `features/home/ExecutionBlockScreen.tsx:22`, `SessionCompleteScreen.tsx:33`, `components/RankUpOverlay.tsx:23`, `components/ScrollPicker.tsx:15`, `components/StreakBreakOverlay.tsx:19`.
- `features/missions/components/MissionCard.tsx:15`, `components/MissionLogCard.tsx:9`, `sheets/ActivityLogSheet.tsx:26`.
- `features/onboarding/components/BenefitTemplate.tsx:10`, plus most quiz/intro screens.
- `features/subscription/PaywallOfferScreen.tsx:18`, `features/report/screens/WeeklyReportScreen.tsx:13`, `features/gym/components/GymCheckInCard.tsx:13`.

### `expo-keep-awake`
- `features/home/ExecutionBlockScreen.tsx:21` — `useKeepAwake()` during active sessions.

### `expo-store-review`
- `features/home/screens/HomeTab.tsx:40` — `StoreReview.isAvailableAsync`, `requestReview` once after first guide.
- `features/settings/screens/SettingsScreen.tsx:24` — Same plus fallback to App Store URL.

### `expo-constants`
- `services/AnalyticsService.ts:14` — `Constants.expoConfig?.version` for `app_version`.
- `features/settings/screens/SettingsScreen.tsx:25` — Version display.

### `expo-image-picker`
- `features/auth/screens/EditProfileScreen.tsx:19` — Dynamic `require('expo-image-picker')`; `requestCameraPermissionsAsync`, `requestMediaLibraryPermissionsAsync`, `launchCameraAsync`, `launchImageLibraryAsync` with `aspect:[1,1], quality:0.7, allowsEditing:true`.

### `expo-secure-store`
- `services/SupabaseService.ts:12` — `SecureStoreAdapter` (`getItemAsync`, `setItemAsync`, `deleteItemAsync`) used as Supabase token persistence.

### `expo-clipboard` (dynamic require)
- `features/leaderboard/components/InviteCodeCard.tsx:9-14` — `Clipboard.setStringAsync` for invite code copy.

### `lottie-react-native`
- `features/home/SessionCompleteScreen.tsx:17` — `fire.json` with rank-color filters.
- `features/onboarding/screens/ScreenTimePreFrameScreen.tsx:10` — `lock_close.json`.
- `features/onboarding/screens/NotificationPreFrameScreen.tsx:9` — `bell-ring.json`.
- `navigation/TabNavigator.tsx:5` — `lock_close.json` for the Lock In tab button.

### `react-native-svg`
- Used by HUD panels and onboarding graphics:
  - `features/home/components/FocusRing.tsx:17-24` (Svg, Circle, Defs, LinearGradient, Stop, G, Line).
  - `features/home/components/HUDCornerBrackets.tsx:9` (Svg, Path).
  - `features/onboarding/screens/PhoneTimeQuizScreen.tsx:10` (Svg, Rect).
  - `features/onboarding/screens/BenefitReportScreen.tsx:10` (Svg, Defs, LinearGradient, Rect, Stop).
  - `design/components/AppGuideSheet.tsx:29` (Svg, Path).

### `react-native-safe-area-context`
- `app/App.tsx:6` (`SafeAreaProvider`) + every screen-level component uses `SafeAreaView` or `useSafeAreaInsets`.

### `react-native-purchases`
- `app/App.tsx:36` — `Purchases.collectDeviceIdentifiers()` after ATT prompt.
- `services/SubscriptionService.ts:10-14` — Full SDK use.
- `features/subscription/SubscriptionProvider.tsx:2` — `getCustomerInfo`, `addCustomerInfoUpdateListener`, `logIn`, `logOut`, `restorePurchases` via the service.

### `react-native-purchases-ui`
- `features/subscription/SubscriptionProvider.tsx:3` — `RevenueCatUI.presentPaywall()`.

### `mixpanel-react-native` + `@mixpanel/react-native-session-replay`
- `services/MixpanelService.ts:1-6` — `Mixpanel` constructor, `MPSessionReplay`, masking config.

### `react-native-appsflyer` (native, dynamic require)
- `services/AppsFlyerService.ts:8` — `require('react-native-appsflyer').default`; `initSdk`, `startSdk`, `getAppsFlyerUID`, `setAdditionalData`, `logEvent`.

### `@supabase/supabase-js`
- `features/auth/AuthProvider.tsx:20`, `features/auth/AuthService.ts:15`, `features/settings/screens/SettingsScreen.tsx:30`, `services/SupabaseService.ts:11`, `features/leaderboard/LeaderboardService.ts:1`.

### `@react-native-async-storage/async-storage`
- ~25 files (every persistence consumer; full list in §1 storage keys).

### `@react-native-picker/picker`
- `features/settings/sheets/ReminderTimeSheet.tsx:3` — iOS-style 3-column picker.

### `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`
- `navigation/RootNavigator.tsx`, `MainNavigator.tsx`, `OnboardingNavigator.tsx`, `TabNavigator.tsx`, `rootNavigationRef.ts`.
- Many screens use `useNavigation`, `useFocusEffect`, `useNavigationState`.

### `@expo/vector-icons` (`Ionicons`, `MaterialIcons`, `MaterialCommunityIcons`)
- 30+ component / screen usages (tab icons, settings rows, mission cards, quiz options, leaderboard rows).

### `expo-linking` / `Linking` (React Native core)
- See §8 (no event listeners — outbound only).

---

## 6. Permissions requested

| Permission | Where requested | Notes |
|------------|-----------------|-------|
| ATT (App Tracking Transparency) | `apps/mobile/src/app/App.tsx:173` — `requestTrackingPermissionsAsync()` once after fonts+auth boot ready, iOS only. Triggers `Purchases.collectDeviceIdentifiers()` post-grant. |
| Push notifications | `services/NotificationService.ts:301` `Notifications.requestPermissionsAsync()`; also `services/PermissionService.ts:37` (dynamic-import variant used by `NotificationPreFrameScreen`). |
| iOS Family Controls / Screen Time (Device Activity Monitor) | `services/PermissionService.ts:10` — `await ScreenTime.requestAuthorization()` via the native `modules/screen-time` Expo module. Called from `ScreenTimePreFrameScreen`. Persists status to `OnboardingProvider.screenTimeStatus`. |
| Camera | `features/auth/screens/EditProfileScreen.tsx:96` — `ImagePicker.requestCameraPermissionsAsync()`. |
| Photo library | `features/auth/screens/EditProfileScreen.tsx:114` — `ImagePicker.requestMediaLibraryPermissionsAsync()`. |
| (No microphone, contacts, location requests detected.) |

---

## 7. Assets

### 7.1 Asset files (from `apps/mobile/assets`)
```
adaptive-icon.png
bg/black_waves.jpg
favicon.png
icon.png
icons/apple-touch-icon.png
icons/favicon-96x96.png
icons/favicon.ico
icons/favicon.svg
icons/lockedin-logo.png
icons/site.webmanifest
icons/web-app-manifest-192x192.png
icons/web-app-manifest-512x512.png
images/mountain-bg.png
images/staircase-bg.png
lottie/bell-ring.json
lottie/checkmark-draw.json
lottie/completion-pulse.json
lottie/dark-fire.json
lottie/fire.json
lottie/ink-sign.json
lottie/lock_close.json
lottie/star-fill.json
splash-icon.png
```

### 7.2 Lottie file consumers
| Lottie file | Consumed by |
|-------------|-------------|
| `lottie/fire.json` | `features/home/SessionCompleteScreen.tsx:191` |
| `lottie/lock_close.json` | `features/onboarding/screens/ScreenTimePreFrameScreen.tsx:107`, `navigation/TabNavigator.tsx:37` |
| `lottie/bell-ring.json` | `features/onboarding/screens/NotificationPreFrameScreen.tsx:93` |
| `lottie/dark-fire.json`, `lottie/checkmark-draw.json`, `lottie/completion-pulse.json`, `lottie/ink-sign.json`, `lottie/star-fill.json` | **No consumers in `apps/mobile/src`** — likely orphaned. Verify before dropping. |

### 7.3 Font weights loaded
From `apps/mobile/src/app/App.tsx`:
- `Inter_400Regular` (`@expo-google-fonts/inter/400Regular`)
- `Inter_500Medium` (`@expo-google-fonts/inter/500Medium`)
- `InterTight_600SemiBold` (`@expo-google-fonts/inter-tight/600SemiBold`)
- `InterTight_700Bold` (`@expo-google-fonts/inter-tight/700Bold`)
- `InterTight_800ExtraBold` (`@expo-google-fonts/inter-tight/800ExtraBold`)
- `JetBrainsMono_400Regular` (`@expo-google-fonts/jetbrains-mono/400Regular`)
- `JetBrainsMono_700Bold` (`@expo-google-fonts/jetbrains-mono/700Bold`)

`design/typography.ts` aliases these via `FontFamily.heading{Bold,SemiBold}`, `FontFamily.body{Medium,}`, `FontFamily.mono{Bold,}`.

### 7.4 Other static images
- `bg/black_waves.jpg`, `images/mountain-bg.png`, `images/staircase-bg.png` — Not referenced from `src/` via `require()` after scan; may be referenced from `app.json` splash/icon config only.

---

## 8. Deep link routes

### 8.1 Native handler
No `Linking.addEventListener` or `Linking.getInitialURL` callers exist in `apps/mobile/src` — deep linking inbound is **not** wired via the React Native `Linking` API. Inbound notification deep links are handled by `Notifications.addNotificationResponseReceivedListener` in `app/App.tsx:206` and map to the routes below using `rootNavigationRef`.

### 8.2 URL scheme
`apps/mobile/app.json:5` — `"scheme": "lockedin"` (so `lockedin://` is registered, but no in-app routes are tied to it).

### 8.3 Notification-driven navigation (`app/App.tsx:206-237`)
The `NotificationPayload.screen` field maps to:
| `screen` value | Target route |
|----------------|--------------|
| `'Home'` | `Main → Tabs → HomeTab` |
| `'GuildList'` | `Main → Tabs → BoardTab` |
| `'GuildDetail'` | `Main → GuildDetail` with `{guild_id}` from payload |

### 8.4 Outbound `Linking.openURL` / `Linking.openSettings`
- `features/settings/screens/SettingsScreen.tsx:201` — `Linking.openSettings()` (open OS settings for notifications etc.).
- `features/settings/screens/SettingsScreen.tsx:403` — App Store / external `Linking.openURL(...)`.
- `features/settings/screens/SettingsScreen.tsx:490,492` — `Linking.openURL(iosAppStoreReviewUrl())`.
- `features/settings/screens/SettingsScreen.tsx:504` — `Linking.openURL(PRIVACY_POLICY_URL)`.
- `features/settings/screens/SettingsScreen.tsx:509` — `Linking.openURL(TERMS_URL)`.

---

## 9. Analytics events

All Mixpanel events flow through `Analytics.track(event, properties?)` (`services/AnalyticsService.ts`). Default super properties auto-attached on every event: `is_anonymous`, `is_subscribed`, `streak_days`, `guild_count`, `app_version`, `platform`. AppsFlyer events flow through `Analytics.trackAF(event, values)`.

### 9.1 Mixpanel events

| Event | Properties | Fired from |
|-------|------------|------------|
| `App Opened` | `{cold_start: bool}` | `app/App.tsx:184,196` |
| `App Returned` | `{days_inactive, previous_streak, notification_driven:false}` | `app/App.tsx:118` |
| `Notification Tapped` | `{notification_type}` | `app/App.tsx:208` |
| `Session Started` | `{duration_minutes, ...}` | `features/home/ExecutionBlockScreen.tsx:207` |
| `Session Resumed` | `{duration_minutes, ...}` | `features/home/ExecutionBlockScreen.tsx:214` |
| `Session Completed` | `{duration_minutes, ...}` | `features/home/ExecutionBlockScreen.tsx:129` |
| `Session Abandoned` | `{elapsed_minutes, duration_minutes, ...}` | `features/home/ExecutionBlockScreen.tsx:160` |
| `Daily Goal Met` | `{...}` | `features/home/ExecutionBlockScreen.tsx:90` |
| `Session Complete Viewed` | `{...}` | `features/home/SessionCompleteScreen.tsx:78` |
| `Guild Score Submitted` | `{...}` | `features/home/SessionCompleteScreen.tsx:115` |
| `Lock In Started` | `{duration_minutes}` | `navigation/MainNavigator.tsx:161` |
| `Lock In Completed` | `{total_blocks, total_exec_minutes}` | `features/home/state/SessionProvider.tsx:304` |
| `Streak Broken` | `{previous_streak, last_session_date}` | `features/home/state/SessionProvider.tsx:286` |
| `Streak Milestone Reached` | `{days, color_tier}` | `features/home/state/SessionProvider.tsx:389` |
| `Streak Recovered` | `{...}` | `features/home/screens/HomeTab.tsx:290` |
| `Mission Viewed` | `{...}` | `features/missions/components/MissionCard.tsx:123` |
| `Mission Completed` | `{mission_id, mission_title, mission_type, mission_difficulty, xp, slot, completed_count}` | `features/missions/MissionsProvider.tsx:671` |
| `All Missions Completed` | `{total_xp}` | `features/missions/MissionsProvider.tsx:688` |
| `Daily Activity Logged` | `{...}` | `features/missions/components/DailyActivityCard.tsx:59` |
| `Sign Up Failed` | `{method:'email'|'apple', error_code}` | `SignUpScreen.tsx:115/140`, `OnboardingAuthScreen.tsx:181/205` |
| `Account Created` | `{method, was_anonymous}` | `SignUpScreen.tsx:119,145`, `OnboardingAuthScreen.tsx:106` |
| `Sign In Failed` | `{method, error_code}` | `SignInScreen.tsx:103,126` |
| `Sign In Completed` | `{method}` | `SignInScreen.tsx:107,131` |
| `Password Reset Requested` | `{source}` | `SignInScreen.tsx:163` |
| `Signup Nudge Shown/Dismissed/Converted` | `{nudge_type}` | `auth/components/SignUpNudgeSheet.tsx:40/53/63`, also `CreateGuildScreen.tsx:64` |
| `Profile Photo Set` | `{...}` | `EditProfileScreen.tsx:240` |
| `Display Name Set` | `{...}` | `EditProfileScreen.tsx:246` |
| `Profile Setup Skipped` | none | `EditProfileScreen.tsx:267` |
| `Settings Changed` | `{setting, value}` | `settings/sheets/GoalPickerSheet.tsx:42`, `DailyCommitmentSheet.tsx:35`, `WeaknessPickerSheet.tsx:46` |
| `Account Deleted` | none | `DeleteAccountSheet.tsx:46` |
| `Guild Created` | `{guild_name, guild_id}` | `CreateGuildScreen.tsx:44` |
| `Guild Joined` | `{guild_id, guild_name, method:'invite_code'}` | `JoinGuildScreen.tsx:103` |
| `Guild Left` | `{guild_id, was_owner}` | `GuildDetailScreen.tsx:140,147` |
| `Guild Leaderboard Viewed` | `{...}` | `GuildDetailScreen.tsx:104` |
| `Guild Invite Shared` | `{guild_id, share_method:'copy'|'share_sheet'}` | `InviteCodeCard.tsx:39,54` |
| `Onboarding Screen Viewed` | `{screen, step, total_steps}` | `hooks/useOnboardingTracking.ts:128`, `CommitmentScreen.tsx:118` |
| `Onboarding Screen Exited` | `{screen, step, total_steps, time_on_screen_ms}` | `hooks/useOnboardingTracking.ts:142` |
| `Onboarding Answer Submitted` | `{screen, answer, ...}` | All 11 quiz screens (`PhoneTimeQuiz, Age, Situation, Goal, ControlQuiz, Triggers, MorningRoutine, DailyTimeCommitment, WhyNow, ControlLevel, ScheduleSession`) |
| `Onboarding Completed` | `{...}` | `onboarding/screens/PaywallScreen.tsx:83` |
| `Notification Permission Granted/Denied` | `{source}` | `NotificationPreFrameScreen.tsx:71/74/81` |
| `Permission Granted/Denied` | `{screen, permission:'screen_time'}` | `ScreenTimePreFrameScreen.tsx:87,91` |
| `Paywall Shown` | `{source:'onboarding'|'lock_in'}` | `subscription/PaywallOfferScreen.tsx:69`, `onboarding/screens/PaywallScreen.tsx:64` |
| `Paywall CTA Tapped` | `{source}` | `PaywallOfferScreen.tsx:130`, `onboarding/PaywallScreen.tsx:102` |
| `Paywall Dismissed` | `{source, reason?}` | `PaywallOfferScreen.tsx:139,145`, `onboarding/PaywallScreen.tsx:113` |
| `Paywall Restore Tapped` | `{source}` | `onboarding/PaywallScreen.tsx:122` |
| `Paywall Skipped` | `{source}` | `onboarding/PaywallScreen.tsx:211` |
| `Subscription Started` | `{source}` | `PaywallOfferScreen.tsx:134`, `onboarding/PaywallScreen.tsx:106` |
| `Trial Started` | `{product_id}` | `SubscriptionProvider.tsx:150` |
| `Subscription Converted` | `{product_id, from_trial}` | `SubscriptionProvider.tsx:61,153` |
| `Subscription Expired` | `{product_id, was_trial}` | `SubscriptionProvider.tsx:68` |
| `Subscription Restored on Sign In` | `{...}` | `OnboardingAuthScreen.tsx:133` |
| `Weekly Report Viewed` | `{...}` | `WeeklyReportScreen.tsx:77` |
| `Achievement Unlocked` | `{achievement_id, ...}` | `services/AchievementService.ts:75` |

### 9.2 AppsFlyer events (via `Analytics.trackAF`)

| AF event | Values | Fired from |
|----------|--------|------------|
| `af_login` | `{}` | `app/App.tsx:183` |
| `af_first_lock_in` | `{af_success:'1', af_content_id:'first_program_day'}` | `SessionProvider.tsx:357` |
| `af_achievement_unlocked` | `{af_description:'streak_<n>', af_score}` | `SessionProvider.tsx:381` |
| `af_level_achieved` | `{af_level, af_score}` | `SessionProvider.tsx:385` |
| `af_tutorial_completion` | `{...}` | `features/home/screens/HomeTab.tsx:70` |
| `af_complete_registration` | `{method:'email'|'apple'}` | `SignUpScreen.tsx:120/146`, `OnboardingAuthScreen.tsx:112` |
| `af_invite` | `{method:'crew_invite'}` | `InviteCodeCard.tsx:55` |
| `af_content_view` | `{...}` | `PaywallOfferScreen.tsx:70` |
| `af_start_trial` | `{af_content_id}` | `SubscriptionProvider.tsx:149` |
| `af_subscribe` | `{af_content_id}` | `SubscriptionProvider.tsx:60,152`, `onboarding/PaywallScreen.tsx:107` |

---

## 10. Service singletons (`apps/mobile/src/services/`)

### `SupabaseService.ts`
Pattern: object literal at bottom. Methods:
- `initialize(): Promise<boolean>`
- `getClient(): SupabaseClient | null`
- `getCurrentUserId(): string | null`
- `isInitialized(): boolean`

Internal: SecureStore-backed token storage via `@lockedin/supabase-client.createMobileClient`; runs `ensureAnonymousSession` on init; uses `@lockedin/has_launched` fresh-install detection.

### `NotificationService.ts`
Pattern: `export class NotificationService` with static methods. Notable methods:
- `requestPermission(): Promise<boolean>`
- `touchLastAppOpen(): Promise<void>`
- `refreshScheduleWithStoredStreak(): Promise<void>`
- `scheduleAllDailyNotifications(streak): Promise<void>`
- `cancelLockInReminders(): Promise<void>`
- `scheduleCloseToGoalNudge(remainingMinutes): Promise<void>`
- `cancelCloseToGoalNudge(): Promise<void>`
- `scheduleGuildReminder(): Promise<void>`
- `cancelMissionReminder(): Promise<void>`
- `scheduleFirstGuildNudgeIfNeeded(): Promise<void>`
- `cancelStreakProtectAndMissionReminders(): Promise<void>`
- `onSessionCompletedToday(): Promise<void>`
- `cancelAllNotifications(): Promise<void>`
- `scheduleExecutionBlockDone(endDate): Promise<void>`
- `cancelExecutionBlockDone(): Promise<void>`
- `scheduleStreakMilestoneIfNeeded(streak): Promise<void>`
- `setPushMasterEnabled(enabled, streak): Promise<void>`
- `setStreakAlertsPreference(enabled, streak): Promise<void>`
- `setGuildNotifPreference(enabled, streak): Promise<void>`

Also exports helpers: `readReminderTimeHHmm()`, `formatReminderHHmmAs12h(hhmm)`, `persistReminderTimeHHmm(hour, minute)`, constant `KEY_NOTIF_USER_DISABLED`, types `NotificationNavScreen`, `NotificationPayload`.

Streak milestones notif list: `[3, 7, 14, 30, 60, 90, 180, 365]`.

### `AnalyticsService.ts`
Object literal `Analytics`. Methods:
- `setIsAnonymous(val)`, `setIsSubscribed(val)`, `setStreakDays(val)`
- `hydrateGuildCount(): Promise<void>`
- `track(event, props?)`
- `trackAF(event, values?)`
- `identify(userId): Promise<void>`
- `setUserProperties(props): Promise<void>`
- `setUserPropertiesOnce(props): Promise<void>`
- `registerSuperProperties(props)`
- `timeEvent(event)`
- `reset()`
- `resetContext()`

### `MixpanelService.ts`
- `initialize(): Promise<void>` (sets up `Mixpanel(MIXPANEL_TOKEN='a263cb62e1d56ef186da48661697b6a4', true)` + session replay).
- `track(event, props?)`, `identify(userId)`, `setUserProperties(props)`, `setUserPropertiesOnce(props)`, `registerSuperProperties(props)`, `reset()`, `timeEvent(event)`.

### `AppsFlyerService.ts`
- `initSdk(options)`, `startSdk()`, `getAppsFlyerUID(): Promise<string|null>`, `setAdditionalData(data)`, `logEvent(name, values)`. Wraps dynamic `require('react-native-appsflyer')` with native-availability check.

### `LockModeService.ts` (Swift-critical)
Static class. Methods:
- `beginSession(durationMinutes): Promise<void>` — calls `screen-time` Expo module `beginSession(durationSeconds)`; falls back to `shieldApps()` if monitoring fails.
- `endSession(): Promise<void>` → `removeShield()`.
- `isActive(): Promise<boolean>` → `isShielding()`.
- `showAppPicker(): Promise<number>` (returns selected count).
- `getSelectedAppCount(): Promise<number>`.

Underlying native module (Swift, `apps/mobile/modules/screen-time/ios/`): `ScreenTimeModule.swift` + `LockedInDeviceActivityMonitor.swift`. Shared via `App Group group.com.flocktechnologies.lockedin` (UserDefaults suite, `ManagedSettingsStore("lockedIn")`, DeviceActivity name `"LockedInSession"`).

### `SubscriptionService.ts`
Object literal. Methods:
- `initialize(): Promise<boolean>`
- `logIn(userId): Promise<boolean>`
- `logOut(): Promise<void>`
- `checkSubscription(): Promise<boolean>`
- `restore(): Promise<boolean>`
- `addListener(cb): () => void`
- `hasEntitlement(info): boolean`
- `isInitialized(): boolean`
- Constant `ENTITLEMENT_ID = 'Inner_Circle'`.

### `ClockService.ts`
- `getLocalDateKey(now?): DayKey` (YYYY-MM-DD device-local).

### `RankService.ts`
- `rankFromStreak(days): RankTier`
- `rankById(id): RankTier`
- `nextRank(days): RankTier|null`
- `progressToNext(days): 0..1`
- `detectRankChange(prev, next): { direction:'up'|'down', from, to } | null`

### `StatsService.ts`
Object literal. Methods:
- `refresh(): Promise<UserStatsRow|null>` (fetches latest from `user_stats`, notifies subscribers).
- `bumpCounter(field, delta): Promise<void>` (Supabase RPC `bump_user_stat`).
- `setStreak(streak): Promise<void>` (RPC `set_user_streak`).
- `recompute(): Promise<RecomputeResult|null>` (RPC `recompute_user_stats`).
- `subscribe(fn): () => void` (live-data listener).
- `getCached(): UserStatsRow | null`.
- `statValue(stat, row?): number`.

### `XPService.ts`
- `award(payload): Promise<number>` — payload union `{type:'session_complete'|'mission_complete'|'perfect_day'|'block_resisted'|'streak_bonus', data}`.
- `computeXP(payload): number` — formulas (e.g. session = `(35 + (durationMinutes>=60 ? 15 : 0)) * (1 + min(streak/30, 0.5))`).

### `AchievementService.ts`
- `evaluate(snapshot: UserStatsRow): Promise<string[]>` — walks `ACHIEVEMENT_CATALOG` and inserts new earned IDs into `user_achievements`. Fires `Achievement Unlocked` per row.
- `reset(): void` (clears local cache; called on logout).

### `PermissionService.ts`
- `requestScreenTimePermission(): Promise<ScreenTimeStatus>` — iOS only, dynamic import of `modules/screen-time/src`, returns `'granted'|'denied'|'not_requested'|'unavailable'`.
- `requestNotificationPermission(): Promise<boolean>` — dynamic-import `expo-notifications`; returns `status === 'granted'`.

### `StorageMigrations.ts`
- `runStorageMigrations(): Promise<void>` — one-shot. Currently migrates `crew_*` → `guild_*` keys (sentinel `@lockedin/migrations_crew_to_guild_v1`).

### `lockedInStorage.ts`
- `clearAllLockedInStorage(): Promise<void>` — removes every `@lockedin/*` AsyncStorage key. Called on logout and from ResetDataSheet.

### `logoutCleanupBus.ts`
- `subscribeLogoutCleanup(fn): () => void`
- `emitLogoutCleanup(): void`
- All providers subscribe so they can fire `FULL_RESET`/`FULL_LOGOUT_RESET` reducer actions during sign-out.

### `achievementCatalog.ts`
- Exports `Achievement` type, `ACHIEVEMENT_CATALOG: Achievement[]`, `ACHIEVEMENT_BY_ID`. Each Achievement: `{id, name, category:'session'|'streak'|'mission'|'stat'|'social', description, condition(row: UserStatsRow) → boolean}`. Categories drive badge tint in `AchievementsRow`.

---

## Appendix A — Shared design tokens (`design/`)

### colors.ts
- `Colors` object with: `background #0E1116`, `backgroundSecondary #151A21`, `surface #2C3440`, `primary #3A66FF`, `accent #00C2FF`, `textPrimary #FFFFFF`, `textSecondary #9CA3AF`, `textMuted #6B7280`, `disabled #2C3440`, `success #00D68F`, `danger #FF4757`, `warning #FFC857`, plus a `lockInBackground` (referenced by `MainNavigator`).

### typography.ts
- `FontFamily.headingBold/heading/headingSemiBold/bodyMedium/body/mono/monoBold` — see §7.3 for the actual font names.
- `Typography` preset record (presets keyed by usage).

### rankTiers.ts
- `RANK_TIERS` array (9 tiers): `npc` (NPC, 0d, #8B8B8B), `grinder` (RECRUIT, 3d, #4A7FB5), `rising` (RISING, 7d, #00C2FF), `chosen` (CHOSEN, 14d, #00D68F), `elite` (ELITE, 30d, #FFC857), `phantom` (PHANTOM, 60d, #FF4757), `legend` (LEGEND, 90d, #A855F7), `goat` (GOAT, 180d, #E0E7FF), `locked_in` (LOCKED IN, 365d, #FF006E).
- `RANK_BY_ID: Record<RankId, RankTier>`.

### streakTiers.ts
- `STREAK_TIERS` (6 entries: 3d/7d/30d/90d/180d/365d).
- `DEFAULT_COLOR = '#4B5563'`, plus `getStreakTierInfo(streakDays)`, `getFlameColorFilters(streakDays)` (used in `SessionCompleteScreen`).

### colorUtils.ts
- `lightenHex(hex, amount)` — Lottie + button hover tints.

### components/
- **AppGuideSheet** (+ `useAppGuide(screenKey)` hook) — Generic first-run sheet, persists dismiss at `@lockedin/guide_<screenKey>`.
- **OptionItem** — Legacy onboarding option pill (kept for residual usage).
- **PrimaryButton** — Solid + secondary (outline) variants of the system primary button.
- **ProgressIndicator** — Track + fill bar (used internally; the live progress bar is `OnboardingProgressBar`).
- **ScreenContainer** — SafeAreaView wrapper with centered/full-bleed flag.

---

## Appendix B — Environment variables (`config/env.ts`)

Required (`requireEnv` warns + returns `''` if missing):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_APPSFLYER_DEV_KEY`
- `EXPO_PUBLIC_APPSFLYER_APP_ID`

Optional / fallbacks:
- `EXPO_PUBLIC_SUPABASE_PASSWORD_RESET_REDIRECT` (default `https://locked-in.co/auth/callback?next=/auth/reset-password`)
- `EXPO_PUBLIC_IOS_APP_STORE_URL` (default `https://apps.apple.com/us/app/locked-in-mental-conditioning/id6759698565`)
- `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`

`ENV.mode` = `'development'|'production'` based on Metro `__DEV__`.

---

## Appendix C — Cross-references between features

- `MissionsBridge` in `app/App.tsx` wires `OnboardingProvider.state.{primaryGoal, selectedWeaknesses, onboardingCompletedAt}` + `SessionProvider.state.consecutiveStreak` into `MissionsProvider`.
- `MissionsProvider.completeMission` calls back into `GuildService.completeMissionServerSide` to submit a per-mission update with retry.
- `SessionProvider` side-effects fan out into `StatsService`, `XPService`, `AchievementService` after every execution block + streak change.
- `SessionCompleteScreen` calls `RankService.detectRankChange`, `useMissions().checkAutoComplete`, and `recordActiveDay()` (exported from MissionsProvider).
- `HomeTab` reads `useMissions().lockedInToday` to cancel `NotificationService.cancelMissionReminder` and reads `MissionsProvider`'s session-state mirror.
- `SettingsScreen` reads `useSession`, `useMissions`, `useSubscription`, `useAuth`, and pivots to every sheet in `features/settings/sheets`.

---
End of inventory. Generated by automated codebase scan on 2026-05-15.
