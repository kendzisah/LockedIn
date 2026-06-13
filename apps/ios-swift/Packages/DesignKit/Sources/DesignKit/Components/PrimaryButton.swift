import SwiftUI

/// Primary CTA button.
///
/// Per commit `2eb79ef` HUD redesign:
/// - **Solid** (default, renamed from the pre-`2eb79ef` pill): HUD outline style.
///   Background `rgba(58,102,255,0.18)`, border `rgba(58,102,255,0.45)`, **sharp corners**,
///   InterTight 800 13pt 1.6 tracking, 16v / 48h padding, opacity 0.8 on press.
/// - **Glass**: legacy `rgba(58,102,255,0.42)` bg, 28 radius, blue glow shadow — kept for
///   onboarding paywall CTAs that explicitly use the rounded glass form.
public struct PrimaryButton: View {
    public enum Style {
        case solid
        case glass
    }

    let title: String
    let style: Style
    let isEnabled: Bool
    let action: () -> Void

    public init(
        _ title: String,
        style: Style = .solid,
        isEnabled: Bool = true,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.style = style
        self.isEnabled = isEnabled
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            label
                .frame(maxWidth: .infinity)
                // Solid is the HUD ghost CTA (14v padding per `2eb79ef`); glass keeps the
                // legacy 16v pill padding used on the onboarding paywall stack.
                .padding(.vertical, style == .solid ? 14 : 16)
                .padding(.horizontal, style == .solid ? 48 : 56)
                .background(background)
                .overlay(borderOverlay)
                .modifier(MaybeClip(radius: cornerRadius))
                .shadow(color: shadowColor, radius: shadowRadius, x: 0, y: 0)
                .opacity(isEnabled ? 1.0 : 0.5)
        }
        .disabled(!isEnabled)
        .buttonStyle(PressOpacityButtonStyle())
    }

    @ViewBuilder
    private var label: some View {
        switch style {
        case .solid:
            // HUD chrome label — Michroma (wide geometric display face) at small
            // tracked size. Sells the "ship's console" aesthetic; the HUD blue
            // accent (`#3A66FF`) foreground matches RN `PrimaryButton.tsx:73`.
            Text(title.uppercased())
                .font(.custom(FontFamily.display.rawValue, size: 11))
                .tracking(1.6)
                .foregroundColor(AppColors.primary)
        case .glass:
            Text(title)
                .appText(Typography.button)
                .foregroundColor(AppColors.textPrimary)
        }
    }

    /// Solid HUD style is rectangular (no corner radius); glass keeps the legacy pill.
    private var cornerRadius: CGFloat { style == .solid ? 0 : 28 }

    @ViewBuilder
    private var background: some View {
        switch style {
        case .solid:
            // HUD blue-tint bg, ~18% accent opacity.
            Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.18)
        case .glass:
            Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.42)
        }
    }

    @ViewBuilder
    private var borderOverlay: some View {
        switch style {
        case .solid:
            Rectangle()
                .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.45), lineWidth: 1)
        case .glass:
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(Color(.sRGB, red: 120/255, green: 160/255, blue: 255/255, opacity: 0.55), lineWidth: 1)
        }
    }

    private var shadowColor: Color {
        switch style {
        case .solid: return AppColors.primary.opacity(0.2)
        case .glass: return AppColors.primary.opacity(0.35)
        }
    }

    private var shadowRadius: CGFloat {
        switch style {
        case .solid: return 8
        case .glass: return 14
        }
    }
}

/// Applies a rounded-rect clip when radius > 0; otherwise leaves the view's
/// natural (sharp) edges in place. Used by `PrimaryButton` so the HUD-style
/// solid variant keeps its sharp 90° corners.
private struct MaybeClip: ViewModifier {
    let radius: CGFloat
    func body(content: Content) -> some View {
        if radius > 0 {
            content.clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        } else {
            content
        }
    }
}

/// Shared button style used by every CTA: 0.8 opacity while pressed (never 0.5).
public struct PressOpacityButtonStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
