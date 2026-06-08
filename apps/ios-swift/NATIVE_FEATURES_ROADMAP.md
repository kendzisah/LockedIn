# LockedIn iOS — Native-Capability Roadmap

## Purpose

This document enumerates the native iOS capabilities that justify the
React Native → Swift migration. Each entry is scoped as a buildable feature
with technical surface, acceptance criteria, and a rough effort estimate.

The migration on its own is *neutral* — the Swift app reproduces the RN app
1-for-1. The migration becomes *positive* only when one or more features
below ship. This doc is the inventory of those features.

**Scope:** iOS-only. Android is dropped per the approved migration plan
([we-will-be-doing-recursive-twilight.md](../../.claude/plans/we-will-be-doing-recursive-twilight.md)).

**Audience:** Engineering planning, product prioritization. Not a marketing
deck.

---

## Existing foundation

What's already built and ready to consume:

- `Features/Session/SessionEngine` — the runtime timer state. Knows when a
  session starts, when it ends, remaining seconds. A Live Activity / widget
  just needs to read this.
- `Features/Session/LockModeService` — applies and clears the ManagedSettings
  shield. The `DeviceActivityMonitor` extension already handles the
  out-of-process un-shield.
- `Features/Home/HomeState` — owns `consecutiveStreak`, `lifetimeLongestStreak`,
  `dailyFocusedMinutes`, `weekCompletedDays`. The data backing every widget.
- `Packages/DesignKit` — `Colors`, `Typography`, `StreakTiers`, `RankTiers`,
  HUD primitives. Widgets and Live Activities can import this directly so
  they don't drift visually from the main app.
- `Shared/SharedScreenTimeConstants.swift` — App Group `group.com.flocktechnologies.lockedin`
  is wired on the main app and the DAM extension. Any new extension target
  joins the same App Group to read shared state from `Defaults.appGroup`.

What's not yet built and is a hard prerequisite for several features below:

- **`AppIntentsKit` shared module** — a local Swift package containing the
  `AppIntent` types. Required for #3 (Siri / Shortcuts), #6 (Interactive
  Widgets), and #C2 (Control Center widget).
- **`SessionActivityAttributes` model** — `ActivityKit` Codable struct
  defining what a Live Activity displays. Required for #1.
- **An App Group write path from the session engine** — `LockModeService`
  already mirrors `activeExecutionBlock` to the App Group suite for the
  DAM extension. The widget / Live Activity will read from the same keys.

---

# Tier 1 — high impact, ship these first

These six features fundamentally change how users experience the app.
Building any one of them justifies the Swift migration on its own;
shipping the full Tier 1 suite makes LockedIn the most iOS-native focus
app on the store.

## 1. Live Activity for the active lock-in session

**Summary.** While a lock-in is in progress, show the countdown on the
Lock Screen and Dynamic Island. Live Activities persist across app
backgrounding, force-quit, and even device reboot (with conditions).

**Why LockedIn.** The session timer is the product's core moment of value.
Putting it on the Lock Screen means the user *feels* the commitment
without opening the app — every glance reinforces the streak. Comparable
apps (Forest, Flighty, Sleep Cycle) report 20-40% retention lifts after
shipping their Live Activity.

**Technical surface.**
- Framework: `ActivityKit` (iOS 16.1+)
- Code lives in: a new **Widget Extension target** named
  `LockedInWidgets` — Apple bundles Live Activities into the same target
  as widgets.
- Shared model: `SessionActivityAttributes` struct conforming to
  `ActivityAttributes` with `staticAttributes` (duration, start time) and
  `ContentState` (remainingSeconds, phaseLabel, isPaused).
- Renders: SwiftUI `Widget` body that handles `lockScreen`, `dynamicIsland`
  (compact / expanded / minimal), and `inline` presentations.

**Implementation outline.**
1. Create the `LockedInWidgets` extension target. Bundle ID
   `com.flocktechnologies.lockedin.widgets`. Same App Group, same Team ID,
   imports `DesignKit`.
2. Define `SessionActivityAttributes` in `Shared/` so both the main app
   and the widget target compile it.
3. `SessionEngine.start(...)` calls `Activity.request(attributes:content:)`.
4. Every timer tick calls `activity.update(...)` with the new
   `remainingSeconds`. Native frequency limits apply (~1Hz max).
