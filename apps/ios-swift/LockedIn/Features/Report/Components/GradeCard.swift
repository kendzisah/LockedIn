import SwiftUI
import DesignKit

/// GradeCard — The big letter-grade panel at the top of the Weekly Report.
///
/// Ported from the `<View style={styles.gradeCard}>` + `<LinearGradient>`
/// block in `WeeklyReportScreen.tsx:162-174`:
///   - Card: 16 radius, 1px `backgroundSecondary` border.
///   - Inner gradient: top-left `#151A21` → bottom-right `#0E1116`.
///   - Letter: 72pt InterTight-ExtraBold, colored per grade tier.
///   - Sub-label: "Weekly Grade", 16pt body, `textSecondary`.
struct GradeCard: View {
    let grade: WeeklyReport.Grade

    var body: some View {
        VStack(spacing: 8) {
            Text(grade.rawValue)
                .font(.custom(FontFamily.headingBold.rawValue, size: 72))
                .foregroundColor(color(for: grade))

            Text("Weekly Grade")
                .font(.custom(FontFamily.body.rawValue, size: 16))
                .foregroundColor(AppColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
        .padding(.horizontal, 20)
        .background(
            LinearGradient(
                colors: [AppColors.backgroundSecondary, AppColors.background],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AppColors.backgroundSecondary, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    /// Mirrors `getGradeColor()` from `WeeklyReportScreen.tsx:101-117`.
    private func color(for grade: WeeklyReport.Grade) -> Color {
        switch grade {
        case .aPlus, .a:     return AppColors.accent          // Electric Cyan
        case .bPlus, .b:     return AppColors.primary         // Discipline Blue
        case .c:             return AppColors.textSecondary   // Gray
        case .d, .f:         return AppColors.danger          // Red
        }
    }
}
