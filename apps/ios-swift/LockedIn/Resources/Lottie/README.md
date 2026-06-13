# Lottie animations

Copy the following Lottie JSON files into this directory **byte-for-byte**
from the RN app. They are loaded by `lottie-ios` via
`LottieAnimation.named(_:)`. The flame animation accepts per-tier color
filters via `getFlameColorFilters(color:lightColor:)` in `DesignKit`.

Required files:

- `flame.json` — from `apps/mobile/assets/lottie/fire.json` (rename on copy).
  Drives the streak UI in `StreakPanel` and the celebration in
  `SessionCompleteScreen`. The keypaths expected by `getFlameColorFilters`
  are `Ebene 1/VG_Flame_Def Konturen` through `Ebene 10/VG_Flame_Def Konturen`
  — confirm the animation exposes them before changing the keypath list.
- `lock_close.json` — from `apps/mobile/assets/lottie/lock_close.json`.
  Used by the LockIn tab raised center button.
- `bell-ring.json` — from `apps/mobile/assets/lottie/` (whichever bell-style
  animation the RN `NotificationPreFrameScreen` consumes). Used by the Swift
  `NotificationPreFrameScreen`.

After dropping files in, regenerate the project: `xcodegen generate`.

After dropping files in, regenerate the project: `xcodegen generate`.
