//
//  FlameLottieView.swift
//  LockedIn — Worker W7 (Streak feature)
//
//  Reusable SwiftUI wrapper around `lottie-ios`'s flame animation. Takes a
//  streak count, resolves the per-tier color via `getStreakTierInfo`, and
//  applies the 10-keypath color filter (`Ebene 1` … `Ebene 10`) returned by
//  `getFlameColorFilters`.
//
//  Ported from the RN call site
//  `apps/mobile/src/features/home/SessionCompleteScreen.tsx:191` —
//  `LottieView source={fire.json} colorFilters={getFlameColorFilters(...)}`.
//
//  Cross-feature dep:
//   - W3 (Home) `StreakPanel.swift` uses this view to replace its
//     `FlamePlaceholder` SF Symbol stand-in.
//   - W11 (Session) `SessionCompleteScreen.swift` uses this view to replace
//     its placeholder flame `Image(systemName: "flame.fill")` in
//     `streakCelebrationView`.
//
//  Asset note: this view loads `flame.json` from
//  `LockedIn/Resources/Lottie/`. The binary is copied from the RN asset
//  `apps/mobile/assets/lottie/fire.json` during the Phase 0 / Phase 2
//  integration step. If the file is missing at runtime, the view falls
//  back to an SF Symbol placeholder so the UI never crashes — but the
//  Lottie keypath bindings ARE pre-wired and will activate the moment
//  `flame.json` is dropped in.
//

import SwiftUI
import DesignKit
import Lottie

/// SwiftUI view that renders the flame animation tinted to the streak tier.
///
/// Usage:
/// ```swift
/// FlameLottieView(streak: state.consecutiveStreak)
///     .frame(width: 120, height: 140)
/// ```
///
/// Alternative — bind colors directly (used by SessionCompleteScreen which
/// resolves color via `RankService.rankFromStreak`, not the streak tier):
/// ```swift
/// FlameLottieView(color: rankColor, colorLight: rankColorLight)
///     .frame(width: 120, height: 140)
/// ```
public struct FlameLottieView: View {
    /// Streak-tier-driven color resolution. When provided, the view computes
    /// `(color, colorLight)` via `getStreakTierInfo(streak:)`.
    private let streak: Int?

    /// Explicit color overrides. Used when the caller already resolved the
    /// color from a different system (e.g. rank tier).
    private let overrideColor: Color?
    private let overrideColorLight: Color?

    /// Loop mode for the flame animation. Defaults to `.loop`.
    private let loopMode: LottieLoopMode

    // MARK: - Initializers

    /// Initialize with a streak count — the view derives colors from
    /// `StreakTiers`.
    public init(streak: Int, loopMode: LottieLoopMode = .loop) {
        self.streak = streak
        self.overrideColor = nil
        self.overrideColorLight = nil
        self.loopMode = loopMode
    }

    /// Initialize with explicit colors — used by `SessionCompleteScreen` which
    /// resolves color via `RankService.rankFromStreak` rather than the streak
    /// tier helper.
    public init(color: Color, colorLight: Color, loopMode: LottieLoopMode = .loop) {
        self.streak = nil
        self.overrideColor = color
        self.overrideColorLight = colorLight
        self.loopMode = loopMode
    }

    // MARK: - Body

    public var body: some View {
        let (color, colorLight) = resolveColors()

        Group {
            if FlameLottieView.animationAvailable {
                LottieView { LottieAnimation.named("flame") }
                    .configure { animationView in
                        applyColorFilters(to: animationView, color: color, colorLight: colorLight)
                    }
                    .playing(loopMode: loopMode)
            } else {
                FlameSymbolFallback(color: color, colorLight: colorLight)
            }
        }
    }

    // MARK: - Color resolution

    private func resolveColors() -> (Color, Color) {
        if let overrideColor, let overrideColorLight {
            return (overrideColor, overrideColorLight)
        }
        let info = getStreakTierInfo(streak: streak ?? 0)
        return (info.color, info.colorLight)
    }

    // MARK: - Lottie value providers

    /// Bind each of the 10 `Ebene N/VG_Flame_Def Konturen` layers to the tier
    /// color (odd layers) or light tint (even layers). Keypaths must match
    /// the layer names baked into `flame.json`.
    ///
    /// The DesignKit helper `getFlameColorFilters` returns RN-style keypath
    /// strings using `/` as the layer/group separator — that's the format
    /// `lottie-react-native` accepts (matching the RN call site at
    /// `apps/mobile/src/features/home/SessionCompleteScreen.tsx:191`).
    /// Native `lottie-ios`'s `AnimationKeypath` uses `.` as its separator,
    /// so we translate here. The final native keypath becomes
    /// e.g. `"Ebene 1.VG_Flame_Def Konturen.**.Color"`.
    private func applyColorFilters(
        to animationView: LottieAnimationView,
        color: Color,
        colorLight: Color
    ) {
        for entry in getFlameColorFilters(color: color, colorLight: colorLight) {
            let uic = UIColor(entry.color)
            let provider = ColorValueProvider(uic.lottieColorValue)
            let nativePath = entry.keypath.replacingOccurrences(of: "/", with: ".")
            let keypath = AnimationKeypath(keypath: "\(nativePath).**.Color")
            animationView.setValueProvider(provider, keypath: keypath)
        }
    }

    // MARK: - Asset gate

    /// True when `flame.json` exists in the main bundle. Kept as a static so
    /// the lookup happens once per process — Bundle scans are cheap but not
    /// free.
    private static let animationAvailable: Bool = {
        Bundle.main.url(forResource: "flame", withExtension: "json") != nil
    }()
}

// MARK: - Fallback placeholder

/// Static SF Symbol stand-in for the flame Lottie when `flame.json` isn't
/// bundled. Keeps the UI shippable while the asset is pending.
private struct FlameSymbolFallback: View {
    let color: Color
    let colorLight: Color

    var body: some View {
        Image(systemName: "flame.fill")
            .resizable()
            .scaledToFit()
            .foregroundStyle(
                LinearGradient(
                    colors: [colorLight, color],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .shadow(color: color.opacity(0.6), radius: 16)
    }
}
