import SwiftUI
import DesignKit

/// BenefitTemplate — shared HUD layout for the five benefit screens (15-19).
///
/// Renders a panel-wrapped graphic with a `// LABEL` header, a themed
/// headline, body paragraph, optional callout, and a primary CTA. Matches
/// the panel-label redesign introduced in commit `2eb79ef`.
///
/// Port of `apps/mobile/src/features/onboarding/components/BenefitTemplate.tsx`.
struct BenefitTemplate<Graphic: View>: View {
    let panelLabel: String?
    let headline: String
    let headlineColor: Color
    /// Body copy. Renamed from `body` to avoid colliding with SwiftUI's
    /// `View.body` requirement on this same struct.
    let bodyText: String
    let callout: String?
    let calloutColor: Color
    let graphic: Graphic
    let onContinue: () -> Void

    @State private var screenOpacity: Double = 0
    @State private var graphicOpacity: Double = 0
    @State private var graphicOffset: CGFloat = 20
    @State private var textOpacity: Double = 0
    @State private var textOffset: CGFloat = 20
    @State private var isAdvancing: Bool = false

    init(
        panelLabel: String? = nil,
        headline: String,
        headlineColor: Color,
        body bodyText: String,
        callout: String? = nil,
        calloutColor: Color = SystemTokens.cyan,
        @ViewBuilder graphic: () -> Graphic,
        onContinue: @escaping () -> Void
    ) {
        self.panelLabel = panelLabel
        self.headline = headline
        self.headlineColor = headlineColor
        self.bodyText = bodyText
        self.callout = callout
        self.calloutColor = calloutColor
        self.graphic = graphic()
        self.onContinue = onContinue
    }

    var body: some View {
        ZStack {
            ScreenGradient()

            VStack(spacing: 0) {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        // Graphic panel
                        OnboardingHUDPanel(
                            headerLabel: panelLabel ?? "SYSTEM",
                            accentColor: headlineColor
                        ) {
                            HStack {
                                Spacer()
                                graphic
                                    .padding(.vertical, 8)
                                Spacer()
                            }
                        }
                        .opacity(graphicOpacity)
                        .offset(y: graphicOffset)

                        // Text block
                        VStack(spacing: 14) {
                            TypingText(
                                headline,
                                charDelay: 0.025,
                                startDelay: 0.45,
                                reserveSpace: true
                            )
                                .font(.custom(FontFamily.heading.rawValue, size: 26))
                                .tracking(-0.3)
                                .lineSpacing(4)
                                .foregroundColor(headlineColor)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)

                            Text(bodyText)
                                .font(.custom(FontFamily.body.rawValue, size: 15))
                                .lineSpacing(7)
                                .foregroundColor(AppColors.textPrimary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 8)

                            if let callout {
                                Text(callout)
                                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                                    .tracking(0.4)
                                    .foregroundColor(calloutColor)
                                    .multilineTextAlignment(.center)
                            }
                        }
                        .padding(.top, 22)
                        .padding(.bottom, 12)
                        .opacity(textOpacity)
                        .offset(y: textOffset)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 24)
                    .padding(.bottom, 32)
                }

                // Footer with opaque background so body text doesn't ghost
                // through the translucent button.
                VStack {
                    PrimaryButton("CONTINUE", action: handleContinue)
                        .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .padding(.bottom, 8)
                .background(AppColors.background)
            }
            .opacity(screenOpacity)
        }
        .onAppear { appear() }
    }

    private func appear() {
        withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 1 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            withAnimation(.easeOut(duration: 0.6)) {
                graphicOpacity = 1
                graphicOffset = 0
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            withAnimation(.easeOut(duration: 0.6)) {
                textOpacity = 1
                textOffset = 0
            }
        }
    }

    private func handleContinue() {
        guard !isAdvancing else { return }
        isAdvancing = true
        HapticsService.shared.medium()
        withAnimation(.easeOut(duration: 0.35)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { onContinue() }
    }
}
