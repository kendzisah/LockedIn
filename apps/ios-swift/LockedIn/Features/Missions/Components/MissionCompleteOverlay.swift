import SwiftUI
import DesignKit

/// MissionCompleteOverlay — Brief 1.5s confirmation toast.
///
/// Ported 1:1 from
/// `apps/mobile/src/features/home/components/MissionCompleteOverlay.tsx`.
/// Hosted by the Missions feature (the provider owns the toast payload).
struct MissionCompleteOverlay: View {
    let payload: MissionCompletedToast
    let onDismiss: () -> Void

    @State private var opacity: Double = 0
    @State private var translateY: CGFloat = -30
    @State private var scale: CGFloat = 0.9

    private static let visibleDuration: Double = 1.5

    var body: some View {
        VStack {
            toast
                .opacity(opacity)
                .scaleEffect(scale)
                .offset(y: translateY)
                .padding(.top, 80)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.clear)
        .allowsHitTesting(false)
        .onAppear { animateIn() }
    }

    @ViewBuilder
    private var toast: some View {
        VStack(alignment: .leading, spacing: 6) {
            if payload.isPerfectDay {
                HStack(spacing: 6) {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.warning)
                    Text("ALL MISSIONS COMPLETE")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                        .tracking(1.4)
                        .foregroundColor(AppColors.warning)
                }
                Text("+50 XP BONUS")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 22))
                    .tracking(-0.3)
                    .foregroundColor(AppColors.warning)
                    .shadow(color: AppColors.warning.opacity(0.5), radius: 8)
                Text("PERFECT EXECUTION.")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 12))
                    .tracking(1.4)
                    .foregroundColor(AppColors.textPrimary)
            } else {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.success)
                    Text("MISSION COMPLETE")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                        .tracking(1.4)
                        .foregroundColor(AppColors.success)
                }
                Text(payload.missionTitle)
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 15))
                    .foregroundColor(AppColors.textPrimary)
                    .lineLimit(1)
                HStack {
                    Text("+\(payload.xp) XP")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                        .foregroundColor(AppColors.accent)
                    Spacer()
                    Text("\(payload.completedCount)/\(payload.totalCount) today")
                        .font(.custom(FontFamily.body.rawValue, size: 12))
                        .foregroundColor(AppColors.textMuted)
                }
            }
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 18)
        .frame(minWidth: 280)
        .background(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.95))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(
                    payload.isPerfectDay
                    ? AppColors.warning.opacity(0.5)
                    : AppColors.success.opacity(0.4),
                    lineWidth: 1
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(
            color: (payload.isPerfectDay ? AppColors.warning : AppColors.success).opacity(0.4),
            radius: 18, x: 0, y: 4
        )
    }

    private func animateIn() {
        withAnimation(.easeOut(duration: 0.25)) { opacity = 1 }
        withAnimation(.spring(response: 0.45, dampingFraction: 0.7)) {
            translateY = 0
        }
        withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
            scale = 1.0
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(Self.visibleDuration * 1_000_000_000))
            withAnimation(.easeIn(duration: 0.25)) {
                opacity = 0
                translateY = -20
            }
            try? await Task.sleep(nanoseconds: 280_000_000)
            onDismiss()
        }
    }
}
