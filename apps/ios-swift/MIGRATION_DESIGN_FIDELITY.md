# MIGRATION_DESIGN_FIDELITY

Source-of-truth design report for the React Native → Swift iOS port.
Every value below is cited to a `file:line` in the existing
`apps/mobile/` React Native codebase. Anything not present in the
source has been omitted intentionally — do not invent additions.

All `file:line` references are relative to repo root
`/Users/ken/Application/LockedIn/`.

---

## 1. Color tokens

Source: `apps/mobile/src/design/colors.ts` (full file, 43 lines).
Exported as `Colors` (`as const`):

| Token | Hex | Source comment | file:line |
|-------|-----|----------------|-----------|
| `background` | `#0E1116` | Primary background — deep graphite | `apps/mobile/src/design/colors.ts:10` |
| `backgroundSecondary` | `#151A21` | Secondary background — adds depth without full black | `apps/mobile/src/design/colors.ts:12` |
| `surface` | `#2C3440` | Elevated surface / cards / dividers — deep steel | `apps/mobile/src/design/colors.ts:14` |
| `primary` | `#3A66FF` | Primary accent — Discipline Blue (buttons, CTAs, active states) | `apps/mobile/src/design/colors.ts:18` |
| `accent` | `#00C2FF` | Subtle edge accent — Electric Cyan (streaks, Lock In active). Use sparingly. | `apps/mobile/src/design/colors.ts:20` |
| `textPrimary` | `#FFFFFF` | Primary text — high contrast on dark | `apps/mobile/src/design/colors.ts:24` |
| `textSecondary` | `#9CA3AF` | Secondary text | `apps/mobile/src/design/colors.ts:26` |
| `textMuted` | `#6B7280` | Muted text | `apps/mobile/src/design/colors.ts:28` |
| `disabled` | `#2C3440` | Disabled / inactive elements | `apps/mobile/src/design/colors.ts:32` |
| `success` | `#00D68F` | Success / positive feedback | `apps/mobile/src/design/colors.ts:34` |
| `danger` | `#FF4757` | Danger / destructive actions | `apps/mobile/src/design/colors.ts:36` |
| `warning` | `#FFC857` | Warning / upgrade prompts | `apps/mobile/src/design/colors.ts:38` |
| `lockInBackground` | `#090C10` | Near-black immersive background when session is running | `apps/mobile/src/design/colors.ts:42` |

File header palette description (`apps/mobile/src/design/colors.ts:4`):
"Deep graphite base, Discipline Blue accent, Electric Cyan edge. Feels: Precise. Structured. Technical."

---

## 2. Typography

Source: `apps/mobile/src/design/typography.ts` (full file, 82 lines).

### 2.1 FontFamily constants
Defined `as const` at `apps/mobile/src/design/typography.ts:7-22`:

| Key | Font name | Comment | file:line |
|-----|-----------|---------|-----------|
| `headingBold` | `InterTight_800ExtraBold` | major statements, hero text | `apps/mobile/src/design/typography.ts:9` |
| `heading` | `InterTight_700Bold` | primary headings | `apps/mobile/src/design/typography.ts:11` |
| `headingSemiBold` | `InterTight_600SemiBold` | section headers | `apps/mobile/src/design/typography.ts:13` |
| `bodyMedium` | `Inter_500Medium` | emphasized body | `apps/mobile/src/design/typography.ts:15` |
| `body` | `Inter_400Regular` | default body text | `apps/mobile/src/design/typography.ts:17` |
| `mono` | `JetBrainsMono_400Regular` | terminal / system text (e.g. "> SYSTEM INITIALIZING") | `apps/mobile/src/design/typography.ts:19` |
| `monoBold` | `JetBrainsMono_700Bold` | emphasized terminal text | `apps/mobile/src/design/typography.ts:21` |

### 2.2 Typography presets (`Typography` map)

| Preset | fontFamily | fontSize | letterSpacing | lineHeight | file:line |
|--------|-----------|---------:|--------------:|-----------:|-----------|
| `hero` | `FontFamily.headingBold` | 36 | -0.5 | 42 | `apps/mobile/src/design/typography.ts:32-37` |
| `heading` | `FontFamily.heading` | 28 | -0.3 | 34 | `apps/mobile/src/design/typography.ts:39-44` |
| `sectionHeader` | `FontFamily.headingSemiBold` | 22 | -0.2 | 28 | `apps/mobile/src/design/typography.ts:46-51` |
| `body` | `FontFamily.body` | 16 | (none) | 24 | `apps/mobile/src/design/typography.ts:53-57` |
| `bodyMedium` | `FontFamily.bodyMedium` | 16 | (none) | 24 | `apps/mobile/src/design/typography.ts:59-63` |
| `subtext` | `FontFamily.body` | 14 | (none) | 20 | `apps/mobile/src/design/typography.ts:65-69` |
| `caption` | `FontFamily.body` | 12 | (none) | 16 | `apps/mobile/src/design/typography.ts:71-75` |
| `button` | `FontFamily.headingSemiBold` | 17 | -0.1 | (none) | `apps/mobile/src/design/typography.ts:77-81` |

Note: `body`, `bodyMedium`, `subtext`, and `caption` do NOT set
`letterSpacing` in source. `button` does NOT set `lineHeight`.

---

## 3. HUD system tokens

Source: `apps/mobile/src/features/home/systemTokens.ts` (full file, 66 lines).

### 3.1 `SystemTokens` (`apps/mobile/src/features/home/systemTokens.ts:11-29`)

| Key | Value | file:line |
|-----|-------|-----------|
| `panelBg` | `rgba(10,22,40,0.85)` | `:12` |
| `panelBorder` | `rgba(58,102,255,0.12)` | `:13` |
| `panelRadius` | `4` | `:14` |
| `bracketColor` | `rgba(58,102,255,0.6)` | `:15` |
| `divider` | `rgba(255,255,255,0.06)` | `:16` |
| `barTrack` | `rgba(255,255,255,0.06)` | `:17` |
| `glowAccent` | `#3A66FF` | `:18` |
| `glowAccentSoft` | `rgba(58,102,255,0.06)` | `:19` |
| `cyan` | `#00C2FF` | `:20` |
| `green` | `#00D68F` | `:21` |
| `gold` | `#FFC857` | `:22` |
| `purple` | `#A855F7` | `:23` |
| `red` | `#FF4757` | `:24` |
| `textPrimary` | `#FFFFFF` | `:25` |
| `textSecondary` | `#9CA3AF` | `:26` |
| `textMuted` | `#6B7280` | `:27` |
| `textGlow` | `rgba(58,102,255,0.4)` | `:28` |

### 3.2 `STAT_COLORS` (`apps/mobile/src/features/home/systemTokens.ts:31-37`)

| Stat | Color |
|------|-------|
| `discipline` | `#3A66FF` |
| `focus` | `#00C2FF` |
| `execution` | `#00D68F` |
| `consistency` | `#FFC857` |
| `social` | `#A855F7` |

### 3.3 `STAT_LABELS` (`apps/mobile/src/features/home/systemTokens.ts:39-45`)

| Stat | Label |
|------|-------|
| `discipline` | `DIS` |
| `focus` | `FOC` |
| `execution` | `EXE` |
| `consistency` | `CON` |
| `social` | `SOC` |

