import SwiftUI
import DesignKit

/// PerformanceBar — The "Your Performance · 0/100" cyan bar near the bottom
/// of the Weekly Report screen.
///
/// Ported from the `<View style={styles.percentileSection}>` block in
/// `WeeklyReportScreen.tsx:206-230`:
///   - Header row: 14pt label + 14pt cyan `value/100`.
///   - Bar: 8pt high, 4 radius, `backgroundSecondary` track, accent fill.
///   - Description: 12pt muted.
///
/// Animation: 600ms `easeOut` fill on appear, matching `DesignKit.StatBar`'s
/// timing curve so the report feels consistent with the rest of the HUD.
struct PerformanceBar: View {
    let percentile: Int

    @State private var animatedProgress: Double = 0

    /// Clamped 0…1 progress.
    private var progress: Double {
        min(1, max(0, Double(percentile) / 100.0))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Your Performance")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                    .foregroundColor(AppColors.textSecondary)

                Spacer()

                Text("\(percentile)/100")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                    .foregroundColor(AppColors.accent)
            }

            // Bar
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(AppColors.backgroundSecondary)
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(AppColors.accent)
                        .frame(width: max(0, proxy.size.width * animatedProgress))
                }
            }
            .frame(height: 8)

            Text("Your weekly performance score")
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .foregroundColor(AppColors.textMuted)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.6)) {
                animatedProgress = progress
            }
        }
        .onChange(of: progress) { _, newValue in
            withAnimation(.easeOut(duration: 0.6)) {
                animatedProgress = newValue
            }
        }
    }
}
