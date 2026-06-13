# LockedIn iOS (Swift) — Launch Gate Checklist

Items below are NOT solvable in code — they require human action with files,
credentials, or Apple Developer portal access. Every box must be ticked before
TestFlight upload.

## Assets to bundle (binary files; can't be generated)

- [ ] **Fonts** in `apps/ios-swift/LockedIn/Resources/Fonts/`:
  - `Inter-Regular.ttf`, `Inter-Medium.ttf`
  - `InterTight-SemiBold.ttf`, `InterTight-Bold.ttf`, `InterTight-ExtraBold.ttf`
  - `JetBrainsMono-Regular.ttf`, `JetBrainsMono-Bold.ttf`
  - Source: the same `@expo-google-fonts/*` packages used by the RN app, or
    download from Google Fonts. PostScript names must match
    `Packages/DesignKit/Sources/DesignKit/Typography.swift` `FontFamily` raw
    values exactly.
  - After dropping in: add each to the target's `UIAppFonts` Info.plist array.

- [ ] **Lottie animations** in `apps/ios-swift/LockedIn/Resources/Lottie/`:
  - `flame.json` — rename on copy from `apps/mobile/assets/lottie/fire.json`
  - `lock_close.json` — copy verbatim from `apps/mobile/assets/lottie/`
  - `bell-ring.json` — copy from `apps/mobile/assets/lottie/`
  - Until present: `FlameLottieView` falls back to an SF Symbol placeholder.

- [ ] **App Icon** at `LockedIn/Assets.xcassets/AppIcon.appiconset/`:
  - 1024×1024 PNG (App Store marketing icon, required by submission)
  - All iPhone/iPad scale variants
  - Source: existing `apps/mobile/assets/icon.png` (resize/export at correct
    dimensions)

- [ ] **Launch screen image / staircase background**:
  - `LockedIn/Assets.xcassets/staircase-bg.imageset/` — used by
    `PaywallOfferScreen` background; copy from `apps/mobile/assets/images/`

## Info.plist values to populate

- [ ] **SKAdNetworkItems** (currently `<array/>` in `Info.plist:69-70`):
  - Copy the ~70 AppsFlyer SKAdNetwork IDs byte-for-byte from the existing
    Expo build's generated Info.plist (or from
    https://support.appsflyer.com/hc/en-us/articles/360011228257). Do NOT
    invent IDs.

- [ ] **Camera / photo library usage**:
  - `NSPhotoLibraryUsageDescription` — required because
    `EditProfileScreen` uses `PhotosPicker`.
  - `NSCameraUsageDescription` — only if a "Take Photo" path is implemented;
    the W1 Auth port left this as a coordinator TODO. Default is library-only.

## Apple Developer portal (manual)

- [ ] Register the **App Group** `group.com.flocktechnologies.lockedin` against
  both bundle IDs (`com.flocktechnologies.lockedin` and
  `com.flocktechnologies.lockedin.DeviceActivityMonitor`).
- [ ] Add the **Family Controls** capability to both bundle IDs (DAM extension
  needs it).
- [ ] **Apple Sign-In** capability on the main bundle ID.
- [ ] **Associated Domains** — `applinks:locked-in.co` on the main bundle ID
  for the Supabase password-reset Universal Link.
- [ ] Configure `aps-environment` per scheme: `development` for Debug builds,
  `production` for Release. `LockedIn.entitlements` currently ships with
  `development`; either swap to `production` for App Store or use separate
  entitlement files per configuration (see `MIGRATION_FIDELITY_REAUDIT.md`
  punch item P1-#17).

## Universal Link hosting (verify before cutover)

- [ ] The file `https://locked-in.co/.well-known/apple-app-site-association`
  must be published with the correct app id (Team `NGFWFKBJU2` + bundle
  `com.flocktechnologies.lockedin`). Validate with
  `https://branch.io/resources/aasa-validator/`.

## Secrets (NEVER commit)

- [ ] Create `apps/ios-swift/Config/Secrets.xcconfig` (gitignored). Populate
  every key declared in `Debug.xcconfig` / `Release.xcconfig`:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PASSWORD_RESET_REDIRECT`
  - `REVENUECAT_IOS_API_KEY`, `APPSFLYER_DEV_KEY`, `APPSFLYER_APP_ID`
  - `IOS_APP_STORE_URL`, `PRIVACY_URL`, `TERMS_URL`
  - `MIXPANEL_PROJECT_TOKEN` (carryover value:
    `a263cb62e1d56ef186da48661697b6a4`)
- [ ] Verify Supabase Auth → URL Configuration → Redirect URLs allow-lists the
  password-reset URL exactly as set in `SUPABASE_PASSWORD_RESET_REDIRECT`.

## Project generation

- [ ] `xcodegen generate` runs cleanly. XcodeGen ≥ 2.39 required.
- [ ] `xcodebuild -scheme LockedIn -configuration Debug build` succeeds.

## Backend verifications (pre-TestFlight)

- [ ] Run `mcp__claude_ai_Supabase__list_tables` against project
  `dfwnylvggzlfovzkmgik` and confirm the `leaderboard` table/view exists with
  the columns `LeaderboardService.swift` queries (`user_id, score, grade,
  tier, updated_at`). See `MIGRATION_BACKEND_INVENTORY.md` "open items" §1.

## Smoke-test checklist (post-build)

Verification steps 1–13 from the migration plan:

- [ ] Build & launch on iPhone simulator and physical iPad
- [ ] Auth: anonymous + email + Apple Sign-In + account linking
- [ ] Onboarding: all 27 screens render in order; persists across kill
- [ ] Session: DurationPickerSheet, lock-in mode, idle timer disabled, DAM
  blocks selected apps, SessionComplete fires
- [ ] HUD fidelity: visual diff vs RN reference (Phase 3 audit findings
  resolved)
- [ ] Guild: CreateGuild → JoinGuild → GuildDetail; RLS functions correctly
- [ ] Subscription: RevenueCat sandbox purchase flips `isSubscribed`
- [ ] Analytics: every Mixpanel + AppsFlyer event from `MIGRATION_BACKEND_INVENTORY.md`
  section 10 fires with matching name + properties
- [ ] Notifications: permission prompt, daily reminder, streak milestone
- [ ] ATT prompt with the carryover copy
- [ ] Deep links: `lockedin://` cold-start, Universal Link password reset,
  Apple Sign-In return
- [ ] SKAdNetwork: all ~70 IDs present in Info.plist post-build
- [ ] Agent D returns an empty punch-list on **two consecutive** passes