### 3.4 `SectionLabelStyle` (`apps/mobile/src/features/home/systemTokens.ts:47-52`)
- `fontFamily`: `FontFamily.headingBold` (InterTight 800)
- `fontSize`: `11`
- `letterSpacing`: `2.5`
- `color`: `SystemTokens.glowAccent` (`#3A66FF`)

### 3.5 `SectionMetaStyle` (`apps/mobile/src/features/home/systemTokens.ts:54-59`)
- `fontFamily`: `FontFamily.headingSemiBold` (InterTight 600)
- `fontSize`: `11`
- `letterSpacing`: `1`
- `color`: `SystemTokens.textMuted` (`#6B7280`)

### 3.6 Boot flag
A module-local `_hasBooted` boolean with `getHasBooted()` /
`markBooted()` exposed at `apps/mobile/src/features/home/systemTokens.ts:61-65`.
Not a visual token but lives in the same file.

---

## 4. Streak tier system

Source: `apps/mobile/src/design/streakTiers.ts` (full file, 103 lines).

### 4.1 `STREAK_TIERS` (`apps/mobile/src/design/streakTiers.ts:15-22`)

| threshold | label | color | colorLight | line |
|----------:|-------|-------|-----------|------|
| 3 | `3 Day` | `#FF6B35` | `#FF8F5E` | `:16` |
| 7 | `7 Day` | `#FFD700` | `#FFE44D` | `:17` |
| 30 | `1 Month` | `#00D68F` | `#33E5AA` | `:18` |
| 90 | `3 Month` | `#00C2FF` | `#5AD8FF` | `:19` |
| 180 | `6 Month` | `#8B5CF6` | `#A78BFA` | `:20` |
| 365 | `1 Year` | `#FF006E` | `#FF4D94` | `:21` |

### 4.2 Defaults (streak < 3 days)
- `DEFAULT_COLOR = '#4B5563'` (`apps/mobile/src/design/streakTiers.ts:24`)
- `DEFAULT_COLOR_LIGHT = '#6B7280'` (`apps/mobile/src/design/streakTiers.ts:25`)

Returned by `getStreakTierInfo` when `streak < STREAK_TIERS[0].threshold`,
with `current = null`, `next = STREAK_TIERS[0]`, `progress = streak / 3`
(`apps/mobile/src/design/streakTiers.ts:36-44`).

### 4.3 Rotating tier algorithm (streak ≥ 365)
Source: `apps/mobile/src/design/streakTiers.ts:79-84`.

```
daysAfterYear = streak - 365
cycleDays = Math.floor(365 / STREAK_TIERS.length)   // = floor(365/6) = 60
tierIndex = Math.floor(daysAfterYear / cycleDays) % STREAK_TIERS.length
```

Returns `STREAK_TIERS[tierIndex]`. So past 365 days the tier cycles
through the 6 entries roughly every 60 days. (Source comment confirms
"~60 days each" — `apps/mobile/src/design/streakTiers.ts:68`.)

### 4.4 Lottie flame color filter mapping
`getFlameColorFilters(color, colorLight)` returns 10 keypath entries
(`apps/mobile/src/design/streakTiers.ts:89-102`). Pattern: odd-indexed
layers get `color`, even-indexed layers get `colorLight`:

| Keypath | Color |
|---------|-------|
| `Ebene 1/VG_Flame_Def Konturen` | `color` |
| `Ebene 2/VG_Flame_Def Konturen` | `colorLight` |
| `Ebene 3/VG_Flame_Def Konturen` | `color` |
| `Ebene 4/VG_Flame_Def Konturen` | `colorLight` |
| `Ebene 5/VG_Flame_Def Konturen` | `color` |
| `Ebene 6/VG_Flame_Def Konturen` | `colorLight` |
| `Ebene 7/VG_Flame_Def Konturen` | `color` |
| `Ebene 8/VG_Flame_Def Konturen` | `colorLight` |
| `Ebene 9/VG_Flame_Def Konturen` | `color` |
| `Ebene 10/VG_Flame_Def Konturen` | `colorLight` |

---

## 5. Rank tier system

Source: `apps/mobile/src/design/rankTiers.ts` (full file, 35 lines).
`RANK_TIERS` array at `apps/mobile/src/design/rankTiers.ts:17-27`. File
header comment notes the SQL CASE in `00011_user_stats.sql`
`recompute_user_stats()` is the source of truth (`:5`).

| id | name | minDays | color | line |
|----|------|--------:|-------|------|
| `npc` | `NPC` | 0 | `#8B8B8B` | `:18` |
| `grinder` | `RECRUIT` | 3 | `#4A7FB5` | `:19` |
| `rising` | `RISING` | 7 | `#00C2FF` | `:20` |
| `chosen` | `CHOSEN` | 14 | `#00D68F` | `:21` |
| `elite` | `ELITE` | 30 | `#FFC857` | `:22` |
| `phantom` | `PHANTOM` | 60 | `#FF4757` | `:23` |
| `legend` | `LEGEND` | 90 | `#A855F7` | `:24` |
| `goat` | `GOAT` | 180 | `#E0E7FF` | `:25` |
| `locked_in` | `LOCKED IN` | 365 | `#FF006E` | `:26` |

Note id/display-name mismatch on row 2: id `grinder` displays as
`RECRUIT`.

`RANK_BY_ID` is a reduce-derived `Record<RankId, RankTier>`
(`apps/mobile/src/design/rankTiers.ts:29-35`).

---

## 6. Reusable design components

Folder: `apps/mobile/src/design/components/`. Five files.

### 6.1 `PrimaryButton.tsx`

Source: `apps/mobile/src/design/components/PrimaryButton.tsx` (82 lines).
Local constants `apps/mobile/src/design/components/PrimaryButton.tsx:14-16`:

- `HUD_PRIMARY = '#3A66FF'`
- `HUD_BG = 'rgba(58,102,255,0.18)'`
- `HUD_BORDER = 'rgba(58,102,255,0.45)'`

`button` style (`:50-58`):
- `backgroundColor: HUD_BG` (`rgba(58,102,255,0.18)`)
- `borderWidth: 1`
- `borderColor: HUD_BORDER` (`rgba(58,102,255,0.45)`)
- `paddingVertical: 14`
- `paddingHorizontal: 48`
- `alignItems: 'center'`, `justifyContent: 'center'`
- No `borderRadius` set (sharp corners).

`secondary` (ghost) variant (`:59-65`):
- `backgroundColor: 'transparent'`
- `borderWidth: 0`
- `borderLeftWidth: 2`, `borderLeftColor: 'rgba(255,255,255,0.06)'`
- `paddingVertical: 12`

`disabled` (`:66-68`): `opacity: 0.35`.

`text` (`:69-74`):
- `fontFamily: FontFamily.headingBold` (InterTight 800)
- `fontSize: 13`
- `letterSpacing: 1.6`
- `color: HUD_PRIMARY` (`#3A66FF`)

`secondaryText` (`:75-78`): `color: '#9CA3AF'`, `letterSpacing: 1.2`.

`TouchableOpacity` uses `activeOpacity={0.85}`
(`apps/mobile/src/design/components/PrimaryButton.tsx:34`). No shadow
properties defined.

### 6.2 `OptionItem.tsx`

Source: `apps/mobile/src/design/components/OptionItem.tsx` (49 lines).

