import SwiftUI
import DesignKit

/// HUDSectionLabel — Floating `// LABEL` header with a gradient rule below.
///
/// Used on quiz/narrative screens where the label sits above the content
/// (not inside an HUDPanel). For panel-wrapped content the panel's own
/// `headerLabel` slot is used instead.
///
/// Port of `apps/mobile/src/features/onboarding/components/HUDSectionLabel.tsx`.
struct HUDSectionLabel: View {
    let label: String
    let accentColor: Color

    init(_ label: String, accentColor: Color = SystemTokens.glowAccent) {
        self.label = label
        self.accentColor = accentColor
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("// \(label)")
                .font(.custom(FontFamily.display.rawValue, size: 9))
                .tracking(1.8)
                .foregroundColor(accentColor)
            LinearGradient(
                colors: [accentColor, .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 1)
        }
        .padding(.bottom, 14)
    }
}
