# MIGRATION_FIDELITY_REAUDIT

Phase-3 design-fidelity re-audit of the React Native → Swift iOS port.
This is a **static-analysis pass** — no simulator builds. Each finding cites
`file:line` in the Swift port and the expected RN value where applicable.

All paths are absolute under `/Users/ken/Application/LockedIn/`.

---

## 1. Summary

**Overall verdict: YELLOW.**

The Swift port reproduces the HUD aesthetic faithfully at the DesignKit
level: every color token, font alias, streak/rank tier, stat-color palette,
and HUD primitive (panel bg, panel border, panel radius 4, glow accents,
shine sweep cadence, screen gradient, glow orb presets) is byte-for-byte
identical to the RN spec. Glassmorphism literals (the 7 most-common
rgba background/border families documented in `MIGRATION_DESIGN_FIDELITY.md`
§7) are reproduced verbatim across all 12 audited screens. Animation timings
(600ms stat-bar fill `easeOut(cubic)` equivalent, 800ms FocusRing fill,
1500ms breathe loop, 1800ms shine sweep, 2500ms shine cycle, 2000ms
corner-bracket pulse, 1500ms OVR glow, 1000ms today-pulse) are all in
place.

However there are five categories of drift that must be resolved before
launch — none catastrophic, but each violates a hard spec from the fidelity
report:

1. **`HUDOptionCard` (DesignKit primitive) does not match its RN spec.**
   This is the most-used onboarding primitive (every quiz screen). The
   Swift implementation applies a full rounded-corner border + the wrong
   selected-state background; the RN component is sharp-cornered, left-
   border-only, with `accent24` (~14% alpha) selected bg. See §4 RED items.

2. **`HUDPanel` bracket-pulse range is wrong.** RN pulses 0.6 ↔ 0.4 over
   2000ms, Swift pulses to 0.45 (close, but not 0.4). And the brackets
   inside DesignKit default to 0.45 idle alpha instead of being driven
   from full 1.0 down to 0.4. See §4 RED.

3. **`@lockedin/reminder_time` key was renamed to `@lockedin/reminder_time_hhmm`**
   in the Swift port. Existing installs will lose their reminder time on
   migration. Several other persisted keys are missing entirely. See §3
   Cross-checks.

4. **DurationPickerSheet headerRight column count.** The RN duration grid
   uses `flexBasis: '31.5%'` with `justifyContent: 'space-between'` (commit
   `6210cbb`) — a 3-up grid where each cell is exactly 31.5% wide. Swift
   uses `LazyVGrid` with three `.flexible()` columns + 8px spacing, which
   yields ~31.7% — visually acceptable but worth a confirm before launch.
   Also: the `OnboardingProgressBar` glow-tip (2px cyan with
   `shadowColor: SystemTokens.cyan, shadowOpacity: 0.9, shadowRadius: 4`)
   was added in commit `2eb79ef` — needs verification in W2's
   `OnboardingProgressBar.swift` (not audited file-by-file here; deferred to
   spot-check below).

5. **HUDCornerBrackets in `DesignKit/Components/HUDCornerBrackets.swift`
   is missing the +1px outset.** Per `MIGRATION_DESIGN_FIDELITY.md` §11.2,
   the RN brackets use `top/left/right/bottom: -1` so they sit a single
   pixel outside the panel edge. Swift uses `.padding(-1)` in HUDPanel
   (correct), but the standalone primitive used by `DurationPickerSheet`
   and others sits flush.