`container` (`:27-35`):
- `borderWidth: 1`, `borderColor: Colors.surface` (`#2C3440`)
- `borderRadius: 12`
- `paddingVertical: 14`, `paddingHorizontal: 18`
- `marginBottom: 10`
- `backgroundColor: Colors.backgroundSecondary` (`#151A21`)

`selected` (`:36-39`): `borderColor: Colors.primary` (`#3A66FF`),
`backgroundColor: Colors.surface` (`#2C3440`).

`label`: `Typography.body` + `color: Colors.textSecondary`
(`apps/mobile/src/design/components/OptionItem.tsx:40-43`).

`selectedLabel`: `color: Colors.textPrimary`
(`apps/mobile/src/design/components/OptionItem.tsx:44-46`).

`TouchableOpacity activeOpacity={0.7}` (`:17`). No shadow.

### 6.3 `ProgressIndicator.tsx`

Source: `apps/mobile/src/design/components/ProgressIndicator.tsx` (44 lines).

`container` (`:26-30`): `paddingTop: 8`, `paddingBottom: 4`,
`paddingHorizontal: 0`.

`track` (`:31-36`):
- `height: 1`
- `borderRadius: 1.5`
- `backgroundColor: Colors.surface` (`#2C3440`)
- `overflow: 'hidden'`

`fill` (`:37-41`):
- `height: '100%'`
- `borderRadius: 1.5`
- `backgroundColor: Colors.primary` (`#3A66FF`)

Width is set inline as percent
(`apps/mobile/src/design/components/ProgressIndicator.tsx:19`).
No animation, no shadow.

### 6.4 `ScreenContainer.tsx`

Source: `apps/mobile/src/design/components/ScreenContainer.tsx` (40 lines).

`safe` (`:26-29`): `flex: 1`, `backgroundColor: Colors.background`
(`#0E1116`).
`content` (`:30-34`): `flex: 1`, `paddingHorizontal: 24`,
`paddingVertical: 16`.
`centered` (`:35-37`): `justifyContent: 'center'`.

`centered` defaults to `true`
(`apps/mobile/src/design/components/ScreenContainer.tsx:14`).

### 6.5 `AppGuideSheet.tsx`

Source: `apps/mobile/src/design/components/AppGuideSheet.tsx` (350 lines).
A bottom-sheet modal with corner brackets, mono section label,
gradient rule, tip rows, and an HUD primary CTA. Persists dismissal
under key `@lockedin/guide_{id}_shown`
(`apps/mobile/src/design/components/AppGuideSheet.tsx:42`).

Local color constants `:35-39`:
- `HUD_PANEL_BG = 'rgba(10,22,40,0.95)'`
- `HUD_PANEL_BORDER = 'rgba(58,102,255,0.18)'`
- `HUD_ACCENT = '#3A66FF'`
- `HUD_BRACKET = 'rgba(58,102,255,0.6)'`
- `HUD_TEXT_MUTED = '#6B7280'`

`backdrop` (`:245-249`): `flex: 1`, `backgroundColor: 'rgba(0,0,0,0.6)'`,
`justifyContent: 'flex-end'`.

`sheet` (`:250-261`):
- `backgroundColor: HUD_PANEL_BG`
- `borderTopWidth: 1`, `borderLeftWidth: 1`, `borderRightWidth: 1`
- `borderColor: HUD_PANEL_BORDER`
- `borderTopLeftRadius: 4`, `borderTopRightRadius: 4`
- `paddingHorizontal: 20`, `paddingTop: 18`, `paddingBottom: 40`

`handle` (`:262-268`): `width: 36`, `height: 3`,
`backgroundColor: 'rgba(255,255,255,0.12)'`, `alignSelf: 'center'`,
`marginBottom: 18`.

`sectionLabel` (`:274-279`): `FontFamily.mono`, `fontSize: 11`,
`letterSpacing: 2`, `color: HUD_ACCENT`.

`pageIndicator` (`:280-285`): `FontFamily.mono`, `fontSize: 10`,
`letterSpacing: 1.6`, `color: HUD_TEXT_MUTED`.

`sectionRule` (`:286-291`): `height: 1`, `width: '100%'`,
`marginTop: 6`, `marginBottom: 16`. Rendered as `LinearGradient`
from `HUD_ACCENT` to `transparent`, horizontal
(`:191-195`).

`title` (`:292-298`): `FontFamily.headingBold`, `fontSize: 22`,
`color: Colors.textPrimary`, `letterSpacing: -0.3`, `lineHeight: 28`.

`subtitle` (`:299-305`): `FontFamily.body`, `fontSize: 14`,
`color: HUD_TEXT_MUTED`, `marginTop: 6`, `lineHeight: 20`.

`tipsContainer` (`:306-309`): `marginTop: 20`, `gap: 8`.

`tipRow` (`:310-319`): `flexDirection: 'row'`, `alignItems: 'center'`,
`gap: 12`, `paddingVertical: 12`, `paddingHorizontal: 12`,
`backgroundColor: 'rgba(255,255,255,0.02)'`, `borderLeftWidth: 2`,
`borderLeftColor: HUD_ACCENT` (overridden per-tip with `tip.iconColor`
at `:208`).

`tipIconWrap` (`:320-326`): `width: 30`, `height: 30`, `borderWidth: 1`,
`alignItems: 'center'`, `justifyContent: 'center'`. The
`backgroundColor` and `borderColor` come inline from the per-tip
accent: `${accent}1F` / `${accent}55` (`:213-216`).

`tipText` (`:327-333`): `flex: 1`, `FontFamily.bodyMedium`,
`fontSize: 13`, `color: Colors.textPrimary`, `lineHeight: 18`.

`primaryBtn` (`:334-341`): `marginTop: 22`,
`backgroundColor: 'rgba(58,102,255,0.18)'`, `borderWidth: 1`,
`borderColor: 'rgba(58,102,255,0.45)'`, `paddingVertical: 14`,
`alignItems: 'center'`.

`primaryBtnText` (`:342-347`): `FontFamily.headingBold`, `fontSize: 13`,
`color: HUD_ACCENT`, `letterSpacing: 1.6`. Text content uses
`> NEXT` or `> GOT IT` (`:233-235`).

Corner brackets are inlined as four `<Svg>` `L`-shape paths
(`apps/mobile/src/design/components/AppGuideSheet.tsx:78-103`),
`size = 14`, `stroke = 1.5`, `color = HUD_BRACKET`.

Open animation: `Animated.spring(slideAnim, { toValue: 0,
useNativeDriver: true, tension: 65, friction: 11 })`
(`:140-145`). Close animation: `Animated.timing(slideAnim,
{ toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true })`
(`:152-156`).

---

## 7. Glassmorphism specs from actual usage

Frequencies across `apps/mobile/src/` (counts via `grep -rh ... | sort
| uniq -c | sort -rn`).

### 7.1 Most common `backgroundColor: 'rgba(...)'`

