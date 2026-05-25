import SwiftUI
import DesignKit

/// ReportStatBox — One of the 4 stat tiles in the 2-column grid below the
/// grade card.
///
/// Ported from `styles.statBox` in `WeeklyReportScreen.tsx:345-353`:
///   - Width: `(screenWidth - 64) / 2` — i.e. two columns with 12pt gap.
///   - Height: implicit (content + 16pt vertical padding).
///   - 12 radius, 1px `backgroundSecondary` border, `backgroundSecondary` bg.
///   - Value: 28pt InterTight-ExtraBold (`textPrimary`).
///   - Label: 12pt Inter (`textSecondary`), centered.
struct ReportStatBox: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.custom(FontFamily.headingBold.rawValue, size: 28))
                .foregroundColor(AppColors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)

            Text(label)
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(AppColors.backgroundSecondary)
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColors.backgroundSecondary, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
