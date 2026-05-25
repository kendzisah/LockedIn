import SwiftUI

/// HUD option card with a 2px left accent border and text-shadow glow.
///
/// Per Agent C / commit `2eb79ef`: used by the onboarding `HUDOptionCard`
/// and `BenefitTemplate` panel rows.
public struct HUDOptionCard<Content: View>: View {
    let isSelected: Bool
    let action: (() -> Void)?
    let content: Content
    let accentColor: Color

    public init(
        isSelected: Bool = false,
        accentColor: Color = SystemTokens.glowAccent,
        action: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.isSelected = isSelected
        self.accentColor = accentColor
        self.action = action
        self.content = content()
    }

    public var body: some View {
        Button(action: { action?() }) {
            HStack(spacing: 0) {
                Rectangle()
                    .fill(accentColor.opacity(isSelected ? 1.0 : 0.55))
                    .frame(width: 2)
                content
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .shadow(color: accentColor.opacity(isSelected ? 0.6 : 0.25), radius: 6, x: 0, y: 0)
            }
            // Per commit `2eb79ef`: accent-tinted background (selected ~24% / unselected ~6%),
            // sharp corners, no full border (the 2px left rail is the entire affordance).
            .background(accentColor.opacity(isSelected ? 0.24 : 0.06))
        }
        .buttonStyle(PressOpacityButtonStyle())
        .disabled(action == nil)
    }
}
