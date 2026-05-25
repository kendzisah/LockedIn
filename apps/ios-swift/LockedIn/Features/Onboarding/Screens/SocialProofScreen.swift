import SwiftUI
import DesignKit

/// SocialProofScreen — Step 25: animated stat cards + testimonials before
/// the paywall.
///
/// Port of `screens/SocialProofScreen.tsx`, polished to iOS native craftsmanship:
/// proper type hierarchy (hero / supporting / caption), restrained iconography,
/// tactile elevation, and a primary CTA that owns the action color.
struct SocialProofScreen: View {
    let onContinue: () -> Void
    @State private var tracker = OnboardingScreenTracker(.socialProof)
    @State private var screenOpacity: Double = 0
    @State private var contentOffset: CGFloat = 12
    @State private var isAdvancing = false

    var body: some View {
        ZStack {
            ScreenGradient()

            // Subtle ambient light from above — sells the "premium dark" feel
            // without competing with the stat cards.
            GlowOrb(preset: .blue, size: 320, blurRadius: 90)
                .opacity(0.5)
                .offset(x: 0, y: -300)

            VStack(spacing: 0) {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        header
                            .padding(.top, 8)

                        statsRow
                            .padding(.top, 28)

                        testimonialsList
                            .padding(.top, 20)

                        ratingRow
                            .padding(.top, 20)

                        Spacer(minLength: 24)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 16)
                }
                .scrollBounceBehavior(.basedOnSize)

                continueButton
                    .padding(.horizontal, 24)
                    .padding(.top, 8)
                    .padding(.bottom, 12)
            }
            .opacity(screenOpacity)
            .offset(y: contentOffset)
        }
        .onAppear {
            tracker.didAppear()
            withAnimation(.easeOut(duration: 0.5)) {
                screenOpacity = 1
                contentOffset = 0
            }
        }
        .onDisappear { tracker.didDisappear() }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(spacing: 10) {
            // Eyebrow tag — establishes hierarchy and lets the hero line
            // stay short and impactful instead of carrying the whole story.
            Text("PROOF")
                .font(.custom(FontFamily.display.rawValue, size: 9))
                .tracking(2.4)
                .foregroundColor(AppColors.accent)

            Text("Stopped talking.\nStarted executing.")
                .font(.custom(FontFamily.headingBold.rawValue, size: 28))
                .tracking(-0.5)
                .lineSpacing(4)
                .foregroundColor(AppColors.textPrimary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Text("Real numbers from people who locked in.")
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            ForEach(OnboardingData.socialStats) { card in
                statCard(value: card.value, lines: card.lines)
            }
        }
    }

    private func statCard(value: String, lines: [String]) -> some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.custom(FontFamily.headingBold.rawValue, size: 26))
                .tracking(-0.6)
                .foregroundColor(AppColors.textPrimary)

            VStack(spacing: 1) {
                ForEach(lines, id: \.self) { line in
                    Text(line)
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 9))
                        .tracking(1.4)
                        .foregroundColor(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.55))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
        )
    }

    private var testimonialsList: some View {
        VStack(spacing: 10) {
            ForEach(OnboardingData.testimonials) { t in
                testimonialCard(quote: t.quote, author: t.author)
            }
        }
    }

    private func testimonialCard(quote: String, author: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // Open-quote glyph — subtle visual hook that turns a generic card
            // into an obvious testimonial.
            Text("\u{201C}")
                .font(.custom(FontFamily.headingBold.rawValue, size: 32))
                .foregroundColor(AppColors.accent.opacity(0.55))
                .frame(height: 14, alignment: .top)
                .offset(y: -6)

            Text(quote)
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                .lineSpacing(5)
                .foregroundColor(AppColors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                Rectangle()
                    .fill(AppColors.textMuted.opacity(0.4))
                    .frame(width: 16, height: 1)
                Text(author)
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 12))
                    .tracking(0.2)
                    .foregroundColor(AppColors.textSecondary)
            }
            .padding(.top, 2)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.55))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
        )
    }

    private var ratingRow: some View {
        HStack(spacing: 6) {
            HStack(spacing: 2) {
                ForEach(0..<5, id: \.self) { _ in
                    Image(systemName: "star.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(AppColors.warning)
                }
            }
            Text("4.8 average")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 12))
                .tracking(0.3)
                .foregroundColor(AppColors.textPrimary)
            Text("·")
                .foregroundColor(AppColors.textMuted)
            Text("App Store")
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .foregroundColor(AppColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var continueButton: some View {
        Button(action: handleContinue) {
            Text("Continue")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 17))
                .tracking(0.1)
                .foregroundColor(AppColors.textPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(
                    LinearGradient(
                        colors: [AppColors.primary, AppColors.primary.opacity(0.88)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.white.opacity(0.10), lineWidth: 1)
                )
                .shadow(color: AppColors.primary.opacity(0.40), radius: 18, x: 0, y: 8)
                .shadow(color: .black.opacity(0.22), radius: 5, x: 0, y: 2)
        }
        .buttonStyle(PressOpacityButtonStyle())
        .shineSweep(cornerRadius: 16, cycle: 4.0, translation: 1.6, peakAlpha: 0.16)
    }

    private func handleContinue() {
        guard !isAdvancing else { return }
        isAdvancing = true
        HapticsService.shared.light()
        withAnimation(.easeOut(duration: 0.3)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { onContinue() }
    }
}
