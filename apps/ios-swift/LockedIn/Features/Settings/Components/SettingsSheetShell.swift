import SwiftUI
import DesignKit

/// Bottom-sheet wrapper used by every Settings sheet (DailyCommitment,
/// GoalPicker, WeaknessPicker, ReminderTime, ChangePassword, DeleteAccount,
/// ResetData). Port of
/// `apps/mobile/src/features/settings/components/SettingsSheetShell.tsx`.
///
/// HUD-themed: dark panel background, cyan handle bar, mono `// TITLE`
/// header with gradient rule, corner brackets at the top edge.
///
/// Presentation: SwiftUI `.sheet` with `.presentationDetents([.medium, .large])`
/// and `.presentationDragIndicator(.hidden)` — we draw our own handle so we
/// can colour-match RN.
struct SettingsSheetShell<Content: View>: View {
    let title: String?
    let content: Content

    init(title: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        ZStack(alignment: .top) {
            SystemTokens.panelBg.ignoresSafeArea()

            VStack(spacing: 0) {
                // Handle bar
                Capsule()
                    .fill(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.3))
                    .frame(width: 40, height: 3)
                    .padding(.top, 12)
                    .padding(.bottom, 14)

                // Header (`// TITLE` + gradient rule)
                if let title {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("// \(title.uppercased())")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                            .tracking(2.5)
                            .foregroundColor(SystemTokens.glowAccent)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        LinearGradient(
                            colors: [SystemTokens.bracketColor, .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(height: 1)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 14)
                }

                ScrollView(showsIndicators: false) {
                    content
                        .padding(.horizontal, 20)
                        .padding(.bottom, 28)
                }
            }
            .overlay(alignment: .top) {
                // Corner brackets pulse at the very top edge.
                HUDCornerBrackets(
                    length: 14,
                    thickness: 1.5,
                    color: SystemTokens.bracketColor,
                    pulses: true
                )
                .frame(height: 30)
                .padding(.horizontal, 4)
            }
            .overlay(
                Rectangle()
                    .stroke(SystemTokens.panelBorder, lineWidth: 1)
                    .ignoresSafeArea()
            )
        }
    }
}