| Count | Value | Representative usage |
|------:|-------|----------------------|
| 19 | `rgba(255,255,255,0.04)` | Hover/pressed tint, input field bg (`apps/mobile/src/features/auth/screens/SignInScreen.tsx:448`, `MainNavigator.tsx:467` etc.) |
| 16 | `rgba(255,255,255,0.02)` | Faintest surface tint, tip rows (`apps/mobile/src/features/home/components/CompactMissions.tsx:111`, AppGuideSheet `tipRow`) |
| 11 | `rgba(58,102,255,0.12)` | Discipline-blue selected card bg (`apps/mobile/src/features/auth/screens/EditProfileScreen.tsx:443`, `JoinGuildScreen.tsx:269`) |
| 11 | `rgba(58,102,255,0.06)` | Blue glow orb / very subtle blue tint (`apps/mobile/src/features/home/screens/HomeTab.tsx:363`, `SystemStatusBar.tsx:416`) |
| 7 | `rgba(58,102,255,0.18)` | HUD button bg (`PrimaryButton.tsx:15`, `AppGuideSheet.tsx:336`) |
| 7 | `rgba(21,26,33,0.5)` | Glass card bg (50% of `backgroundSecondary`) (`GuildCard.tsx:87`, `GuildDetailScreen.tsx:493`) |
| 6 | `rgba(21,26,33,0.72)` | Prominent glass card (72% of `backgroundSecondary`) (`InviteCodeCard.tsx:103`, `SignInScreen.tsx:415`) |
| 6 | `rgba(0,0,0,0.6)` | Modal/sheet backdrop (`AppGuideSheet.tsx:247`, `SignUpNudgeSheet.tsx:113`) |
| 5 | `rgba(44,52,64,0.5)` | Surface at 50% (`EditProfileScreen.tsx:379`, `GuildCard.tsx:163`) |
| 5 | `rgba(44,52,64,0.4)` | Surface at 40% (`CreateGuildScreen.tsx:184`, `JoinGuildScreen.tsx:244`) |
| 5 | `rgba(0,214,143,0.08)` | Faint success tint (`InviteCodeCard.tsx:160`, `JoinGuildScreen.tsx:298`) |
| 4 | `rgba(58,102,255,0.42)` | Solid HUD CTA bg (`SignInScreen.tsx:476`, `SignUpScreen.tsx:467`, `StreakBreakOverlay.tsx:275`) |
| 4 | `rgba(255,255,255,0.08)` | Stronger white tint |
| 4 | `rgba(255,255,255,0.05)` | Mid white tint |
| 4 | `rgba(0,194,255,0.05)` | Cyan glow orb |
| 3 | `rgba(58,102,255,0.3)` | Blue mid-strength tint |
| 3 | `rgba(58,102,255,0.08)` | Blue subtle tint |
| 3 | `rgba(255,71,87,0.08)` | Danger soft tint |

### 7.2 Most common `borderColor: 'rgba(...)'`

| Count | Value | Representative usage |
|------:|-------|----------------------|
| 13 | `rgba(255,255,255,0.04)` | Standard card hairline (`MissionCard.tsx:420,693,800`, `GuildCard.tsx:90`) |
| 12 | `rgba(255,255,255,0.08)` | Slightly heavier hairline (`AchievementsRow.tsx:135`, `OnboardingAuthScreen.tsx:487`) |
| 11 | `rgba(255,255,255,0.06)` | Hairline on most onboarding inputs/cards (`CreateGuildScreen.tsx:187`, `MemberRow.tsx:186`) |
| 7 | `rgba(58,102,255,0.45)` | HUD button border (`PrimaryButton.tsx:16`, `AppGuideSheet.tsx:338`, `MainNavigator.tsx:467`) |
| 6 | `rgba(58,102,255,0.25)` | Selected option soft blue border (`HUDOptionCard.tsx:45` — see selected branch, `DailyActivityCard.tsx:127`) |
| 4 | `rgba(58,102,255,0.3)` | Blue mid border |
| 4 | `rgba(255,255,255,0.07)` | Glass card border (`SignInScreen.tsx:418`, `InviteCodeCard.tsx:106`) |
| 4 | `rgba(120,160,255,0.55)` | Onboarding glass CTA outline (`StreakBreakOverlay.tsx:277`, `SignInScreen.tsx:483`, `CommitmentScreen.tsx:216`) |
| 3 | `rgba(58,102,255,0.35)` | Stronger blue accent border |
| 3 | `rgba(255,71,87,0.2)` | Danger card border |
| 3 | `rgba(255,255,255,0.05)` | Faint hairline |
| 3 | `rgba(0,214,143,0.12)` | Success card border |
| 2 | `rgba(255,71,87,0.12)` | Subtle danger border |
| 2 | `rgba(255,255,255,0.03)` | Faintest hairline |
| 2 | `rgba(0,214,143,0.15)` | Success border |

### 7.3 Key patterns observed in source

- **HUD button signature** (`PrimaryButton.tsx:14-16`): bg
  `rgba(58,102,255,0.18)` + border `rgba(58,102,255,0.45)` + text
  `#3A66FF`. Reused verbatim by `AppGuideSheet.primaryBtn`
  (`:336-341`), `DurationPicker.startBtn` (after `6210cbb`), and many
  sheet CTAs.
- **Glass card "prominent"** = `rgba(21,26,33,0.72)` + border
  `rgba(255,255,255,0.07)` (e.g. `SignInScreen.tsx:415-418`).
- **Glass card "standard"** = `rgba(21,26,33,0.5)` + border
  `rgba(255,255,255,0.04)` (e.g. `GuildCard.tsx:87-90`).
- **Input field surface** = `rgba(255,255,255,0.04)` + border
  `rgba(255,255,255,0.08)` (e.g. `SignInScreen.tsx:448-450`,
  `SignUpScreen.tsx:451-453`).
- **HUD selected option** (`HUDOptionCard.tsx:45-46`): `borderLeftColor`
  = accent, `backgroundColor` = `${accent}24` (14% alpha).

---

## 8. Animation timings

### 8.1 `Animated.timing` `duration:` value frequency
(`grep -rh "duration:" apps/mobile/src/ | grep -oE "duration: [0-9]+" |
sort | uniq -c | sort -rn`):

| Count | Duration (ms) |
|------:|--------------:|
| 32 | 400 |
| 31 | 500 |
| 15 | 600 |
| 9 | 250 |
| 8 | 350 |
| 6 | 1500 |
| 5 | 800 |
| 5 | 50 |
| 4 | 1800 |
| 4 | 1000 |
| 3 | 700 |
| 3 | 300 |
| 2 | 2000 |
| 2 | 200 |
| 2 | 1200 |
| 1 | 8000 |
| 1 | 1600 |

### 8.2 Easing usage

