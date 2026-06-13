import SwiftUI
import DesignKit

/// OnboardingProgressBar — Persistent header above the onboarding stack.
///
/// Reads the active route from a binding so the fill can tween between
/// steps (rather than snap on each screen mount). Hides for intro /
/// immersive / paywall routes per `OnboardingRoute.hidesProgressBar`.
///
/// Port of `apps/mobile/src/features/onboarding/components/OnboardingProgressBar.tsx`.
struct OnboardingProgressBar: View {
    let route: OnboardingRoute?

    private var hidden: Bool {
        guard let route else { return true }
        return route.hidesProgressBar
    }

    private var step: Int { route?.step ?? 0 }

    private var targetProgress: Double {
        hidden ? 0 : Double(step) / Double(onboardingTotalSteps)
    }

    private static let barHeight: CGFloat = 2
    private static let labelHeight: CGFloat = 14
    private static let visibleHeight: CGFloat = 8 + labelHeight + 4 + barHeight + 1

    var body: some View {
        VStack(spacing: 0) {
            if !hidden {
                content
                    .frame(height: Self.visibleHeight)
                    .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity)
        .background(AppColors.background)
        .animation(.easeInOut(duration: 0.25), value: hidden)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("// STEP \(String(format: "%02d", step)) / \(onboardingTotalSteps)")
                .font(.custom(FontFamily.display.rawValue, size: 8))
                .tracking(1.6)
                .foregroundColor(SystemTokens.textMuted)
                .frame(height: Self.labelHeight, alignment: .leading)

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(SystemTokens.barTrack)
                    HStack(spacing: 0) {
                        Rectangle()
                            .fill(SystemTokens.glowAccent)
                            .frame(width: max(0, proxy.size.width * targetProgress))
                            .overlay(alignment: .trailing) {
                                Rectangle()
                                    .fill(SystemTokens.cyan)
                                    .frame(width: 2)
                                    .shadow(color: SystemTokens.cyan.opacity(0.9), radius: 4, x: 0, y: 0)
                            }
                            .animation(.easeOut(duration: 0.45), value: targetProgress)
                        Spacer(minLength: 0)
                    }
                }
            }
            .frame(height: Self.barHeight)
        }
        .padding(.horizontal, 24)
        .padding(.top, 8)
        .padding(.bottom, 1)
    }
}
