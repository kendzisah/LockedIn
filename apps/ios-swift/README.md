# LockedIn — Native Swift App

This is the native Swift / SwiftUI rewrite of the LockedIn iOS client. It
replaces `apps/mobile` (Expo / React Native) under the same bundle ID
`com.flocktechnologies.lockedin`. The backend (Supabase) and admin
dashboard (`apps/admin`) are unchanged.

See the master migration plan at
`/Users/ken/.claude/plans/we-will-be-doing-recursive-twilight.md`.

## Prerequisites

- macOS 14+, Xcode 15+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`
- Apple Developer team `NGFWFKBJU2` membership

## Generate the Xcode project

The `.xcodeproj` is **not** checked in. Regenerate it whenever `project.yml`
or the file structure changes:

```bash
cd apps/ios-swift
xcodegen generate
open LockedIn.xcodeproj
```

## Secrets

Build-time secrets live in `Config/Secrets.xcconfig` (gitignored). Copy
the example and fill in real values:

```bash
cp Config/Secrets.xcconfig.example Config/Secrets.xcconfig
# edit with your local keys — see the example file for the URL-escape rule
```

The keys mirror the RN app's `EXPO_PUBLIC_*` env vars (see the migration
plan §"Secrets / env carry-over checklist"). Their values are exposed to
Swift via the embedded `LockedInConfig` plist section and the
`LockedInConfig` type in `LockedIn/Services/LockedInConfig.swift`.

## Directory layout

```
apps/ios-swift/
├── project.yml                    # XcodeGen spec
├── Config/                        # xcconfig templates (Secrets gitignored)
├── Packages/
│   └── DesignKit/                 # Local SPM design system (Colors, Typography, etc.)
├── Shared/                        # Code shared between app + DAM extension
│   └── SharedScreenTimeConstants.swift
├── LockedIn/                      # Main app target
│   ├── LockedInApp.swift          # @main SwiftUI App
│   ├── AppDelegate.swift          # UIKit APNs/AppsFlyer hooks
│   ├── RootView.swift             # Phase 0 placeholder — Worker W2 fills in
│   ├── Info.plist
│   ├── LockedIn.entitlements
│   ├── LockedIn-Bridging-Header.h
│   ├── Services/                  # Singleton services (Supabase, Keychain, Defaults, Haptics, Config)
│   ├── ScreenTime/                # Native FamilyControls / DeviceActivity module
│   ├── Resources/                 # Fonts + Lottie (READMEs explain what to drop in)
│   ├── Features/                  # Phase 1 — empty, one folder per worker
│   └── Assets.xcassets/
└── DeviceActivityMonitorExtension/  # Family Controls DAM extension (iOS 16.0)
    ├── Info.plist
    ├── Extension.entitlements
    └── LockedInDeviceActivityMonitor.swift
```

## Phase 1 worker map

Each implementation agent works in `LockedIn/Features/<feature>/` in its
own git worktree:

| Worker | Folder                                  |
|--------|-----------------------------------------|
| W1     | `Features/Auth/`                        |
| W2     | `Features/Onboarding/`                  |
| W3     | `Features/Home/`                        |
| W4     | `Features/Missions/`                    |
| W5     | `Features/Leaderboard/`                 |
| W6     | `Features/Subscription/`                |
| W7     | `Features/Streak/`                      |
| W8     | `Features/Settings/`                    |
| W9     | `Features/Report/`                      |
| W10    | `Features/Trial/` + `Features/Gym/`     |
| W11    | `Features/Session/`                     |

Workers MUST use `DesignKit` primitives — no inline color or typography
literals. They MUST preserve every `@lockedin/*` UserDefaults key by exact
name and use the App Group suite for any key touched by the DAM extension
(see `LockedIn/Services/Defaults.swift`).

## Building from CLI

```bash
xcodebuild -scheme LockedIn -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath ./DerivedData \
  build
```

For TestFlight, prefer EAS / Xcode Cloud / a `fastlane` lane — to be set up
in Phase 2 by the coordinator.

## Notes & known gaps

- **Fonts and Lottie JSON files are not yet bundled.** Drop the actual `.ttf`
  and `.json` files into `LockedIn/Resources/Fonts/` and `LockedIn/Resources/Lottie/`
  before the first run. See the READMEs in those folders.
- **SKAdNetwork IDs are not yet populated** in `Info.plist`. Copy AppsFlyer's
  ~70 IDs byte-for-byte from the existing generated Info.plist before the
  first production build.
- **App icon and splash assets are not embedded.** Add 1024×1024 PNG to
  `AppIcon.appiconset/` and configure `LaunchScreen` (storyboard or asset)
  before submitting to TestFlight.
- **`apps/mobile` remains in place** as a reference + rollback during the
  cutover window. Do not edit it from this worktree.