| file:line | Easing | Animates |
|-----------|--------|----------|
| `apps/mobile/src/features/home/ExecutionBlockScreen.tsx:275` | `Easing.linear` | Session countdown ring |
| `apps/mobile/src/features/home/components/FocusRing.tsx:61` | `Easing.out(Easing.cubic)` | Progress ring fill (duration 800) |
| `apps/mobile/src/features/home/components/FocusRing.tsx:75,81` | `Easing.inOut(Easing.ease)` | Idle "breathe" loop (duration 1500 each direction) |
| `apps/mobile/src/features/home/components/StatBar.tsx:57` | `Easing.out(Easing.cubic)` | Stat bar fill (duration 600) |
| `apps/mobile/src/features/home/components/MissionCompleteOverlay.tsx:77` | `Easing.in(Easing.ease)` | Overlay exit |
| `apps/mobile/src/features/home/components/RankUpOverlay.tsx:82` | `Easing.out(Easing.cubic)` | Rank-up reveal |
| `apps/mobile/src/features/home/components/HUDPanel.tsx:54,60` | `Easing.inOut(Easing.ease)` | Corner-bracket opacity pulse (duration 2000 each direction, looped) |
| `apps/mobile/src/features/home/components/SystemStatusBar.tsx:151,157` | `Easing.inOut(Easing.ease)` | OVR glow pulse (duration 1500 each direction, looped) |
| `apps/mobile/src/features/auth/screens/SignInScreen.tsx:58` | `Easing.inOut(Easing.ease)` | Glow orb animation |
| `apps/mobile/src/features/auth/screens/SignUpScreen.tsx:58` | `Easing.inOut(Easing.ease)` | Glow orb animation |
| `apps/mobile/src/features/subscription/PaywallOfferScreen.tsx:117` | `Easing.inOut(Easing.ease)` | Paywall element |
| `apps/mobile/src/features/onboarding/screens/DefinitionScreen.tsx:56,63,70` | `Easing.out(Easing.ease)` | Staggered fade-ins |
| `apps/mobile/src/features/onboarding/screens/CommitmentScreen.tsx:82,98,104` | `Easing.out(Easing.ease)` + `Easing.inOut(Easing.ease)` | Onboarding reveal + pulse |
| `apps/mobile/src/features/onboarding/screens/WakeUpCallScreen.tsx:103,114,120` | `Easing.out(Easing.cubic)` + `Easing.inOut(Easing.ease)` | Alarm reveal + pulse |
| `apps/mobile/src/features/onboarding/screens/StatRevealScreen.tsx:77` | `Easing.out(Easing.ease)` | Stat reveal |
| `apps/mobile/src/features/onboarding/screens/PaywallScreen.tsx:71` | `Easing.inOut(Easing.ease)` | Paywall fade |
| `apps/mobile/src/features/onboarding/screens/BenefitReportScreen.tsx:135` | `Easing.linear` | Report animation |
| `apps/mobile/src/features/onboarding/components/OnboardingProgressBar.tsx:63` | `Easing.out(Easing.cubic)` | Progress bar fill (`TRANSITION_MS = 450` at `:36`) |
| `apps/mobile/src/features/onboarding/components/BenefitTemplate.tsx:73,80,89,96` | `Easing.out(Easing.ease)` | Graphic + headline staggered reveal |

### 8.3 `Animated.spring` configurations

| file:line | Animates | Spring config |
|-----------|----------|---------------|
| `apps/mobile/src/design/components/AppGuideSheet.tsx:140-145` | Bottom sheet open | `tension: 65, friction: 11` |
| `apps/mobile/src/features/home/components/RankUpOverlay.tsx:101-103` | Rank scale | `friction: 6` (tension default) |
| `apps/mobile/src/features/home/components/MissionCompleteOverlay.tsx:58-60` | translateY | `friction: 7` |
| `apps/mobile/src/features/home/components/MissionCompleteOverlay.tsx:64-66` | scale | `friction: 6` |
| `apps/mobile/src/features/home/components/XPBreakdown.tsx:95-97` | totalScale | `friction: 6` |
| `apps/mobile/src/features/auth/components/SignUpNudgeSheet.tsx:41-45` | Sheet open | `friction: 11` |
| `apps/mobile/src/features/subscription/PaywallOfferScreen.tsx:89` | statScale | `friction: 8, tension: 40` |
| `apps/mobile/src/features/subscription/PaywallOfferScreen.tsx:104` | bar anim | `friction: 10, tension: 50` |

### 8.4 Specific loop pulses (HUD ambient breathing)

- **`HUDPanel` corner-bracket pulse**: opacity 0.6 ↔ 0.4, 2000ms each
  way, `Easing.inOut(Easing.ease)`, looped while `idle === true`
  (`apps/mobile/src/features/home/components/HUDPanel.tsx:45-67`).
- **`SystemStatusBar` OVR glow**: 0.5 ↔ 1, 1500ms each way,
  `Easing.inOut(Easing.ease)`
  (`apps/mobile/src/features/home/components/SystemStatusBar.tsx:144-164`).
  Today-pulse: 0.6 ↔ 1, 1000ms each way, no easing
  (`:166-184`).
- **`FocusRing` breathing**: 0.6 ↔ 1, 1500ms each way, only when
  `focused === 0`
  (`apps/mobile/src/features/home/components/FocusRing.tsx:67-88`).

---

## 9. Spacing values

Counts via `grep -rh ... | grep -oE '<prop>: [0-9]+' | sort | uniq -c |
sort -rn` on `apps/mobile/src/`.

### 9.1 `padding`
| Count | Value |
|------:|------:|
| 7 | 16 |
| 6 | 14 |
| 5 | 24 |
| 2 | 8 |
| 2 | 4 |
| 2 | 20 |
| 2 | 18 |
| 2 | 12 |

### 9.2 `paddingHorizontal`
| Count | Value |
|------:|------:|
| 23 | 16 |
| 16 | 24 |
| 14 | 14 |
| 12 | 20 |
| 12 | 12 |
| 11 | 8 |
| 7 | 4 |
| 5 | 6 |
| 5 | 32 |
| 5 | 18 |
| 5 | 10 |
| 3 | 48 |

### 9.3 `paddingVertical`
| Count | Value |
|------:|------:|
| 31 | 14 |
| 20 | 16 |
| 17 | 12 |
| 14 | 8 |
| 11 | 10 |
| 10 | 4 |
| 8 | 2 |
| 6 | 6 |
| 4 | 15 |
| 2 | 18 |

### 9.4 `gap`
| Count | Value |
|------:|------:|
| 40 | 8 |
| 28 | 12 |
| 27 | 6 |
| 15 | 10 |
| 14 | 4 |
| 5 | 3 |
| 4 | 16 |
| 4 | 2 |
| 3 | 14 |
| 3 | 5 |
| 2 | 24 |

### 9.5 `marginBottom`
| Count | Value |
|------:|------:|
| 30 | 8 |
| 24 | 16 |
| 23 | 12 |
| 14 | 24 |
| 14 | 20 |
| 13 | 18 |
| 12 | 14 |
| 9 | 6 |
| 8 | 10 |
| 6 | 4 |

### 9.6 `borderRadius`
| Count | Value |
|------:|------:|
| 24 | 12 |
| 18 | 8 |
| 16 | 28 |
| 14 | 16 |
| 13 | 14 |
| 12 | 2 |
| 11 | 3 |
| 10 | 10 |
| 9 | 6 |
| 7 | 18 |
| 7 | 1 |
| 6 | 110 |
| 4 | 4 |

Note: `borderRadius: 110` and similar large values come from glow-orb
circles. The HUD system itself uses `panelRadius: 4`
(`apps/mobile/src/features/home/systemTokens.ts:14`), so the bulk of
HUD-styled surfaces have sharp or near-sharp corners.

---

## 10. Recent HUD redesign commits

### 10.1 `2eb79ef` — "feat: Introduce HUDOptionCard component and enhance BenefitTemplate with panel labels"
Files changed (9 files, +222 / -87):
- `apps/mobile/src/design/components/PrimaryButton.tsx` (+40 -29 lines roughly):
  - Replaced solid `Colors.primary` button with HUD-style: bg
    `rgba(58,102,255,0.18)`, border `rgba(58,102,255,0.45)`,
    `borderRadius` removed, `paddingVertical` 16→14.
  - Text: switched from `Typography.button` (17px) to InterTight 800
    13px, `letterSpacing: 1.6`, color `#3A66FF`.
  - `disabled` style changed from solid surface bg to `opacity: 0.35`.
  - `secondary` variant changed from outlined card to left-border-only
    ghost (`borderLeftWidth: 2, borderLeftColor:
    'rgba(255,255,255,0.06)'`, `paddingVertical: 12`).
  - `activeOpacity` raised 0.8→0.85.
