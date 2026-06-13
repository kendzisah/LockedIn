import SwiftUI

/// Standard / prominent glassmorphic cards.
///
/// Per the design system spec:
/// - **Standard**: `rgba(21,26,33,0.5)` bg, 14-18 radius, white 0.04 border.
/// - **Prominent**: `rgba(21,26,33,0.72)` bg, 18 radius, white 0.07 border,
///   inner blue glow orb.
public struct GlassCard<Content: View>: View {
    public enum Style {
        case standard
        case prominent
    }

    let style: Style
    let cornerRadius: CGFloat
    let padding: CGFloat
    let content: Content

    public init(
        style: Style = .standard,
        cornerRadius: CGFloat = 16,
        padding: CGFloat = 16,
        @ViewBuilder content: () -> Content
    ) {
        self.style = style
        self.cornerRadius = cornerRadius
        self.padding = padding
        self.content = content()
    }

    public var body: some View {
        content
            .padding(padding)
            .background(
                ZStack {
                    backgroundFill
                    if style == .prominent {
                        // Inner blue glow orb, positioned top-right per Agent C spec.
                        Circle()
                            .fill(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.06))
                            .frame(width: 220, height: 220)
                            .blur(radius: 30)
                            .offset(x: 80, y: -60)
                            .allowsHitTesting(false)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
    }

    private var backgroundFill: Color {
        switch style {
        case .standard:
            return Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.5)
        case .prominent:
            return Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.72)
        }
    }

    private var borderColor: Color {
        switch style {
        case .standard:  return Color.white.opacity(0.04)
        case .prominent: return Color.white.opacity(0.07)
        }
    }
}
