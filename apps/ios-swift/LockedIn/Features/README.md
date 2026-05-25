# Features

Phase 1 implementation agents land their work here, one folder per feature:

```
Features/
├── Auth/          (W1)  — anonymous sign-in, email auth, Apple Sign-In, account linking
├── Onboarding/    (W2)  — 27 screens from OnboardingStackParamList
├── Home/          (W3)  — HomeTab, session engine, HUD panels
├── Missions/      (W4)  — 3-slot recommendation engine, MissionsTab
├── Leaderboard/   (W5)  — BoardTab, GuildDetail, CreateGuild, JoinGuild
├── Subscription/  (W6)  — RevenueCat integration, PaywallOffer, Paywall (onboarding)
├── Streak/        (W7)  — flame Lottie with per-tier color filters, streak tier UI
├── Settings/      (W8)  — ProfileTab, EditProfile
├── Report/        (W9)  — WeeklyReport
├── Trial/         (W10) — Trial feature
├── Gym/           (W10) — Gym feature
└── Session/       (W11) — keep-awake, Device Activity Monitor, focus mode UI
```

Conventions inside each feature folder mirror the RN layout:

```
Features/<Name>/
├── <Name>Service.swift          # Singleton service if needed
├── <Name>State.swift            # @Observable view model
├── Screens/                     # Top-level navigable views
├── Components/                  # Feature-specific subviews
└── Sheets/                      # Modals / bottom sheets
```

Rules (also in the master plan):
1. Reproduce screens 1:1 against the Agent C fidelity spec.
2. Use **only** `DesignKit` primitives — no inline color / typography literals.
3. Preserve every `@lockedin/*` AsyncStorage key by exact name. Lock-mode /
   session keys go in the App Group suite via `Defaults.appGroup`; everything
   else uses `Defaults.standard`.
4. Mirror the RN navigation routes and params from `apps/mobile/src/types/navigation.ts`.
5. Mirror PostHog event names and properties from `apps/mobile/src/services/AnalyticsService.ts`.
6. Use `LockedInSupabase.shared.client` for all backend calls. Table names,
   RPC names, and edge function names are frozen — see master plan §"Phase 1".