- `apps/mobile/src/features/onboarding/components/BenefitTemplate.tsx`:
  - Wrapped graphic in `HUDPanel` with `headerLabel` prop (defaulting
    to `'SYSTEM'`) and accent color = headline color.
  - Headline font size 28→26, lineHeight 32→30.
  - Body fontSize 16→15, lineHeight 24→22.
  - Callout fontSize 16→14, `letterSpacing` -0.1→0.4.
  - Replaced bespoke gradient/shadowed CTA (`borderRadius: 28`,
    `shadowColor #3A66FF`, opacity 0.35 shadow) with shared
    `PrimaryButton title="CONTINUE"`.
  - Default `calloutColor` switched from `Colors.accent` to
    `SystemTokens.cyan` (same value `#00C2FF`).
  - Adds `panelLabel?: string` to the public props.
- `apps/mobile/src/features/onboarding/components/HUDOptionCard.tsx`:
  - New file (122 lines). See section 11.
- `apps/mobile/src/features/onboarding/components/OnboardingProgressBar.tsx`:
  - `BAR_HEIGHT` 3→2.
  - Added `LABEL_HEIGHT = 14` constant and `// STEP 03 / 17` mono
    label above the bar (`stepLabel` style: InterTight 800, 10px,
    `letterSpacing: 2.4`, color `SystemTokens.textMuted`).
  - Track `backgroundColor` switched from `rgba(255,255,255,0.06)` to
    `SystemTokens.barTrack` (same value).
  - Fill `borderRadius` removed; added a 2px cyan `fillTip` square at
    the head of the bar with `shadowColor: SystemTokens.cyan`,
    `shadowOpacity: 0.9`, `shadowRadius: 4`.
  - Fill colored via `SystemTokens.glowAccent` instead of
    `Colors.primary` (same value).
  - Removed the previous fill `shadowColor/Opacity/Radius`.
- `apps/mobile/src/features/onboarding/screens/BenefitExecutionScreen.tsx`,
  `BenefitGuildsScreen.tsx`, `BenefitMissionsScreen.tsx`,
  `BenefitRanksScreen.tsx`, `BenefitReportScreen.tsx`:
  - Each touched by one line — they now pass the new `panelLabel`
    prop to `BenefitTemplate`.

### 10.2 `6210cbb` — "feat: Enhance DurationPickerModal with new HUD design and improved styling"
Single file (`apps/mobile/src/navigation/MainNavigator.tsx`,
+106 / -138). All changes are to the `DurationPickerModal` styles `dp`:

- Removed: hero icon block (52×52 rounded square holding
  `lock-closed`), `title` "Lock In" 24px InterTight 800, the
  centered subtitle 14px Inter, separator `divider` View, and
  `startBtnInner` Ionicons row.
- Added: top `header` block with `// LOCK IN` `SectionLabelStyle`
  label, `LinearGradient` rule from `bracketColor` to transparent,
  and "CHOOSE FOCUS DURATION" uppercase subtitle (InterTight 800,
  10px, `letterSpacing: 1.6`, color `textMuted`).
- Added: `<HUDCornerBrackets color={SystemTokens.bracketColor} />`
  inside the card.
- `card` style:
  - `backgroundColor` → `SystemTokens.panelBg`
    (`rgba(10,22,40,0.85)`).
  - `borderColor` → `SystemTokens.panelBorder`
    (`rgba(58,102,255,0.12)`).
  - `borderRadius: 28, padding: 28` → `paddingHorizontal: 18,
    paddingTop: 14, paddingBottom: 16` and no radius.
- `overlay` backdrop changed `rgba(0,0,0,0.8)` → `rgba(0,0,0,0.75)`.
- `grid` `gap` 10→8, `justifyContent` `center` → `space-between`,
  `marginBottom` 16→12.
- `option`:
  - Was `width: 88, height: 76, backgroundColor:
    'rgba(44,52,64,0.3)', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'`.
  - Now `flexBasis: '31.5%', height: 72, backgroundColor:
    'rgba(255,255,255,0.02)', borderLeftWidth: 2, borderLeftColor:
    'rgba(255,255,255,0.06)'`.
- `optionActive`: bg `rgba(58,102,255,0.12)` →
  `rgba(58,102,255,0.14)`; replaced border with `borderLeftColor:
  SystemTokens.glowAccent`.
- Removed `optionGlow` View entirely.
- `optionValue`: family `FontFamily.heading` → `FontFamily.headingBold`;
  size 24→26; added `letterSpacing: -0.5`.
- `optionValueActive`: color → `SystemTokens.glowAccent`; added
  `textShadowColor: glowAccent`, `textShadowRadius: 6`,
  `textShadowOffset: {0,0}` glow.
- `optionLabel`: family `FontFamily.body` → `FontFamily.headingBold`;
  size 11→9; added `letterSpacing: 1.4`. Active color now
  `SystemTokens.glowAccent` (instead of `rgba(58,102,255,0.7)`).
  Labels rendered uppercase at runtime
  (`apps/mobile/src/navigation/MainNavigator.tsx`,
  `dur.label.toUpperCase()` post-commit).
- `customBtn`: bg `rgba(44,52,64,0.25)` →
  `rgba(255,255,255,0.02)`; removed `borderRadius` and full border;
  added `borderLeftWidth: 2, borderLeftColor: 'rgba(0,194,255,0.45)'`.
  Padding 14/18 → 12/14; `gap` 8→10; `marginBottom` 18→12.
- `customBtnText`: family `bodyMedium` → `headingBold`; size 13→11;
  added `letterSpacing: 1.4`; color `Colors.accent` →
  `SystemTokens.cyan`.
- Removed `divider` style.
- `cancelText` size 14→13; color → `SystemTokens.textMuted`.
- `pickerCard`: bg `rgba(44,52,64,0.2)` → `rgba(255,255,255,0.02)`;
  removed `borderRadius: 20` and full border; added
  `borderLeftWidth: 2, borderLeftColor: 'rgba(58,102,255,0.35)'`.
- `separatorDot`: 5×5 radius 2.5 → 4×4 sharp.
- `summaryText`: family `bodyMedium` → `headingBold`; size 13→11; added
  `letterSpacing: 1.2`; color `Colors.textMuted` →
  `SystemTokens.textSecondary`.
- `startBtn`: `borderRadius: 14, backgroundColor:
  'rgba(58,102,255,0.1)', borderColor: 'rgba(58,102,255,0.2)'` →
  `paddingVertical: 14, backgroundColor: 'rgba(58,102,255,0.18)',
  borderColor: 'rgba(58,102,255,0.45)'`; removed inner Ionicons row,
  text now `⟐ START {h}H {m}M BLOCK`.
- `startBtnText`: family `headingSemiBold` → `headingBold`; size 16→13;
  added `letterSpacing: 1.6`; color `Colors.primary` →
  `SystemTokens.glowAccent` (same value).