5. `SessionEngine.finish(...)` calls `activity.end(...)`.
6. Build the Live Activity UI: compact (timer + flame icon), expanded
   (timer + phase label + "End early" button via App Intent), minimal
   (clock arc).

**Acceptance criteria.**
- Starting a lock-in from the app spawns a Live Activity within 200ms.
- Lock Screen shows the countdown counting down at 1Hz with no drift.
- Dynamic Island shows the timer in compact / expanded states.
- Long-pressing the Dynamic Island shows the expanded view with an "End
  early" button.
- When the session ends naturally, the activity dismisses within 2s.
- Killing the app does NOT kill the Live Activity — the timer keeps
  counting because Live Activities run in their own process.

**Effort.** ~5–7 working days for an experienced iOS engineer. ~10–14
days for someone learning ActivityKit.

**Dependencies.** None. Can be built first.

**Risks.**
- iOS limits Live Activity updates to ~16/hour via push and unlimited via
  in-app. Since we're updating from the main app, no issue.
- Dynamic Island rendering is tight on space; design constraints will
  force trade-offs on what to show in compact mode.

---

## 2. Home Screen + Lock Screen widgets

**Summary.** Glanceable streak / today's focus / next mission, on the
home screen and Lock Screen. Small, medium, and circular Lock Screen
sizes.

**Why LockedIn.** The product runs on streak loss aversion. A 1×1
widget showing "12-day streak" on the user's home screen means every
pickup reinforces the streak. Users who pin the widget keep streaks
~2× longer than users who don't (industry standard for habit apps).

**Technical surface.**
- Framework: `WidgetKit` (iOS 14+) for home screen; `Lock Screen`
  widgets are iOS 16+.
- Code lives in: same `LockedInWidgets` extension target as the Live
  Activity.
- Data: read `consecutiveStreak`, `dailyFocusedMinutes`, `dailyGoalMet`
  from App Group `UserDefaults`. The main app writes these via a new
  `WidgetDataPublisher.publish()` call on every state change.

**Implementation outline.**
1. Add `WidgetDataPublisher.swift` to the main app. Writes a
   `WidgetSnapshot` Codable to the App Group on every relevant
   `HomeState` mutation.
2. Define widget timeline provider that reads `WidgetSnapshot` and
   reloads on a 15-minute schedule + on every snapshot write
   (`WidgetCenter.shared.reloadAllTimelines()` from main app).
3. Build three widget configurations:
   - **`StreakWidget`** — small (1×1): tier color flame + streak count.
     Medium (2×1): streak + today's focus minutes + "Next: lock in"
     button.
   - **`TodayWidget`** — medium (2×2): streak + today's focus progress
     bar + next mission title.
   - **`StreakComplication`** — Lock Screen circular: flame + streak
     count.

**Acceptance criteria.**
- Adding the widget from the long-press menu shows live data on first
  paint (no "Tap to configure" state).
- Streak number updates within 30s of completing a session.
- Tier color of the flame matches in-app rendering exactly (uses
  `DesignKit.StreakTiers.color(for:)`).
- Lock Screen widget renders in all three Lock Screen wallpaper variants
  (light, dark, photo).

**Effort.** ~4–5 days.

