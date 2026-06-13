import SwiftUI
import DesignKit

/// QuizOptionRow — Convenience wrapper around `HUDOptionCard` for the
/// onboarding quiz screens that share the leading-icon + label layout.
///
/// Matches the RN inline-style used in every quiz screen
/// (`PhoneTimeQuiz`, `AgeQuiz`, `Situation`, `Goal`, `Control`, `Triggers`,
/// `MorningRoutine`, `WhyNow`, `ControlLevel`).
struct QuizOptionRow: View {
    let label: String
    let isSelected: Bool
    let accentColor: Color
    let leading: AnyView?
    let action: () -> Void

    init(
        label: String,
        isSelected: Bool,
        accentColor: Color = SystemTokens.glowAccent,
        @ViewBuilder leading: () -> some View = { EmptyView() },
        action: @escaping () -> Void
    ) {
        self.label = label
        self.isSelected = isSelected
        self.accentColor = accentColor
        let l = leading()
        if l is EmptyView {
            self.leading = nil
        } else {
            self.leading = AnyView(l)
        }
        self.action = action
    }

    init(
        label: String,
        systemIcon: String?,
        isSelected: Bool,
        accentColor: Color = SystemTokens.glowAccent,
        action: @escaping () -> Void
    ) {
        self.label = label
        self.isSelected = isSelected
        self.accentColor = accentColor
        if let systemIcon {
            self.leading = AnyView(
                Image(systemName: systemIcon)
                    .font(.system(size: 18))
                    .foregroundColor(accentColor)
                    .frame(width: 28, alignment: .center)
            )
        } else {
            self.leading = nil
        }
        self.action = action
    }

    var body: some View {
        HUDOptionCard(isSelected: isSelected, accentColor: accentColor, action: action) {
            HStack(spacing: 12) {
                if let leading {
                    leading
                }
                Text(label)
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 15))
                    .tracking(-0.1)
                    .lineSpacing(5)
                    .foregroundColor(SystemTokens.textPrimary)
                    .shadow(color: isSelected ? accentColor.opacity(0.8) : .clear, radius: 8)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}