- `backBtnText` size 14→13.
- Custom button icon size 16→14, chevron 14→12, time-outline icon
  16→12 (chevrons/dots all shrunk to suit the smaller HUD body
  density).

### 10.3 `5370315` — "feat: Rename 'Crew' to 'Guild' across the application"

46 files, +2809 / -1391. Visual-design-relevant changes:

- Renames the entire leaderboard surface from Crew → Guild.
  `services/CrewService.ts` → `services/GuildService.ts`,
  `EmptyCrewState` → `EmptyGuildState`, `CrewCard` → `GuildCard`,
  `CreateCrewScreen` → `CreateGuildScreen`,
  `CrewDetailScreen` → `GuildDetailScreen`,
  `CrewListScreen` → `GuildListScreen`,
  `JoinCrewScreen` → `JoinGuildScreen`.
- `EmptyGuildState.tsx` is a new 104-line component (vs `EmptyCrewState`
  128 lines) — it now relies on the shared HUD button style
  (`borderColor: 'rgba(58,102,255,0.45)'` at `:79`, ghost border
  hairline `'rgba(255,255,255,0.08)'` at `:92`).
- `MainNavigator.tsx` updated by 18 lines — only renaming references
  (no new visual styling).
- New files introduced (non-trivial visual content) under
  `apps/mobile/src/features/missions/`:
  - `components/DailyActivityCard.tsx` (191 lines)
  - `components/MissionHistoryPanel.tsx` (102 lines)
  - `components/MissionLogCard.tsx` (183 lines)
  - `components/StatGrowthPanel.tsx` (189 lines)
  - `sheets/ActivityLogSheet.tsx` (244 lines)
- New `apps/mobile/src/features/settings/components/`:
  - `AchievementsRow.tsx` (145 lines)
  - `RecordsPanel.tsx` (87 lines)
  - `StatDetailSheet.tsx` (293 lines)
- `MissionsTab.tsx` rewritten (449 lines changed) — pulls layout into
  the new panel components.
- `SystemStatsCard.tsx` shrank by 230 lines (366 → ~136 effective) —
  most of the bespoke styling moved into shared panels and tokens.
- SQL migration `supabase/migrations/20260425224615_rename_crew_to_guild.sql`
  (317 lines) renames tables/columns/functions.
- `AsyncStorage` migration: `services/StorageMigrations.ts` (new, 46
  lines) handles `crew-*` → `guild-*` key migration.
- Analytics: `services/AnalyticsService.ts` (20 lines changed) renamed
  events.
- Notifications: `services/NotificationService.ts` (134 lines changed)
  renamed channels.

No new design tokens — all visual change is rename + extraction of
existing layout into reusable panel components.

### 10.4 `a568cfe` — "Refactor code structure for improved readability and maintainability"

41 files, +4063 / -3576. Onboarding-flow restructure:

- New onboarding screens created (replacing the old narrative flow):
  - `MorningRoutineQuizScreen.tsx` (189 lines)
  - `ScheduleSessionScreen.tsx` (257 lines)
  - `SituationQuizScreen.tsx` (156 lines)
  - `SystemAnalysisScreen.tsx` (151 lines)
  - `TriggersQuizScreen.tsx` (162 lines)
  - `WakeUpCallScreen.tsx` (503 lines)
  - `WhyNowQuizScreen.tsx` (139 lines)
- Onboarding screens deleted:
  - `Day90PreviewScreen.tsx` (-412 lines)
  - `LossAversionStatScreen.tsx` (-280 lines)
  - `ReclaimScreen.tsx` (-395 lines)
  - `TrialPreviewScreen.tsx` (-545 lines)
  - `VulnerableTimeScreen.tsx` (-202 lines)
- Major rewrites (heavy edits, screen layouts redone):
  - `AgeQuizScreen.tsx` (+275 / 'pre' deletions)
  - `BenefitReportScreen.tsx` (+166 / -)
  - `ControlLevelScreen.tsx` (+197)
  - `ControlQuizScreen.tsx` (+272)
  - `DailyTimeCommitmentScreen.tsx` (+517)
  - `DefinitionScreen.tsx` (+265)
  - `GoalQuizScreen.tsx` (+188)
  - `PhoneTimeQuizScreen.tsx` (+448)
  - `StatRevealScreen.tsx` (+405)
- New shared onboarding components:
  - `CountUpNumber.tsx` (75 lines)
  - `HUDSectionLabel.tsx` (50 lines) — see section 11.
  - `TerminalLine.tsx` (83 lines)
  - `TypingText.tsx` (63 lines)
- `AppGuideSheet.tsx` significantly expanded (+226 lines net — pages
  support, corner brackets, mono section label added).
- `typography.ts` gained 4 lines (the `mono` / `monoBold` JetBrains Mono
  entries — needed for terminal-style HUD lines).
- `App.tsx` gained 4 lines.
- `OnboardingProvider.tsx` reworked (+76 lines net), `state/types.ts`
  expanded (+53 lines).
- `OnboardingNavigator.tsx` rewired to register the new screens
  (+70 net).
- `types/navigation.ts` updated to add the new screen names.

Net effect: the "narrative" onboarding screens (ReclaimScreen,
VulnerableTimeScreen, Day90Preview, TrialPreview, LossAversionStat)
were retired in favor of quiz-driven screens (Triggers, WhyNow,
Situation, MorningRoutine, Schedule, SystemAnalysis) plus the
WakeUpCallScreen. JetBrains Mono fonts and the HUDSectionLabel /
TerminalLine / TypingText primitives are introduced to support the
terminal-feel HUD layout.

---

## 11. HUD components inventory

`find apps/mobile/src -name "HUD*.tsx"` returns four files.

### 11.1 `HUDPanel.tsx`
Path: `apps/mobile/src/features/home/components/HUDPanel.tsx` (146 lines).

`panel` style (`:110-120`):
- `backgroundColor: SystemTokens.panelBg` (`rgba(10,22,40,0.85)`)
- `borderWidth: 1`
- `borderColor: SystemTokens.panelBorder` (`rgba(58,102,255,0.12)`)
- `borderRadius: SystemTokens.panelRadius` (`4`)
- `paddingHorizontal: 14`, `paddingTop: 12`, `paddingBottom: 14`
- `overflow: 'hidden'`

`header` (`:121-123`): `marginBottom: 12`.
`headerRow` (`:124-129`): row, space-between, center; `marginBottom: 6`.
`headerLabel` (`:130-132`): spreads `SectionLabelStyle` (InterTight 800,
11px, `letterSpacing: 2.5`, color `glowAccent`).
`headerRight` (`:133-138`): same family as label, fontSize 11,
`letterSpacing: 1.2`, color `textMuted`.
`headerRule` (`:139-142`): `height: 1`, `width: '100%'`. Rendered as a
`LinearGradient` from `accentColor ?? bracketColor` to transparent,
left→right (`:93-101`).

Corner brackets: `<HUDCornerBrackets color={accentColor ??
bracketColor} />` wrapped in `Animated.View` with opacity bound to
`bracketOpacity` (`:77-79`). Animation: loop opacity 0.6 ↔ 0.4, 2000ms
each direction, `Easing.inOut(Easing.ease)`, `useNativeDriver: true`,
only when `idle` prop is true
(`apps/mobile/src/features/home/components/HUDPanel.tsx:45-67`).

