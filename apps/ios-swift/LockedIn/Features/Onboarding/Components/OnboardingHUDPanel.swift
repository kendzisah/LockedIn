import SwiftUI
import DesignKit

/// OnboardingHUDPanel — local mirror of `Features/Home/Components/HUDPanel`
/// for the onboarding feature. Same chrome (bg, border, corner brackets,
/// header gradient rule) so onboarding graphics match the home HUD pixel
/// for pixel.
///
/// Lives here rather than in `Features/Home/` because the panel shape is
/// also surfaced by `BenefitTemplate`. Once the coordinator merges, this
/// can be promoted to DesignKit and the duplicate removed.
///
/// Ported from `apps/mobile/src/features/home/components/HUDPanel.tsx`.
struct OnboardingHUDPanel<Content: View>: View {
    let headerLabel: String?
    let headerRight: String?
    let accentColor: Color?
    let idle: Bool
    let content: Content

    init(
        headerLabel: String? = nil,
        headerRight: String? = nil,
        accentColor: Color? = nil,
        idle: Bool = true,
        @ViewBuilder content: () -> Content
    ) {
        self.headerLabel = headerLabel
        self.headerRight = headerRight
        self.accentColor = accentColor
        self.idle = idle
        self.content = content()
    }

    var body: some View {
        let accent = accentColor ?? SystemTokens.bracketColor
        VStack(alignment: .leading, spacing: 0) {
            if let label = headerLabel {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("// \(label)")
                            .font(.custom(FontFamily.display.rawValue, size: 9))
                            .tracking(1.8)
                            .foregroundColor(SystemTokens.glowAccent)
                        Spacer()
                        if let right = headerRight {
                            Text(right)
                                .font(.custom(FontFamily.display.rawValue, size: 9))
                                .tracking(0.8)
                                .foregroundColor(SystemTokens.textMuted)
                        }
                    }
                    LinearGradient(
                        colors: [accent, .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(height: 1)
                }
                .padding(.bottom, 12)
            }

            content
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SystemTokens.panelBg)
        .overlay(
            Rectangle()
                .stroke(SystemTokens.panelBorder, lineWidth: 1)
        )
        .overlay(
            HUDCornerBrackets(
                length: 14,
                thickness: 1.5,
                color: accent,
                pulses: idle
            )
            .padding(-1)
            .allowsHitTesting(false)
        )
        .clipShape(RoundedRectangle(cornerRadius: SystemTokens.panelRadius, style: .continuous))
    }
}
