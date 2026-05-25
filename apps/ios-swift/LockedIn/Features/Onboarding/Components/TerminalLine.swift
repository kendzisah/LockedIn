import SwiftUI
import DesignKit

/// TerminalLine — single `> ...` line for the System Analysis screen.
///
/// Types in via TypingText, then pops a green checkmark in once the text
/// lands. Use `delay` to stagger lines.
///
/// Port of `apps/mobile/src/features/onboarding/components/TerminalLine.tsx`.
struct TerminalLine: View {
    let text: String
    let delay: Double
    let charDelay: Double
    let showCheck: Bool
    let color: Color
    let onComplete: (() -> Void)?

    @State private var done: Bool = false

    init(
        _ text: String,
        delay: Double = 0,
        charDelay: Double = 0.03,
        showCheck: Bool = true,
        color: Color = SystemTokens.glowAccent,
        onComplete: (() -> Void)? = nil
    ) {
        self.text = text
        self.delay = delay
        self.charDelay = charDelay
        self.showCheck = showCheck
        self.color = color
        self.onComplete = onComplete
    }

    var body: some View {
        HStack(spacing: 8) {
            TypingText(text, charDelay: charDelay, startDelay: delay) {
                done = true
                onComplete?()
            }
            .font(.custom(FontFamily.display.rawValue, size: 10))
            .tracking(1.4)
            .foregroundColor(color)
            .lineSpacing(5)

            if showCheck && done {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(SystemTokens.green)
            }
        }
        .padding(.vertical, 4)
    }
}
