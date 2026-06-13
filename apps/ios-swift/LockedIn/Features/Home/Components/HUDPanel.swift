import SwiftUI
import DesignKit

/// HUDPanel — Shared shell for every HUD surface. Provides the panel chrome
/// (bg + border + corner brackets) and an optional `// HEADER` row with a
/// gradient rule. Children render below the header at full panel width.
///
/// Ported 1:1 from `apps/mobile/src/features/home/components/HUDPanel.tsx`:
///   - bg `SystemTokens.panelBg`, border `SystemTokens.panelBorder`,
///     radius 4, padH 14, padT 12, padB 14.
///   - Corner brackets pulse opacity 0.6 ↔ 0.4 over 2000ms (loop) when `idle`.
///   - Header is rendered as `// {headerLabel}` (`SectionLabelStyle`), with
///     a `LinearGradient` rule from `accentColor → transparent`.
struct HUDPanel<Content: View>: View {
    let headerLabel: String?
    let headerRight: String?
    let accentColor: Color?
    let idle: Bool
    let onPress: (() -> Void)?
    let content: Content

    init(
        headerLabel: String? = nil,
        headerRight: String? = nil,
        accentColor: Color? = nil,
        idle: Bool = true,
        onPress: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.headerLabel = headerLabel
        self.headerRight = headerRight
        self.accentColor = accentColor
        self.idle = idle
        self.onPress = onPress
        self.content = content()
    }

    var body: some View {
        let resolvedAccent = accentColor ?? SystemTokens.bracketColor

        Group {
            if let onPress {
                Button(action: onPress) {
                    panelBody(resolvedAccent: resolvedAccent)
                }
                .buttonStyle(PressOpacityButtonStyle())
            } else {
                panelBody(resolvedAccent: resolvedAccent)
            }
        }
    }

    @ViewBuilder
    private func panelBody(resolvedAccent: Color) -> some View {
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
                        gradient: Gradient(colors: [resolvedAccent, .clear]),
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
            RoundedRectangle(cornerRadius: SystemTokens.panelRadius, style: .continuous)
                .stroke(SystemTokens.panelBorder, lineWidth: 1)
        )
        .overlay(
            HUDCornerBrackets(
                length: 14,
                thickness: 1.5,
                color: resolvedAccent,
                pulses: idle
            )
            .padding(-1)
            .allowsHitTesting(false)
        )
        .clipShape(RoundedRectangle(cornerRadius: SystemTokens.panelRadius, style: .continuous))
        .contentShape(Rectangle())
    }
}
