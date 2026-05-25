import SwiftUI
import DesignKit

/// StreakPanel — Dedicated panel surfacing the current streak count, tier
/// label, and the flame Lottie animation tinted with the per-tier color
/// filter from `DesignKit.getFlameColorFilters`.
///
/// **Asset note:** the flame Lottie file isn't bundled in the Swift project
/// yet — the binary will be copied from
/// `apps/mobile/assets/lottie/fire.json` to
/// `apps/ios-swift/LockedIn/Resources/Lottie/flame.json` during the Phase 2
/// integration step. Until then, the panel renders the numeric block + tier
/// label only; the Lottie view is a placeholder gated behind a `TODO`.
///
/// This is the Home-tab surface only — `SystemStatusBar` already surfaces a
/// compact streak readout. This dedicated panel is reserved for the
/// celebration screens (`SessionComplete` / `StreakBreakOverlay`) which
/// belong to W11 (Session) and W7 (Streak); both will import this view from
/// `Features/Home/Components/`.
struct StreakPanel: View {
    let streak: Int

    init(streak: Int) {
        self.streak = streak
    }

    var body: some View {
        let info = getStreakTierInfo(streak: streak)
        let label = info.current?.label ?? "BUILDING"

        HUDPanel(
            headerLabel: "STREAK",
            headerRight: label.uppercased(),
            accentColor: info.color
        ) {
            VStack(spacing: 14) {
                // W7's `FlameLottieView` applies the per-tier color filters
                // to the `flame.json` Lottie. If the asset is missing from
                // the bundle the view automatically falls back to an SF
                // Symbol stand-in (see `FlameLottieView.animationAvailable`).
                FlameLottieView(streak: streak)
                    .frame(width: 120, height: 140)

                VStack(spacing: 4) {
                    Text("\(streak)")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 56))
                        .tracking(-1.5)
                        .foregroundColor(info.color)
                        .shadow(color: info.color.opacity(0.6), radius: 12)
                    Text(streak == 1 ? "DAY" : "DAYS")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                        .tracking(1.6)
                        .foregroundColor(SystemTokens.textMuted)
                }

                if let next = info.next {
                    let remaining = max(0, next.threshold - streak)
                    HStack(spacing: 0) {
                        Text("NEXT TIER · ")
                            .font(.custom(FontFamily.body.rawValue, size: 10))
                            .tracking(0.6)
                            .foregroundColor(SystemTokens.textMuted)
                        Text(next.label.uppercased())
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 10))
                            .tracking(0.6)
                            .foregroundColor(next.color)
                        Text(" · \(remaining)D")
                            .font(.custom(FontFamily.body.rawValue, size: 10))
                            .tracking(0.6)
                            .foregroundColor(SystemTokens.textMuted)
                    }
                } else {
                    Text("MAX TIER REACHED")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                        .tracking(1.4)
                        .foregroundColor(SystemTokens.gold)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
    }
}

/// Static SF Symbol stand-in for the flame Lottie. Replaced by a real
/// `LottieView` once the `flame.json` asset is bundled (see `StreakPanel`).
private struct FlamePlaceholder: View {
    let color: Color
    let colorLight: Color

    var body: some View {
        ZStack {
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
}