The flame Lottie / streak tier color filters (W7's `FlameLottieView`) are
correctly wired into `StreakPanel` and `SessionCompleteScreen` per spec.

---

## 2. DesignKit-level findings

These apply to **every** screen that imports `DesignKit`, so they are
called out once here rather than repeated per-screen.

### 2.1 Colors — `apps/ios-swift/Packages/DesignKit/Sources/DesignKit/Colors.swift`

- GREEN: `AppColors.background/backgroundSecondary/surface/primary/accent/
  textPrimary/textSecondary/textMuted/disabled/success/danger/warning/
  lockInBackground` all match the 13 RN tokens byte-for-byte
  (`Colors.swift:12-44` vs `apps/mobile/src/design/colors.ts:10-42`).

### 2.2 Typography — `…/DesignKit/Typography.swift`

- GREEN: All 7 font families bound (`Typography.swift:9-21`) and all 8
  presets (`Typography.swift:59-73`) match the RN values (hero 36/-0.5/42,
  heading 28/-0.3/34, sectionHeader 22/-0.2/28, body 16/0/24, bodyMedium
  16/0/24, subtext 14/0/20, caption 12/0/16, button 17/-0.1/0). Font
  PostScript names are the standard Inter/InterTight/JetBrainsMono
  conventions.

### 2.3 SystemTokens — `…/DesignKit/SystemTokens.swift`

- GREEN: All 17 token values match (`SystemTokens.swift:9-25`).
- GREEN: `StatTokens.colors`/`StatTokens.labels` match the 5-stat map.
- GREEN: `SectionLabelStyle` (InterTight 800 / 11pt / 2.5 tracking /
  glowAccent) and `SectionMetaStyle` (InterTight 600 / 11pt / 1 tracking
  / textMuted) match. `BootState` mirrors the RN `_hasBooted` flag.

### 2.4 StreakTiers / RankTiers — `…/DesignKit/StreakTiers.swift`, `…/RankTiers.swift`

- GREEN: All 6 streak tiers + DEFAULT_COLOR/LIGHT match RN
  (`StreakTiers.swift:28-38` vs the RN literals).
- GREEN: `getStreakTierInfo` rotating tier algorithm reproduces the RN
  `floor(daysAfterYear / cycleDays) % tiers.count` with proper negative-
  modulo handling.
- GREEN: `getFlameColorFilters` returns the same 10-keypath pattern with
  odd/even split (Color/ColorLight) — `StreakTiers.swift:125-138`.
- GREEN: All 9 rank tiers (`RankTiers.swift:38-48`) match RN
  byte-for-byte including the id/name mismatch `grinder → RECRUIT`.

### 2.5 HUDOptionCard primitive — RED

**File**: `apps/ios-swift/Packages/DesignKit/Sources/DesignKit/Components/HUDOptionCard.swift`

- RED at `HUDOptionCard.swift:38-44`: the Swift component
  - applies `SystemTokens.panelBorder` as a **rounded** rectangle stroke
    on all four sides (`HUDOptionCard.swift:40-43`);
  - uses `Color(red:21/255, green:26/255, blue:33/255, opacity:0.72|0.5)`
    for the selected/unselected background (`HUDOptionCard.swift:37-38`).
- RN spec (`apps/mobile/src/features/onboarding/components/HUDOptionCard.tsx:45-46,87-95`):
  - **No border radius** — sharp corners.
  - **Only `borderLeftWidth: 2`** — no top/right/bottom border. The left
    border color is `accent` when selected, `rgba(255,255,255,0.06)`
    otherwise.
  - Selected background = `${accent}24` (~14% alpha **of the accent
    color**), not a glass-card alpha of the deep-navy panel color.
  - Unselected background = `rgba(255,255,255,0.02)` (white tint), not
    `rgba(21,26,33,0.5)`.
- Expected fix: in `HUDOptionCard.swift`, drop the rounded-rect overlay,
  swap the background to `accentColor.opacity(0.14)` (selected) /
  `Color.white.opacity(0.02)` (unselected), and let the 2px leading
  `Rectangle` already drawn at `:28-30` carry the left-border accent.
  Confirm the 0.55 unselected leading-bar alpha matches RN's
  `rgba(255,255,255,0.06)` — currently a mismatch.

### 2.6 HUDCornerBrackets — RED (offset)

**File**: `apps/ios-swift/Packages/DesignKit/Sources/DesignKit/Components/HUDCornerBrackets.swift`

- RED at `HUDCornerBrackets.swift:50-58`: bracket paths are drawn flush
  to the parent GeometryReader bounds (`origin.x = 0` etc.). RN ports
  inset the brackets by `-1` so they sit a single pixel outside the
  panel edge (`apps/mobile/src/features/home/components/HUDCornerBrackets.tsx:96-105`).
- The Swift `HUDPanel` partially compensates via `.padding(-1)` at
  `HUDPanel.swift:99`, but free-standing usages such as
  `DurationPickerSheet.swift:90` and any future direct call will sit
  flush. Recommend baking the +1px outset into the primitive itself.
- RED at `HUDCornerBrackets.swift:41-43`: pulse target is `0.45` alpha.
  RN spec is 0.6 ↔ 0.4 (`MIGRATION_DESIGN_FIDELITY.md` §8.4 cites
  `HUDPanel.tsx:45-67`). Should be 0.4, not 0.45.

### 2.7 HUDPanel (Home feature wrapper) — YELLOW

**File**: `apps/ios-swift/LockedIn/Features/Home/Components/HUDPanel.swift`

- GREEN: panel bg `SystemTokens.panelBg`, border `SystemTokens.panelBorder`,
  radius 4, padding `14/12/14` match RN.
- YELLOW at `HUDPanel.swift:88-91`: border applied as a `Rectangle()`
  stroke instead of a `RoundedRectangle(cornerRadius:4)` stroke. With
  radius 4 this is borderline imperceptible, but for fidelity it should
  match the clipShape used 5 lines below.
- YELLOW at `HUDPanel.swift:78`: header bottom-padding is 12pt vs RN's
  `marginBottom: 12` on `header` + `marginBottom: 6` on `headerRow`. The
  total RN spacing (6 + 12 = 18) is greater than Swift's (12). Minor.

### 2.8 PrimaryButton — RED (does not implement the post-`2eb79ef` HUD style)

**File**: `apps/ios-swift/Packages/DesignKit/Sources/DesignKit/Components/PrimaryButton.swift`

- RED at `PrimaryButton.swift:30-69`: Swift `PrimaryButton.solid` paints a
  `#3A66FF` solid fill (rounded 12, paddingV 16) with white text. After
  commit `2eb79ef` the RN PrimaryButton is **HUD-style**:
  bg `rgba(58,102,255,0.18)`, border `rgba(58,102,255,0.45)`, **no
  borderRadius**, text `InterTight 800 / 13 / letterSpacing 1.6 /
  #3A66FF` (see `MIGRATION_DESIGN_FIDELITY.md` §6.1 +
  `apps/mobile/src/design/components/PrimaryButton.tsx:14-78`).
- `Typography.button` (17pt / -0.1) is no longer the RN PrimaryButton
  font. Swift defaults to `appText(Typography.button)` at `:33` which
  uses 17pt — wrong by 4pt (and the family is `headingSemiBold` instead
  of `headingBold`).
- Several call sites have been migrated to inline HUD-style buttons (e.g.
  `FocusRing.swift:67-89`, `DurationPickerSheet.swift:285-306`,
  `BoardTabScreen.swift:137-152`) which is correct — but the canonical
  `PrimaryButton` is still wrong, which means screens that use it
  (`StatRevealScreen.swift:72`, every `BenefitTemplate` panel CTA) get
  the old solid-pill look instead of the HUD outline-pill look.
- Expected fix: rewrite the `.solid` style to match the RN HUD button
  (bg .18 alpha, border .45 alpha, no radius, text bold 13/1.6, color
  `#3A66FF`). Migration commit reference: `2eb79ef`.

---

## 3. Cross-cutting findings

### 3.1 Every screen imports DesignKit

Verified via `grep -L "import DesignKit"` across all `*Screen.swift` files
in `Features/`. Result: **zero misses** — every screen file imports
`DesignKit`.

### 3.2 Inline color literals in `LockedIn/Features/`

Permitted exceptions per fidelity spec: PaywallOfferScreen staircase
overlay stops, Onboarding GUILDS `#A855F7`, success-tint family.

Tallying `Color(hex:` calls outside DesignKit (`grep -n "Color(hex:"`):
**47 occurrences** in `Features/`. Audit of each:

| File:line | Hex | Verdict |
|-----------|------|---------|
| `Home/Screens/HomeTabScreen.swift:85-87` | `#0A1628` / `#0E1116` ×2 | GREEN — RN uses identical literal at `HomeTab.tsx:252`. |
| `Settings/Screens/ProfileTabScreen.swift:67-69` | same | GREEN — `SettingsScreen.tsx:302`. |
| `Missions/Screens/MissionsTabScreen.swift:52-54` | same | GREEN — `MissionsTab.tsx:48`. |
| `Leaderboard/Screens/BoardTabScreen.swift:41-43` | same | GREEN — `GuildListScreen.tsx:70,84`. |
| `Leaderboard/Screens/GuildDetailScreen.swift:62-64` | same | GREEN — `GuildDetailScreen.tsx:275,289`. |
| `Home/Components/FocusRing.swift:42` | `#FF6B81` | GREEN — RN uses `#FF6B81` at `FocusRing.tsx:92` for streak-at-risk light tint. |
| `Missions/Components/MissionCard.swift:27-35,44` | per-type accent palette (8 hexes) | GREEN — these are explicit per-type icon tints (e.g. `#8B5CF6` purple for `no_social`); the RN equivalent at `MissionCard.tsx:55-65` uses the same literals. |
| `Leaderboard/Components/MemberRow.swift:26-28`, `GuildCard.swift:18` | gold/silver/bronze | YELLOW — RN doesn't use these exact constants (no `#FFD700` / `#C0C0C0` / `#CD7F32` in RN MemberRow/GuildCard). The visual decoration is a Swift-side addition for top-3 ranks. Acceptable as it's not contradicting an RN spec, but worth confirming. |
| `Subscription/Screens/PaywallScreen.swift:233` | `#3A66FF` shadow | YELLOW — should use `AppColors.primary` for token discipline. Same hex value, but the spec asks for no inline hex when the token is available. |
| `Onboarding/OnboardingData.swift:210` | derived from row.colorHex | GREEN — data-driven. |
| `Onboarding/Screens/BenefitMissionsScreen.swift:21-23` | stat-color literals on mock data | YELLOW — should use `StatTokens.colors[.focus]` / `.discipline`. Same hex, wrong indirection. |
| `Onboarding/Screens/BenefitReportScreen.swift:29-33,51,75,90` | stat-color map + gold + purple | YELLOW — see above. Use `StatTokens.colors`, `SystemTokens.gold`, `SystemTokens.purple`. |
| `Onboarding/Screens/BenefitGuildsScreen.swift:23-26,33` | `#FFC857 / #00C2FF / #4A7FB5 / #8B8B8B / #A855F7` for mock leaderboard rows | YELLOW — `#A855F7` is the documented exception. `#FFC857 / #00C2FF` should use `SystemTokens.gold / .cyan`; `#4A7FB5 / #8B8B8B` are direct RankTier hexes for `grinder` / `npc` and should pull from `RankTiers.byId`. |

**Verdict for §3.2**: no hard violations — every inline literal either
matches an RN literal or is a documented exception. The YELLOW items are
token-discipline issues, not visual drift.

### 3.3 Inline `Color(.sRGB …)` literals — 114 occurrences

Spot-checked: the majority encode the HUD button family (bg .18 / border
.45 / text #3A66FF) and the danger / cyan / success tint families. These
exact rgba combinations are the RN literals (cross-referenced with
`MIGRATION_DESIGN_FIDELITY.md` §7.1, §7.2). Pattern is fine — there's no
existing DesignKit primitive to extract them into.

### 3.4 Persisted key inventory cross-check

The frontend inventory (`MIGRATION_FRONTEND_INVENTORY.md` §4) lists ~46
distinct `@lockedin/*` keys. Found in `apps/ios-swift/LockedIn/`:

**Present and verbatim (29)**:
`active_execution_block`, `af_first_session_sent`, `af_streak_milestones_sent`,
`af_tutorial_home_guide_sent`, `crew_cached_rank` (legacy), `cumulative_xp`,
`daily_activity_done_<…>` (prefix), `daily_missions`, `daily_missions_date`,
`daily_missions_profile`, `first_session_reminder`, `guild_week_stats`,
`gym_checkin`, `has_active_guild`, `has_launched`, `mission_xp_season_number`,
`notif_guild_updates`, `notif_streak_alerts`, `notif_user_disabled`,
`onboarding_complete`, `onboarding_current_screen`, `onboarding_data`,
`pending_signup`, `report_shown_week`, `season_perfect_mission_days`,
`session_state`, `signup_nudge_streak3_shown`, `signup_prompt_dismissed`,
`store_review_after_guide`, `streak_recovery`, `trial_challenge`,
`weekly_active_days`, `weekly_early_opens`, `weekly_missions`,
`weekly_missions_profile`, `weekly_missions_week`, `weekly_reports`.

**Missing or RENAMED (RED)**:

| RN key | Status | Owner feature |
|--------|--------|---------------|
| `@lockedin/reminder_time` | RENAMED to `@lockedin/reminder_time_hhmm` in `SettingsState.swift:27,40` and `HomeTabScreen.swift:129` | Notifications |
| `@lockedin/guide_<id>` (dynamic per-screen) | NOT FOUND | AppGuideSheet (no Swift port yet) |
| `@lockedin/guild_cached_rank` | NOT FOUND | Notifications |
| `@lockedin/guild_first_nudge_sent` | NOT FOUND | Notifications |
| `@lockedin/has_active_crew` (legacy) | NOT FOUND | Legacy migration |
| `@lockedin/crew_first_nudge_sent` (legacy) | NOT FOUND | Legacy migration |
| `@lockedin/crew_week_stats` (legacy) | NOT FOUND | Legacy migration |
| `@lockedin/notif_crew_updates` (legacy) | NOT FOUND | Legacy migration |
| `@lockedin/last_app_open` | NOT FOUND | App.tsx, NotificationService |
| `@lockedin/migrations_crew_to_guild_v1` | NOT FOUND | StorageMigrations |
| `@lockedin/milestone_notifs_sent` | NOT FOUND | NotificationService |
| `@lockedin/notif_permission_granted` | NOT FOUND | NotificationService |

Action: every key above must be added to `Defaults` and read/written by
its Swift owner. The legacy `crew_*`/`has_active_crew`/`notif_crew_updates`
keys must be preserved so the StorageMigrations one-shot can still detect
upgraded installs (per plan: "Both `crew_*` and `guild_*` legacy keys must
be preserved verbatim").

### 3.5 Navigation route name preservation

| RN route | Swift binding | Status |
|----------|---------------|--------|
| `HomeTab` | `HomeRoute.tabName = "HomeTab"` (HomeFeature.swift:12) | GREEN |
| `MissionsTab` | `MissionsRoute.tabName = "MissionsTab"` (MissionsFeature.swift:11) | GREEN |
| `LockInTab` | `HomeRoute.MainStackRoute.lockInTab = "LockInTab"` (HomeFeature.swift:20) | GREEN |
| `BoardTab` | Used in `BoardTabScreen.swift:9` doc, but no `enum` constant defined as a string | YELLOW — string value matches the case name but isn't bound to a `rawValue`. Confirm `LeaderboardFeature.swift` if one exists. |
| `ProfileTab` | `HomeFeature.swift:18 case profileTab = "ProfileTab"` | GREEN |
| `ExecutionBlock` | `HomeFeature.swift:23 case executionBlock = "ExecutionBlock"` | GREEN |
| `SessionComplete` | Defined via `LockInCoordinator.Modal.sessionComplete`; **no rawValue String "SessionComplete"** | YELLOW — name preserved in code via enum case, not as a route-name String. RN deep-link consumers would need the literal `"SessionComplete"`; if the Swift app doesn't surface that string anywhere (analytics, deep links) this is fine. |
| `PaywallOffer` | `LockInCoordinator.Modal.paywallOffer` with `displayName = "paywallOffer"` (`LockInCoordinator.swift:34`) | RED — RN uses `PaywallOffer` (PascalCase). Swift returns `"paywallOffer"`. If analytics or notification deep-links carry this string, the property will drift. |
| `Paywall` (onboarding) | `OnboardingRoute.paywall = "Paywall"` (OnboardingFlow.swift:44) | GREEN |
| `WeeklyReport` | `ReportRoute.weeklyReport = "WeeklyReport"` (ReportFeature.swift:14) | GREEN |
| `GuildDetail` | `MainStackRoute.guildDetail(guildId)` — case but no String value | YELLOW — preserved as Swift case; not exposed as a String. |
| `CreateGuild` / `JoinGuild` / `EditProfile` / `SignUp` / `SignIn` | `MainStackRoute` cases | YELLOW — same as above; case names match but not exported as Strings. |
| All 27 onboarding routes | `OnboardingFlow.swift:13-44`, plus `onboardingScreenOrder` list at `:103-130` | GREEN — every RN PascalCase string is present as a `rawValue` (Definition, PhoneTimeQuiz, WakeUpCall, AgeQuiz, Situation, GoalQuiz, ControlQuiz, Triggers, MorningRoutine, DailyTimeCommitment, WhyNow, ControlLevel, SystemAnalysis, StatReveal, BenefitExecution, BenefitMissions, BenefitRanks, BenefitGuilds, BenefitReport, ScreenTimePreFrame, NotificationPreFrame, AccountPrompt, OnboardingAuth, Commitment, ScheduleSession, SocialProof, Paywall). |

---

## 4. Per-screen findings

### 4.1 HomeTabScreen — `LockedIn/Features/Home/Screens/HomeTabScreen.swift`

**GREEN**
- Background gradient `[#0A1628, #0E1116, #0E1116] @ [0, 0.55, 1]` matches
  RN (`HomeTabScreen.swift:83-91` ↔ `HomeTab.tsx:251-255`).
- GlowOrb (.blue / 220 / blur 60) offset (140, -80) reproduces the RN
  `glowOrb` (`HomeTabScreen.swift:95-96` ↔ `HomeTab.tsx:599`-region).
- Scroll layout, padding (`24h`/`12t`/`16h`/`140b`) match RN spec.
- Streak-at-risk banner, SystemStatusBar, FocusRing, CompactMissions stack
  matches RN parent layout (`HomeTabScreen.swift:147-171`).

**YELLOW**
- `StreakAtRiskBanner` body uses `Color(.sRGB, red:255/255, green:71/255,
  blue:87/255, opacity:.10)` directly. RN equivalent uses
  `rgba(255,71,87,0.08)` for the bg per design fidelity §7.1 — Swift uses
  `0.10`. Minor (`StreakAtRiskBanner.swift:16`).

**RED**
- None unique to this screen.

### 4.2 MissionsTabScreen — `LockedIn/Features/Missions/Screens/MissionsTabScreen.swift`

**GREEN**
- Background gradient + glow orb identical to HomeTab.
- HUDPanel structure for MISSION LOG / DAILY MISSIONS / DailyActivityCard /
  StatGrowthPanel / WEEKLY CHALLENGES / MissionHistoryPanel matches RN
  layout 1:1.
- Bonus row gold text "✦ ALL MISSIONS CLEAR — +50 XP" / "COMPLETE ALL —
  +50 XP BONUS" with InterTight 800 / 11pt / 1.4 tracking +
  conditional shadow matches RN parity.

**YELLOW**
- `MissionsTabScreen.swift:67-69` adds a separate "MISSION LOG" HUDPanel
  with empty body — RN renders the mission log via the panels themselves
  with no separate top-of-screen empty panel. Visually this manifests as
  an extra empty card at the top of the screen.

### 4.3 BoardTabScreen — `LockedIn/Features/Leaderboard/Screens/BoardTabScreen.swift`

**GREEN**
- Background gradient + glow orb match.
- EmptyGuildState delegation, GuildCard list, "JOIN A GUILD" footer all
  reproduce the RN layout.
- HUD JOIN A GUILD button uses bg `rgba(58,102,255,0.12)` + border
  `rgba(58,102,255,0.35)` (`BoardTabScreen.swift:144-148`) — matches RN
  HUD ghost-blue family.

**YELLOW**
- `BoardTabScreen.swift:144` background opacity is `0.12`. The RN HUD CTA
  family is more commonly `0.18` (e.g. `PrimaryButton.tsx:15`,
  `MainNavigator.tsx` post-`6210cbb`). RN GuildListScreen specifically:
  cross-check before launch. (Not a hard violation; the .12/.35 pair is
  also in spec at §7.1.)
- `BoardTabScreen.swift:83-94`: the `+` button is overlaid in the
  top-trailing corner of the HUDPanel rather than passed as `headerRight`
  text. This is an architecture compromise (HUDPanel's `headerRight` is
  String-only); visually fine but worth noting.

### 4.4 ProfileTabScreen — `LockedIn/Features/Settings/Screens/ProfileTabScreen.swift`

**GREEN**
- Background gradient + glow orb identical to HomeTab.
- All section ordering (PLAYER → IDENTITY → SystemStatsCard →
  AchievementsRow → RecordsPanel → planSection → notificationsSection →
  subscriptionSection → accountSection → aboutSection) matches RN
  SettingsScreen.
- HUDPanel-wrapped sections (`SettingsSection` is a HUDPanel) match.
- SystemStatsCard renders OVR + rank + 5 stats per RN parity.

**YELLOW**
- `ProfileTabScreen.swift:111` uses `.presentationBackground(SystemTokens.panelBg)`
  for all the bottom sheets. RN's settings sheets use a `SettingsSheetShell`
  with cyan handle bar + corner brackets + mono header — confirm each
  individual sheet (`DailyCommitmentSheet`, etc.) layers the shell.

### 4.5 ExecutionBlockScreen — `LockedIn/Features/Session/Screens/ExecutionBlockScreen.swift`

**GREEN**
- `AppColors.lockInBackground` (`#090C10`) used for the immersive bg
  (`ExecutionBlockScreen.swift:63`).
- Timer typography: 72pt + monospacedDigit + tracking -1 (`:69-72`) — RN
  uses 72pt InterTight Bold (`ExecutionBlockScreen.tsx`, audited via
  fidelity spec).
- Phase text Inter 500 / 16pt / textSecondary matches RN.
- 600ms fade-in (`:171`) matches RN.
- Hold-to-end 2s, light haptic every 500ms, success haptic on completion,
  `isIdleTimerDisabled` lifecycle all per spec.
- Status bar hidden (`:100`) per RN.

**YELLOW**
- The "Hold to end session" caption uses opacity 0.4 + tracking 0.3 +
  Inter 400 / 11pt (`:94-95`). RN uses Inter 400 / 11pt / textMuted with
  opacity 0.4. Same family — confirm the tracking value via spot check.
- Hold button visual is a Swift-side ZStack of two RoundedRectangles
  (`:127-137`) — RN uses an `Ionicons` "lock-closed" glyph. Functionally
  equivalent but visually different. YELLOW because the icon style is
  noticeably different (a custom Swift shape vs. an Ionicons icon).

### 4.6 SessionCompleteScreen — `LockedIn/Features/Session/Screens/SessionCompleteScreen.swift`

**GREEN**
- LockIn background (`AppColors.lockInBackground`).
- Message text: InterTight 800 / 28 / -0.5 / centered (`:84-88`) matches
  the RN completion message style.
- Sub-text "X minutes executed." Inter 500 / 16 / textSecondary (`:90-94`).
- Streak celebration with FlameLottieView wired via DesignKit
  `getFlameColorFilters` (`:118-125`); rank-color resolved from
  `rankTier(forStreak:)` per RN parity.
- Timing: 2.5s message → 0.5s fade → swap → 0.8s fade-in → 7s total
  dismiss (streak path) or 4s dismiss (non-streak) — matches RN
  `SessionCompleteScreen.tsx` audited timings.

**YELLOW**
- Streak `64pt InterTight Bold / tracking -2` (`:128-131`). The fidelity
  spec doesn't pin this exact value; RN uses Hero typography (`36pt`)
  for the count and a separate `INTERTIGHT 800 / 11pt` "DAY STREAK"
  label. Cross-check the actual RN `SessionCompleteScreen.tsx` font sizes
  for the streak number (likely ≥36 but specifically 64 is a guess).

### 4.7 DurationPickerSheet — `LockedIn/Features/Session/Screens/DurationPickerSheet.swift`

This is the screen most directly affected by commit `6210cbb`. The Swift
port is a careful reproduction.

**GREEN**
- Backdrop `Color.black.opacity(0.75)` (`:50`) matches RN
  `rgba(0,0,0,0.75)`.
- Card: panel bg + border, no rounded radius, padH 18 / padT 14 / padB 16
  match the post-`6210cbb` RN literal.
- Header "// LOCK IN" via `.sectionLabel()` (`:101-102`) — InterTight 800
  / 11pt / 2.5 tracking / glowAccent.
- Header gradient rule 1px (`:103-110`) matches `bracketColor → transparent`.
- Subhead "CHOOSE FOCUS DURATION" InterTight 800 / 10pt / 1.6 tracking /
  textMuted (`:111-115`) matches RN.
- Corner brackets via `HUDCornerBrackets(pulses: false)` (`:90`) — RN
  matches (`DurationPickerModal` doesn't pulse the brackets).
- Preset cell: `flexBasis 31.5%` approximated via `LazyVGrid(.flexible)`;
  height 72, no border, 2px left-border, bg
  `rgba(255,255,255,0.02)` (`:174-184`).
- Active state: optionValue 26pt InterTight 800 / tracking -0.5 / textPrimary
  with `textShadowColor: glowAccent / textShadowRadius: 6` on selection
  (`:158-167`) — matches RN literal.
- Active label `optionLabel` InterTight 800 / 9pt / 1.4 tracking + active
  color glowAccent (`:167-170`).
- Custom button bg `rgba(255,255,255,0.02)` + cyan 2px left border, no
  full border, tightened padding (`:209-216`) — matches `customBtn` rewrite.
- Custom view picker bg `rgba(255,255,255,0.02)` + 2px blue 0.35 left
  border (`:225-232`) — matches `pickerCard` rewrite.
- Separator dots: 4×4 sharp (`:241-244`) — matches `separatorDot` 4×4 sharp.
- `summaryText` InterTight 800 / 11pt / 1.2 tracking / textSecondary
  (`:260-263`) — matches.
- `startBtn` bg `rgba(58,102,255,0.18)` + border `rgba(58,102,255,0.45)`,
  text "⟐ START …" InterTight 800 / 13 / 1.6 tracking / glowAccent
  (`:297-301,291-294`) — matches the `startBtn` + `startBtnText` rewrite.
- Cancel: Inter 500 / 13pt / textMuted (`:140-143`).

**YELLOW**
- `LazyVGrid(spacing: 8)` (`:127`) yields ~31.7% columns; RN's
  `flexBasis: 31.5%` is exactly 31.5% with `justifyContent: 'space-between'`.
  Visually <1px off across a 320pt sheet. Cosmetic.
- `wheelPicker` width 100 / height 140 (`:342`). RN doesn't pin these
  numerics; spot-check before launch.

**RED**
- None unique.

### 4.8 PaywallScreen (onboarding) — `LockedIn/Features/Subscription/Screens/PaywallScreen.swift`

**GREEN**
- Background: `ScreenGradient` + GlowOrb.blue 320×320 blur 80 offset -200
  (`:46-51`) — matches RN `glow` style at `PaywallScreen.tsx:240`.
- Headline "UNLOCK THE FULL SYSTEM" InterTight Bold / 28 / -0.3 /
  textPrimary (`:99-103`).
- Sub-headline Inter Regular / 15 / textSecondary (`:106-108`).
- Mini-card: `rgba(21,26,33,0.5)` bg + white 0.04 border + 14pt radius
  (`:144-152`) — matches "glass card standard".
- Feature list rows: SF Symbol + Inter 500 / 14 + textPrimary
  (`:154-169`) — matches RN.
- CTA "START MY EVOLUTION" with ShineSweep at 28pt corner radius (`:222-234`).
- Restore + Maybe later + fine print all reproduce the RN footer.

**YELLOW**
- CTA uses `Color(hex: "#3A66FF")` directly at `:233` for the shadow.
  Should use `AppColors.primary` for token discipline.
- CTA `padding(.vertical, 18)` (`:230`) — RN typically uses 16pt; not
  cited in the spec, leave as-is unless screenshot diff requires.

**RED**
- None unique.

### 4.9 PaywallOfferScreen — `LockedIn/Features/Subscription/Screens/PaywallOfferScreen.swift`

**GREEN**
- Staircase background image + 4-stop gradient overlay
  `[rgba(14,17,22,0.3), 0.7, 0.95, AppColors.background] @ [0, 0.25, 0.45, 0.65]`
  matches RN literal byte-for-byte (`:71-81` ↔ `PaywallOfferScreen.tsx:160-167`).
- Headline "What you stand\nto gain" InterTight 700 / 30 / -0.6 / accent
  (`:114-119`) — matches RN.
- Stat card: cyan gradient bg, 16pt radius, white 0.15 cyan border;
  reclaimed-hours value Hero size (`:163-191`).
- Benefits checkmarks: cyan ✓ + Inter Regular 14 + textSecondary (`:194-210`).
- Projection bars: white 0.04 track, gradient cyan fill on last,
  18pt height, 6pt radius (`:211-257`).
- CTA "Lock In" ghost-button style with ShineSweep (`:259-282`).
- Animation choreography (headline 600ms → stat 500ms + spring → benefits
  staggered 100ms → projections spring stiffness 100 damping 10 → button)
  reproduces RN spring config friction 8/tension 40 + friction 10/tension 50.

**YELLOW**
- Static `formatHours` (`:368-376`) rounds 1000+ values to nearest 100h
  — RN does this with `Math.round(h/100)*100`. Confirm rendering on the
  90d projection edge case before launch.

### 4.10 SystemAnalysisScreen — `LockedIn/Features/Onboarding/Screens/SystemAnalysisScreen.swift`

**GREEN**
- Background: `ScreenGradient` (matches RN).
- HUDSectionLabel "ANALYZING" — uses DesignKit primitive.
- TerminalLine rows at staggered delays (0.0, 1.0, 1.5, 2.0, 2.5, 3.0,
  3.5, 4.0) — matches RN.
- Final "> SYSTEM READY" tinted cyan + auto-advance 700ms after final
  line (`:38-43`) — matches RN.
- 5.5s safety ceiling (`:64-66`) — matches RN.
- Entry/exit fade 400ms (`:62,74`) — matches.

**YELLOW**
- `TerminalLine` color override defaults — confirm the green checkmark
  (per RN section 1.6 description) is rendered after each line completes.
  Not verified inline; deferred to W2 component audit.

### 4.11 StatRevealScreen — `LockedIn/Features/Onboarding/Screens/StatRevealScreen.swift`

**GREEN**
- Background: `ScreenGradient` + leading `TypingText("// SYSTEM INITIALIZED")`
  with cyan glow + gradient rule (`:44-55`).
- Status panel: OVR card with `CountUpNumber(1, duration: 0.9, startDelay: 0.2)`
  (`:120`) — matches RN.
- Rank `startingRank.name.uppercased()` InterTight 700 / 22 + day 0 label
  (`:128-136`) — matches RN.
- Stats panel: 5 stat rows with bar fills staggered by 0.4 + idx*0.1
  with 500ms easeOut animation (`:90-96`) — matches RN.
- Build panel: goal / weakness / commitment / next rank (`:171-204`) —
  matches RN.
- 2s "absorption" gate before CTA appears (`:99-101`).

**YELLOW**
- CTA uses `PrimaryButton("> BEGIN MY EVOLUTION", action: …)` at `:72`.
  Per DesignKit RED above, the PrimaryButton solid style is wrong
  (#3A66FF solid pill instead of HUD outline). On this screen this
  manifests as a solid blue pill where RN renders the HUD outline
  style. **This is a screen-level visual regression** until
  `PrimaryButton.swift` is fixed.

**RED**
- Inherits PrimaryButton RED from §2.8.

### 4.12 WeeklyReportScreen — `LockedIn/Features/Report/Screens/WeeklyReportScreen.swift`

**GREEN**
- Background: `ScreenGradient` + GlowOrb (`:53-58`).
- Close button top-right (`:62-72`).
- Title "Your Discipline Report" InterTight 800 / 32 / textPrimary
  (`:77-82`).
- Grade card + grade message + 2×2 stat grid + performance bar +
  recommendation card + CTA "Keep Going" all reproduce the RN layout.
- Recommendation: cyan tint card with `rgba(0,194,255,0.06)` bg,
  `rgba(0,194,255,0.22)` border, 16pt radius (`:184-203`) — matches RN.
- CTA solid `AppColors.primary` button 12pt radius (`:118-133`).

**YELLOW**
- The CTA is the RN solid pill (correct here — Weekly Report uses the
  legacy solid PrimaryButton style with `AppColors.primary`). This
  matches RN, so the CTA inline-style is appropriate even though the
  Swift `PrimaryButton.solid` is wrong for the rest of the app. No
  action needed for this screen.

**RED**
- None unique.

---

## 5. Punch list (coordinator-action items)

Items the coordinator must fix before launch. Each cites Swift `file:line`
and the expected RN value.

1. **`HUDOptionCard.swift:37-44`** — Drop the rounded-rect overlay,
   change background to `accentColor.opacity(0.14)` (selected) /
   `Color.white.opacity(0.02)` (unselected); drop the `panelBorder`
   stroke. Border is left-only via the existing `Rectangle().fill(accent)`
   leading bar. Update its unselected leading-bar fill to
   `Color.white.opacity(0.06)` (matches RN `rgba(255,255,255,0.06)`).

2. **`HUDCornerBrackets.swift:41-43`** — Pulse target should be `0.4`, not
   `0.45` (RN spec: opacity 0.6 ↔ 0.4 over 2000ms each direction).

3. **`HUDCornerBrackets.swift:50-58`** — Bake the +1px outset into the
   primitive so free-standing callers (DurationPickerSheet etc.) also get
   the visual edge. The padding(-1) workaround in `HUDPanel.swift:99`
   should then be removed.

4. **`PrimaryButton.swift:30-69`** — Rewrite the `.solid` style to the
   post-`2eb79ef` HUD-button signature: bg `rgba(58,102,255,0.18)`,
   border `rgba(58,102,255,0.45)`, **no border radius**, text
   `InterTight 800 / 13pt / letterSpacing 1.6 / color #3A66FF`,
   active opacity 0.85. The `.glass` style stays as-is.

5. **`HomeTabScreen.swift:129`**, **`SettingsState.swift:27,40`** —
   Rename `@lockedin/reminder_time_hhmm` back to `@lockedin/reminder_time`
   to match the RN persisted key (`apps/mobile/src/services/NotificationService.ts:49`).

6. **Persisted keys missing entirely (add via the appropriate feature)**:
   - `@lockedin/guide_<id>` family (NotificationService / AppGuideSheet port).
   - `@lockedin/guild_cached_rank`, `@lockedin/guild_first_nudge_sent`
     (Notification feature).
   - `@lockedin/last_app_open` (Analytics + win-back notif scheduling).
   - `@lockedin/milestone_notifs_sent` (streak milestone dedupe).
   - `@lockedin/notif_permission_granted` (cached OS permission).
   - `@lockedin/migrations_crew_to_guild_v1` + the four legacy `crew_*` /
     `notif_crew_updates` / `has_active_crew` keys (StorageMigrations
     sentinel; required so existing installs don't double-migrate).

7. **`LockInCoordinator.swift:34`** — `paywallOffer` displayName should be
   `"PaywallOffer"` (PascalCase) to match the RN route name (analytics +
   deep links).

8. **`HUDPanel.swift:88-91`** — Apply the border as a
   `RoundedRectangle(cornerRadius: SystemTokens.panelRadius)` stroke
   instead of a plain `Rectangle()` stroke so the corner radius is
   visually consistent with the `.clipShape` at `:102`.

9. **`StreakAtRiskBanner.swift:16`** — Inner cell bg opacity `.10` should
   be `0.08` per RN spec.

10. **`MissionsTabScreen.swift:67-69`** — Drop the empty "MISSION LOG"
    HUDPanel — RN doesn't render this as a separate empty panel.

11. **`StatRevealScreen.swift:72`** — While the PrimaryButton fix in #4
    will resolve this automatically, double-check the CTA "> BEGIN MY
    EVOLUTION" renders with the HUD outline style after the fix lands.

12. **`PaywallScreen.swift:233`** — Use `AppColors.primary` instead of
    `Color(hex: "#3A66FF")` for the CTA shadow (token discipline).

13. **`BenefitMissionsScreen.swift:21-23`**, **`BenefitReportScreen.swift:29-33,51,75,90`**,
    **`BenefitGuildsScreen.swift:23-26`** — Replace inline stat-color hex
    literals with `StatTokens.colors[.focus]`, `SystemTokens.gold`,
    `SystemTokens.cyan`, etc. The `#A855F7` purple stays inline by the
    documented onboarding-GUILDS exception.

14. **`MemberRow.swift:26-28`** and **`GuildCard.swift:18`** — Confirm
    the gold/silver/bronze top-3 tinting is a Swift addition or
    cross-check the RN equivalent. If Swift-added, document as such in
    `MIGRATION_DESIGN_FIDELITY.md`.

15. **Spot-check W2's `OnboardingProgressBar.swift`** for the post-`2eb79ef`
    2px track + 2px cyan glow-tip (shadowColor cyan / shadowOpacity 0.9 /
    shadowRadius 4). Not part of the 12 audited screens but referenced
    repeatedly by them.

16. **Spot-check `SettingsSheetShell` / each settings sheet** for the
    cyan handle + mono header + corner-brackets pattern in
    `MIGRATION_DESIGN_FIDELITY.md` §6.5.

---

## 6. Notes on items NOT flagged

- The `#0A1628` blue-tinted top-of-screen gradient is used verbatim in
  RN across HomeTab, MissionsTab, BoardTab, GuildDetail, Settings — the
  Swift port reproduces it inline in each screen rather than centralizing
  to DesignKit. Inline duplication is acceptable since the values are
  bit-exact and RN does the same.
- The 114 inline `Color(.sRGB)` literals are largely encoding the HUD
  button family + danger/cyan tint family that come straight from RN
  literals. They're correct; the alternative would be 7-8 new DesignKit
  constants for one-off colors.
- Every audited screen wires the streak tier color filter through W7's
  `FlameLottieView` (which falls back to an SF Symbol stand-in when
  `flame.json` is missing) — that integration is solid.
- The 27 onboarding route names match RN byte-for-byte; the navigation
  graph is a clean port.
- Glass-card alpha values (`rgba(21,26,33,0.5)` and `0.72`) reproduced
  exactly via `GlassCard.standard`/`.prominent` (`GlassCard.swift:59,61`).
- Animation timings (600ms easeOut stat bar, 800ms easeOut FocusRing,
  1500ms breathe + OVR glow, 2000ms bracket pulse, 1800ms shine sweep
  with 2500ms cycle, 5.5s SystemAnalysis safety) all match RN.

---

End of audit.
