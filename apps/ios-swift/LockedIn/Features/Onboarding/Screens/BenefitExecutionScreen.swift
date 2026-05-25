import SwiftUI
import DesignKit

/// BenefitExecutionScreen — Step 15: phone-frame mock graphic for the
/// focus-session benefit.
///
/// Port of `screens/BenefitExecutionScreen.tsx`.
struct BenefitExecutionScreen: View {
    let onContinue: () -> Void
    @State private var tracker = OnboardingScreenTracker(.benefitExecution)

    var body: some View {
        BenefitTemplate(
            panelLabel: "FOCUS SESSIONS",
            headline: "FOCUS SESSIONS",
            headlineColor: AppColors.primary,
            body: "Set your timer. The system seals your distractions. Apps you selected? Gone. Try to open them and the system blocks you. Hold to quit early — but the system tracks that too.",
            callout: "+35 XP per 30-min session",
            calloutColor: AppColors.accent,
            graphic: { phoneMock },
            onContinue: onContinue
        )
        .onAppear { tracker.didAppear() }
        .onDisappear { tracker.didDisappear() }
    }

    private var phoneMock: some View {
        VStack(spacing: 16) {
            Text("FOCUS SESSION")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                .tracking(1.2)
                .foregroundColor(AppColors.textSecondary)
            Text("01:28:47")
                .font(.custom(FontFamily.heading.rawValue, size: 32))
                .foregroundColor(AppColors.textPrimary)
            HStack(spacing: 6) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.accent)
                Text("HOLD TO UNLOCK")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 10))
                    .tracking(1)
                    .foregroundColor(AppColors.accent)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(AppColors.accent.opacity(0.08))
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(AppColors.accent.opacity(0.2), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18))
        }
        .frame(width: 180 - 16, height: 220 - 16)
        .background(AppColors.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .padding(8)
        .background(AppColors.background)
        .overlay(
            RoundedRectangle(cornerRadius: 24)
                .stroke(Color.white.opacity(0.06), lineWidth: 2)
        )
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: AppColors.primary.opacity(0.3), radius: 20)
    }
}