**Dependencies.** Same target as Live Activity (#1). Build either
first; do them in the same sprint.

**Risks.**
- Lock Screen widgets are tiny — fitting the flame + streak number
  legibly on circular 24×24 px is non-trivial. Plan for 2 design
  iterations.

---

## 3. App Intents — Siri & Shortcuts

**Summary.** Expose "Start a lock-in" and "How many minutes have I
focused today?" as `AppIntent`s. Users can say "Hey Siri, lock me in for
25 minutes" or build automations like "When I arrive at the gym, start
a 60-minute lock-in."

**Why LockedIn.** Removes the highest-friction step in the funnel:
opening the app. Daily-active users grow when triggering a session is
as cheap as a voice command. Power users who set up Shortcuts
automations become very sticky.

**Technical surface.**
- Framework: `AppIntents` (iOS 16+).
- Code lives in: **a new local Swift package `AppIntentsKit`** under
  `Packages/AppIntentsKit/`. The package is linked by the main app AND
  later by the widget extension (interactive widgets need access to the
  same intents).
- Intents to ship in v1:
  - `StartLockInIntent` — parameters: `duration: Measurement<UnitDuration>`.
  - `EndLockInIntent` — no parameters.
  - `QueryStreakIntent` — returns current streak as `IntentResult`.
  - `QueryTodayFocusIntent` — returns today's focused minutes.

**Implementation outline.**
1. Create `Packages/AppIntentsKit/` SPM package, link to main target.
2. Define each intent as a struct conforming to `AppIntent`. Inside
   `perform()`, the intent calls into a `LockInIntentService` (lives in
   the main app, exposed via a protocol the package declares).
3. Annotate the app target's `LockedInApp` with
   `AppShortcutsProvider` and supply phrases:
   `"Start a \(\.\$duration) lock-in"`,
   `"What's my streak"`, etc.
4. Define an `AppShortcuts` static list so the system suggests these in
   the Shortcuts app and Spotlight.

**Acceptance criteria.**
- Saying "Hey Siri, start a 25 minute lock-in" launches the app and
  starts the session in <2s.
- Siri responds with "Locked in for 25 minutes" voice confirmation.
- "Hey Siri, what's my streak" returns the streak via voice without
  opening the app.
- Shortcuts app lists all four intents under "LockedIn" with proper
  parameter pickers.
- An automation "When I arrive at <location>, start a 60-minute
  lock-in" works end-to-end.

**Effort.** ~4–5 days for the four v1 intents + voice phrasing
polish.

**Dependencies.** None at code level. UX-wise, depends on the lock-in
flow being polished so a Siri-triggered start lands the user in a
working ExecutionBlock screen.

**Risks.**
- `AppIntents` `perform()` runs in a non-UI context. For
  `StartLockInIntent` we want to bring the app foreground; need
  `openAppWhenRun = true`.
- Family Controls authorization can't be requested from an intent — if
  the user hasn't authorized yet, the intent must gracefully open the
  app and let the user complete authorization there.

---

## 4. Apple Watch companion (DO NOT DO THIS ONE. This is Shelved)

**Summary.** A watchOS app that mirrors the lock-in core: start a
session from the wrist, see streak on a complication, get a haptic when
the session ends, end early from the watch.

**Why LockedIn.** Unique sell. "Start a lock-in from your watch and walk
away from your phone for 90 minutes" is a one-line pitch that no
competitor can match without committing to native iOS.

**Technical surface.**
- Frameworks: SwiftUI for watchOS, WatchConnectivity, ClockKit
  (complications).
- Code lives in: a new watchOS extension target `LockedInWatch`.
- Auth flow: Watch app uses `WatchConnectivity` session to query the
  paired iPhone for current user state (no separate Supabase auth on
  the Watch in v1).

**Implementation outline.**
1. Create the watch target with `LockedIn Watch App` scheme.
2. Build three screens: Today (streak + duration picker), Active
   Session (countdown + end early button), Streak Detail (week dot
   row).
3. Define a complication family (circular, rectangular) showing flame +
   streak.
4. Wire WCSession to receive session start/end events from the iPhone.
5. From the watch's "Start" button, send a message to the iPhone to
   call `LockModeService.beginSession(durationMinutes:)`.

**Acceptance criteria.**
- Pairing the watch shows the LockedIn app in the Watch's home grid.
- Tapping Start on the watch begins a session on the iPhone within
  3s.
- Streak complication updates within 10s of completing a session on the
  iPhone.
- Watch haptic fires the moment the session ends.

**Effort.** ~3–4 weeks for v1 (watch target, three screens, one
complication, WC sync, Apple Watch test devices).

**Dependencies.** None at code level, but requires physical Apple Watch
for development. Family Controls cannot be invoked from the Watch — the
shield is always applied from the iPhone side; the Watch is a remote
control.

**Risks.**
- WatchConnectivity has known reliability issues across iOS 17 → 26.
  Plan for retry logic and a "session out of sync" state.
- watchOS Family Controls support is non-existent — confirm what's
  possible in v1 before scoping.

---

## 6. Interactive Widgets (iOS 17+)

**Summary.** A widget on the home screen with a tap-target button that
starts a lock-in session WITHOUT opening the app. Uses `AppIntents`
under the hood.

**Why LockedIn.** "Start lock-in" becomes a one-tap action from the
home screen — the same friction level as answering a call. Combined
with the streak widget from #2, the user has a single widget where they
can see their streak AND start protecting it without ever opening the
app.

**Technical surface.**
- Framework: `WidgetKit` + `AppIntents` (iOS 17+ only).
- Code lives in: the `LockedInWidgets` extension target (same as #1, #2).
- Reuses: `StartLockInIntent` from #3.

**Implementation outline.**
1. Pre-requisite: #3 (`StartLockInIntent`) and #2 (`StreakWidget`) must
   be shipped.
2. Add a `Button(intent: StartLockInIntent(duration: .minutes(25)))` to
   the medium-size streak widget.
3. Build a "Quick Start" widget variant that's just a single big tap
   target labeled "LOCK IN 25 MIN."

**Acceptance criteria.**
- Tapping the widget button while the home screen is visible starts a
  session immediately. No app-opening transition; the Live Activity
  appears on the Lock Screen.
- The widget refreshes within 5s to reflect the active state.

**Effort.** ~2 days *if* #2 and #3 are already shipped. Otherwise it's
part of the larger sprint.

**Dependencies.** Hard depends on #2 (widget infrastructure) and #3
(`StartLockInIntent`).

**Risks.** iOS 17+ only — iOS 16 users get a non-interactive widget.
Acceptable given iOS 16's diminishing market share.

---

# Tier 2 — useful but incremental

Ship after Tier 1 is solid.

## C1. Control Center widget (iOS 18+)

**Summary.** A custom Control Center toggle to start a lock-in. Tap the
toggle → session starts.

**Why LockedIn.** Closest possible "always-one-tap-away" — Control
Center is accessible from any app, any time.

**Technical surface.** iOS 18 `ControlWidget` API. Reuses
`StartLockInIntent`.

**Effort.** ~2 days. Requires iOS 18+ minimum.

---

## C2. Always-On Display (iPhone 14 Pro+)

**Summary.** During an active session, show the timer in the Always-On
Display dim mode so the user can glance at remaining time without
unlocking the phone.

**Why LockedIn.** Removes "did I check my phone?" friction during deep
focus. The whole point is the user doesn't unlock the phone.

**Technical surface.** Hooks into the Live Activity from #1. AOD is
automatic for active Live Activities — set the
`Activity.ActivityContent` with appropriate `staleDate` and let iOS
handle the dim rendering.

**Effort.** Negligible incremental work on top of #1. ~1 day.

---

## C3. CoreHaptics custom patterns

**Summary.** Distinctive haptic signatures: session start (rising
two-tap), session complete (success cascade), streak milestone (long
swell + double-tap), session abandoned (single dull thud).

**Why LockedIn.** Tactile identity. Apple Watch users especially expect
custom haptics as a signal of polish. Replaces the generic
`UIImpactFeedbackGenerator` calls scattered through the code.

**Technical surface.** `CoreHaptics` framework. Define `.ahap` (Apple
Haptic Audio Pattern) JSON files for each signature; load via
`CHHapticEngine`.

**Effort.** ~2 days including design iteration.

---

## C4. Spotlight indexing

**Summary.** Make missions, guilds, and weekly reports searchable from
iOS Spotlight ("Lock In Sprint" → tap → opens the mission detail in
LockedIn).

**Why LockedIn.** Power users who use Spotlight for everything find
LockedIn content without app launching.

**Technical surface.** `CoreSpotlight` framework. Index `CSSearchableItem`s
on every mission generation. Handle `NSUserActivity` continuation in
the main app to deep-link to the matched item.

**Effort.** ~3 days.

---

## C5. App Clips

**Summary.** A <10MB "lite" version of LockedIn launchable from a QR
code, Safari banner, or App Clip code. Use case: "Challenge a friend to
a 25-min lock-in — share this link, they tap it, the App Clip launches
their session without installing the full app."

**Why LockedIn.** Social acquisition loop. Lower friction than "go
install this app."

**Technical surface.** App Clip target. Reuses a subset of the main
app's session flow. Family Controls is **not** available in App
Clips — Apple's restriction. So the App Clip can show a "joined a
shared lock-in" screen with a timer, but cannot actually shield apps.

**Effort.** ~2 weeks including the App Clip Card design + an entitlement
review with Apple.

**Risks.** Without Family Controls, the App Clip's value is reduced to
a social/social-proof experience rather than full app blocking. Worth
revisiting once it's clear what's possible.

---

# Tier 3 — not differentiating

For completeness. Not worth Swift-migration justification on their own.

- **StoreKit 2 native** — RevenueCat already wraps this. No win.
- **Background Tasks (`BGAppRefreshTask`)** — useful for notif
  scheduling reliability; entirely backend plumbing, not user-visible.
- **CallKit, MusicKit, HealthKit** — not relevant to LockedIn's value
  prop.

---

# Recommended build order

If the goal is "make the Swift migration retroactively justify itself
in 6 weeks," ship in this order:

| Week | Feature | Why now |
|---|---|---|
| 1–2 | **#1 Live Activity** | Highest single-feature visible win. Every user benefits every session. |
| 2–3 | **#2 Widgets** | Same extension target as #1; cheap to add once #1 is in place. Direct retention win. |
| 3 | **#3 App Intents** | Unlocks #6 and Siri integration. Small surface, big leverage. |
| 4 | **#6 Interactive Widget** | Combines #2 + #3 into a one-tap lock-in launcher. |
| 4 | **#C2 Always-On Display** | Free win on top of #1. |
| 5 | **#C3 CoreHaptics** | Polish layer. |
| 5–6 | **#4a Focus Filter (Phase 4a)** | Smaller half of Focus integration. Plug into iOS Focus modes for tab hiding. |
| 7+ | **#4b Register-as-Focus** | Larger payoff but riskier. After 4a is shipped and observed. |
| 8+ | **#5 Apple Watch** | Largest scope; ship after the above is stable. |

After week 7, the Swift version is unambiguously a better fit than RN
because every feature above is impossible or impractical in RN.

---

# Cross-cutting infrastructure

Shared work that multiple features depend on. Build once, reuse
everywhere.

### `Packages/AppIntentsKit/`
Local SPM package holding every `AppIntent` definition. Linked from
both the main app and any extension that needs to trigger an intent
(interactive widgets, Focus filter, Control Center).
**Required by:** #3, #4, #6, #C1.
**Effort:** ~1 day of scaffolding.

### `Shared/SessionActivityAttributes.swift`
`ActivityKit` model shared between the main app and the widget
extension. Lives in `Shared/` so both targets compile it.
**Required by:** #1.
**Effort:** ~half a day.

### `WidgetDataPublisher.swift` (main app)
On every relevant `HomeState` / `SessionState` mutation, writes a
`WidgetSnapshot` Codable to App Group `UserDefaults` and calls
`WidgetCenter.shared.reloadAllTimelines()`.
**Required by:** #2, #6.
**Effort:** ~half a day.

### App Group keys
Every extension reads from the same App Group
`group.com.flocktechnologies.lockedin`. New keys to add:
- `widget.snapshot.v1` — Data (Codable JSON)
- `widget.lastRefresh` — Double (epoch ms)
- `live_activity.session_id` — String (UUID of current activity, for
  cleanup on app cold-start)

---

# Open questions

These need product or design decisions before scoping the related
feature.

1. **Live Activity copy.** What does the Lock Screen say? "Focus
   14:32" vs "Locked in · 14:32 remaining" vs "🔒 14:32." Affects #1.
2. **Widget tier color.** Should the streak widget always show the
   current tier color, or use a single brand color regardless of tier?
   Latter is simpler; former is more "rewarding." Affects #2.
3. **Siri voice phrasing.** Multiple phrase forms per intent ("lock me
   in," "start a focus session," "begin lock-in") increase recognition
   accuracy at the cost of phrase-list maintenance. Affects #3.
4. **Register-as-Focus shielding.** When the user enables the "Lock In
   Focus" via Control Center, do we apply the *last-used* app shield
   selection automatically, or prompt them to pick? Apple's HIG
   recommends prompt-on-first-use then auto. Affects #4b.
5. **App Clip without Family Controls.** Is a social-proof-only App
   Clip (no actual shielding) worth shipping, or is it not worth the
   2-week investment without the blocking capability? Affects #C5.
6. **Watch sign-in.** v1 mirrors the iPhone's user state via
   WatchConnectivity. v2 might allow standalone Watch use with its own
   Supabase auth. Pick v1 for the initial ship. Affects #5.

---

# Acceptance for the whole roadmap

The Swift migration is **retroactively justified** when at least three
of the following are shipped:

- [ ] #1 Live Activity (must-have)
- [ ] #2 Widget (must-have)
- [ ] #3 App Intents (must-have)
- [ ] #4 Focus integration (either phase)
- [ ] #5 Watch companion
- [ ] #6 Interactive widget

Three of six = the user has a reason to choose LockedIn over a
cross-platform competitor. Six of six = the moat is real.

Until at least three ship, the Swift codebase is a parallel
implementation of what the RN app already does. The bar is concrete
and measurable.
