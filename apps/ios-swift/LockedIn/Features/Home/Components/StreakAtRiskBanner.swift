import SwiftUI
import DesignKit

/// StreakAtRiskBanner — Glassmorphic warning banner shown when the streak is
/// one missed day from breaking. Tap opens the lock-in flow so the user can
/// meet today's goal and keep the streak alive.
///
/// Ported from `apps/mobile/src/features/home/components/StreakAtRiskBanner.tsx`.
struct StreakAtRiskBanner: View {
    let onPress: () -> Void

    var body: some View {
        Button(action: onPress) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color(.sRGB, red: 255/255, green: 71/255, blue: 87/255, opacity: 0.08))
                        .frame(width: 36, height: 36)
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.danger)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Your streak is at risk!")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                        .foregroundColor(AppColors.danger)
                    Text("Lock in today to keep it alive")
                        .font(.custom(FontFamily.body.rawValue, size: 12))
                        .foregroundColor(AppColors.textMuted)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AppColors.danger)
            }
            .padding(14)
            .background(Color(.sRGB, red: 255/255, green: 71/255, blue: 87/255, opacity: 0.06))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color(.sRGB, red: 255/255, green: 71/255, blue: 87/255, opacity: 0.12), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(PressOpacityButtonStyle())
    }
}
