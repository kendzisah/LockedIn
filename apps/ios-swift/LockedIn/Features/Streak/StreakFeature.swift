//
//  StreakFeature.swift
//  LockedIn — Worker W7 (Streak feature)
//
//  Public surface of the Streak feature. The feature has NO independent
//  observable state — `consecutiveStreak`, `streakBreak`, and related fields
//  live on W3's `HomeState` (mirroring the RN `SessionProvider` which owns
//  streak data). What lives here:
//
//   - `FlameLottieView`       — reusable Lottie wrapper applying per-tier
//                               color filters. Consumed by W3 (`StreakPanel`)
//                               and W11 (`SessionCompleteScreen`).
//   - `StreakRecoveryService` — budget/state for the "save my streak" feature.
//   - `StreakRecoveryModal`   — modal UI for the recovery flow.
//
//  Color resolution helpers live in DesignKit
//  (`StreakTiers.swift` — `getStreakTierInfo`, `getFlameColorFilters`).
//
//  Cross-feature integration TODOs (for the coordinator merge):
//
//   1. `Features/Home/Components/StreakPanel.swift` — replace the
//      `FlamePlaceholder` view with `FlameLottieView(streak: streak)`.
//
//   2. `Features/Session/Screens/SessionCompleteScreen.swift` — in
//      `streakCelebrationView` replace the `Image(systemName: "flame.fill")`
//      placeholder with:
//          FlameLottieView(
//              color: rankColor,
//              colorLight: Color(hex: lightenHex(rankColor.hex, 0.35))
//          )
//          .frame(width: 96, height: 96)
//      Note: SessionCompleteScreen resolves color via `RankService`, not
//      `StreakTiers` — that's why `FlameLottieView` exposes a
//      `(color, colorLight)` init alongside the `(streak:)` init.
//
//   3. `Features/Home/Screens/HomeTabScreen.swift` — when
//      `HomeState.streakAtRisk(todayKey:dailyGoal:)` is true and
//      `StreakRecoveryService.canRecover()` is true, present the
//      `StreakRecoveryModal` (matches RN `HomeTab.tsx:280`). On the user
//      pressing "Save My Streak", route to a 15-min ExecutionBlock (W11
//      owns the routing); on session completion call
//      `StreakRecoveryService.useRecovery(currentStreak:)` and keep the
//      streak at its prior value if `recovered` is true.
//

import Foundation

public enum StreakFeature {
    /// Reserved namespace for future feature-wide constants. Keep empty for
    /// now — `StreakRecoveryService` already owns its own constants.
}
