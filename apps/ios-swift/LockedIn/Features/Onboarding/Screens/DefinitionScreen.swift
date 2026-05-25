import SwiftUI
import DesignKit

/// DefinitionScreen — Step 1: "System Boot".
///
/// Typed `> SYSTEM INITIALIZING`, staggered fade-in lines, `> INITIALIZE
/// SYSTEM` CTA. Sign-in escape hatch top-right for existing users.
///
/// Port of `apps/mobile/src/features/onboarding/screens/DefinitionScreen.tsx`.
struct DefinitionScreen: View {
    let onContinue: () -> Void
    let onSignIn: () -> Void

    @State private var tracker = OnboardingScreenTracker(.definition)

    @State private var screenOpacity: Double = 1
    @State private var buttonOpacity: Double = 0
    @State private var bootDone = false
    @State private var isAdvancing = false

    /// Timing cascade. Each line types when the previous one finishes plus a
    /// short pause; the third line ("you're different") gets a longer dramatic
    /// beat before it lands. Tuned for ~5–6s total time-to-CTA.
    private static let l1Start: Double = 1.4   // boot ~1.3s + 0.1 beat
    private static let l2Start: Double = 3.1   // l1 ~0.9s + 0.8 pause
    private static let l3Start: Double = 4.8   // l2 ~0.7s + 1.0 dramatic pause
    private static let bodyCharDelay: Double = 0.032

    var body: some View {
        ZStack {
            ScreenGradient()

            ZStack(alignment: .topTrailing) {
                VStack(alignment: .leading, spacing: 0) {
                    Spacer()

                    TypingText("> SYSTEM INITIALIZING...", charDelay: 0.04, startDelay: 0.3) {
                        guard !bootDone else { return }
                        bootDone = true
                    }
                    .font(.custom(FontFamily.display.rawValue, size: 11))
                    .tracking(1.6)
                    .foregroundColor(SystemTokens.glowAccent)
                    .padding(.bottom, 36)

                    // Setup lines — Michroma typed in character-by-character
                    // via `reserveSpace: true` so the layout reserves the
                    // final bounding box from frame 1 and surrounding content
                    // doesn't jitter as glyphs land.
                    TypingText(
                        "Most people know\nwhat to do.",
                        charDelay: Self.bodyCharDelay,
                        startDelay: Self.l1Start,
                        reserveSpace: true
                    )
                        .font(.custom(FontFamily.display.rawValue, size: 14))
                        .tracking(0.2)
                        .lineSpacing(8)
                        .foregroundColor(AppColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.bottom, 6)

                    TypingText(
                        "They just\ndon't do it.",
                        charDelay: Self.bodyCharDelay,
                        startDelay: Self.l2Start,
                        reserveSpace: true
                    )
                        .font(.custom(FontFamily.display.rawValue, size: 14))
                        .tracking(0.2)
                        .lineSpacing(8)
                        .foregroundColor(AppColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.bottom, 6)

                    // Hero / turn line — slightly bigger, cyan-glow, also
                    // Michroma so the chrome reads as one voice. The
                    // `onComplete` here fades the CTA in.
                    TypingText(
                        "You're here because\nyou're different.",
                        charDelay: Self.bodyCharDelay,
                        startDelay: Self.l3Start,
                        reserveSpace: true
                    ) {
                        withAnimation(.easeOut(duration: 0.5)) {
                            buttonOpacity = 1
                        }
                    }
                        .font(.custom(FontFamily.display.rawValue, size: 15))
                        .tracking(0.4)
                        .lineSpacing(8)
                        .foregroundColor(SystemTokens.cyan)
                        .shadow(color: SystemTokens.cyan, radius: 12)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 26)

                    PrimaryButton("> INITIALIZE SYSTEM", action: handleStart)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 48)
                        .opacity(buttonOpacity)

                    Spacer()
                }
                .padding(.horizontal, 32)
                .opacity(screenOpacity)

                // Sign-in escape hatch, top-right.
                Button(action: handleSignIn) {
                    Text("Sign in")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 13))
                        .tracking(0.2)
                        .foregroundColor(AppColors.accent)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color.white.opacity(0.04))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.white.opacity(0.08), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
            }
        }
        .onAppear { tracker.didAppear() }
        .onDisappear { tracker.didDisappear() }
    }

    private func handleStart() {
        guard !isAdvancing else { return }
        isAdvancing = true
        HapticsService.shared.heavy()
        withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
    }

    private func handleSignIn() {
        HapticsService.shared.selectionChanged()
        onSignIn()
    }
}