Header text rendered as `// {headerLabel}`
(`apps/mobile/src/features/home/components/HUDPanel.tsx:84`).

### 11.2 `HUDCornerBrackets.tsx`
Path: `apps/mobile/src/features/home/components/HUDCornerBrackets.tsx` (108 lines).

Props (`:12-17`): `color = SystemTokens.bracketColor`, `size = 14`,
`thickness = 1.5`, `opacity = 1`.

Renders four absolutely-positioned `<Svg>` elements (one per corner).
Each draws path `M 0 size L 0 0 L size 0` (L-shape) and uses an SVG
`transform` (`scale(-1, 1)`, `scale(1, -1)`, `scale(-1, -1)`) to
flip into the other corners (`:25-89`).

`layer` (`:96-98`): `StyleSheet.absoluteFillObject`.
Corner positioning (`:102-105`): `top/left/right/bottom: -1` (so the
brackets sit a single pixel outside the panel edge).

No animation in this file. (Parent — usually `HUDPanel` — drives
opacity.)

### 11.3 `HUDOptionCard.tsx`
Path: `apps/mobile/src/features/onboarding/components/HUDOptionCard.tsx` (122 lines).

Visual logic (inline at `:45-54`):
- `borderColor` = `selected ? accentColor : 'rgba(255,255,255,0.06)'`
- `background` = `selected ? '${accentColor}24' : 'rgba(255,255,255,0.02)'`
  (i.e. selected = accent at hex alpha `24` ≈ 14% opacity)
- `glowStyle` (selected only): `textShadowColor: accentColor`,
  `textShadowRadius: 8`, `textShadowOffset: {0,0}`

`row` style (`:88-95`):
- `flexDirection: 'row'`, `alignItems: 'center'`
- `gap: 12`
- `paddingVertical: 14`, `paddingHorizontal: 14`
- `borderLeftWidth: 2`
- (No `borderRadius` — sharp corners.)

`rowDisabled` (`:96-98`): `opacity: 0.4`.
`leadingSlot` (`:99-103`): `width: 28`, centered.
`labelSlot` (`:104-107`): `flex: 1, minWidth: 0`.
`label` (`:108-113`): `FontFamily.bodyMedium`, `fontSize: 15`,
`letterSpacing: -0.1`, `lineHeight: 20`.
`body` (`:114-116`): `marginTop: 4`.
`trailing` (`:117-119`): `flexShrink: 0`.

`TouchableOpacity activeOpacity={0.85}` (`:65`).
Default `accentColor` is `SystemTokens.glowAccent` (`#3A66FF`)
(`apps/mobile/src/features/onboarding/components/HUDOptionCard.tsx:41`).
Component is `React.memo`-wrapped (`:122`).

### 11.4 `HUDSectionLabel.tsx`
Path: `apps/mobile/src/features/onboarding/components/HUDSectionLabel.tsx` (50 lines).

Renders `// {label}` text (using `SectionLabelStyle` with optional
color override) followed by a `LinearGradient` from `color` → transparent
(left → right) as a 1px tall rule
(`apps/mobile/src/features/onboarding/components/HUDSectionLabel.tsx:26-36`).

`wrap` (`:40-42`): `marginBottom: 14`.
`rule` (`:43-46`): `height: 1`, `width: '100%'`, `marginTop: 6`.

Default color = `SystemTokens.glowAccent`
(`apps/mobile/src/features/onboarding/components/HUDSectionLabel.tsx:25`).
Component is `React.memo`-wrapped (`:50`).

---

## Discoveries (extra source-of-truth notes not in the spec)

1. **JetBrains Mono is now part of the design system.** `FontFamily.mono`
   (`JetBrainsMono_400Regular`) and `FontFamily.monoBold`
   (`JetBrainsMono_700Bold`) are first-class entries in
   `apps/mobile/src/design/typography.ts:18-21`. Used by
   `AppGuideSheet.sectionLabel` and `pageIndicator`
   (`apps/mobile/src/design/components/AppGuideSheet.tsx:275, 281`).
2. **`SectionLabelStyle` is the canonical `// HEADER` style** —
   InterTight 800, 11px, `letterSpacing: 2.5`, color
   `SystemTokens.glowAccent`
   (`apps/mobile/src/features/home/systemTokens.ts:47-52`). Reused by
   `HUDPanel.headerLabel`
   (`apps/mobile/src/features/home/components/HUDPanel.tsx:130-132`),
   `HUDSectionLabel`
   (`apps/mobile/src/features/onboarding/components/HUDSectionLabel.tsx:28`),
   and `MainNavigator.dp.headerLabel`
   (`apps/mobile/src/navigation/MainNavigator.tsx`, post-`6210cbb`).
3. **Glow orbs use very large `borderRadius` (110, 70, 160).** They
   are circles, not "scanlines" or "grids" — see
   `apps/mobile/src/features/auth/screens/SignInScreen.tsx:349,358`,
   `SignUpScreen.tsx:343,352`, `GuildDetailScreen.tsx:426,435`. There
   is no scanline overlay anywhere in the source.
4. **`HUDOptionCard` uses inline 8-hex-digit alpha** — selected bg is
   computed as `\`${accentColor}24\``, which appends `24` (≈ 14%
   alpha) to a 6-digit hex
   (`apps/mobile/src/features/onboarding/components/HUDOptionCard.tsx:46`).
   In Swift this should be `UIColor(...).withAlphaComponent(0.14)`.
5. **`AppGuideSheet` tip icon wrappers also use inline alpha hex** —
   `${accent}1F` (≈ 12% alpha) for background, `${accent}55` (≈ 33%
   alpha) for border
   (`apps/mobile/src/design/components/AppGuideSheet.tsx:213-216`).
6. **Rank tier id/name mismatch.** `id: 'grinder'` displays as
   `'RECRUIT'`
   (`apps/mobile/src/design/rankTiers.ts:19`). Preserve both fields
   exactly when porting.
7. **`HUDPanel` has no shadow** — the only "elevation" cue is the
   blue corner brackets + blue-tinted panel border. The "shadow" you
   might expect for a glassmorphic card is absent. Confirmed by
   reading `apps/mobile/src/features/home/components/HUDPanel.tsx:110-120`.
8. **`OnboardingProgressBar` post-`2eb79ef` is a 2px track with a
   2px cyan glowing tip** (`shadowColor: SystemTokens.cyan`,
   `shadowOpacity: 0.9`, `shadowRadius: 4`)
   (`apps/mobile/src/features/onboarding/components/OnboardingProgressBar.tsx:130-141`).
9. **`StatBar` fill animation duration is 600ms with
   `Easing.out(Easing.cubic)`**
   (`apps/mobile/src/features/home/components/StatBar.tsx:52-59`),
   and the fill has a `tip` View at the leading edge whose
   `shadowColor` matches the stat color
   (`apps/mobile/src/features/home/components/StatBar.tsx:85-90`).
10. **Default `idle = true` on `HUDPanel`** — every panel renders the
    looping bracket-opacity pulse unless explicitly disabled
    (`apps/mobile/src/features/home/components/HUDPanel.tsx:39`).
11. **`Colors.disabled === Colors.surface === '#2C3440'`** — the same
    hex is exported under two names
    (`apps/mobile/src/design/colors.ts:14,32`). When porting use
    Swift constants that share a value.
