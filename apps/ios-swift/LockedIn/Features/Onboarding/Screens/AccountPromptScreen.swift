import SwiftUI
import DesignKit

/// AccountPromptScreen — Step 22: "Save my character" with optional skip.
/// Navigates to `OnboardingAuth` (lives in Features/Auth/) on Sign In /
/// Create Account, or to `Commitment` on Skip.
///
/// If the user is already authenticated, the coordinator should skip past
/// this screen and continue directly to `Commitment` (matches the RN
/// useEffect in AccountPromptScreen.tsx:40).
///
/// Port of `screens/AccountPromptScreen.tsx`.
struct AccountPromptScreen: View {
    let onCreateAccount: () -> Void
    let onSignIn: () -> Void
    let onMaybeLater: () -> Void

    @State private var tracker = OnboardingScreenTracker(.accountPrompt)

    var body: some View {
        ZStack {
            AppColors.background.ignoresSafeArea()
            ScreenGradient()
            VStack(spacing: 0) {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 0) {
                        VStack(spacing: 0) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 20)
                                    .fill(AppColors.accent.opacity(0.08))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 20)
                                            .stroke(AppColors.accent.opacity(0.12), lineWidth: 1)
                                    )
                                Image(systemName: "checkmark.shield.fill")
                                    .font(.system(size: 32))
                                    .foregroundColor(AppColors.accent)
                            }
                            .frame(width: 60, height: 60)

                            Text("LOCK IN YOUR PROGRESS")
                                .font(.custom(FontFamily.heading.rawValue, size: 22))
                                .foregroundColor(AppColors.textPrimary)
                                .multilineTextAlignment(.center)
                                .padding(.top, 20)

                            Text("Your stats, rank, and streak are tied to your account. Create one to make sure nothing is lost.")
                                .font(.custom(FontFamily.body.rawValue, size: 15))
                                .lineSpacing(7)
                                .foregroundColor(AppColors.textSecondary)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: 300)
                                .padding(.top, 8)
                        }

                        VStack(alignment: .leading, spacing: 14) {
                            ForEach(OnboardingData.accountPromptBenefits, id: \.self) { label in
                                HStack(spacing: 12) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 20))
                                        .foregroundColor(AppColors.success)
                                    Text(label)
                                        .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                                        .foregroundColor(AppColors.textPrimary)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                        .padding(.top, 28)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 24)
                    .padding(.bottom, 8)
                }

                VStack(spacing: 0) {
                    Button(action: onCreateAccount) {
                        Text("Save my character")
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                            .foregroundColor(AppColors.primary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 15)
                            .background(AppColors.primary.opacity(0.12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(AppColors.primary.opacity(0.25), lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    HStack(spacing: 6) {
                        Text("Already have an account?")
                            .font(.custom(FontFamily.body.rawValue, size: 13))
                            .foregroundColor(AppColors.textSecondary)
                        Button(action: onSignIn) {
                            Text("Sign in")
                                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 13))
                                .foregroundColor(AppColors.accent)
                        }
                    }
                    .padding(.top, 12)

                    Button(action: handleMaybeLater) {
                        Text("Maybe Later")
                            .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                            .foregroundColor(AppColors.textMuted)
                            .padding(.vertical, 14)
                            .frame(maxWidth: .infinity)
                    }
                    .padding(.top, 8)
                }
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .padding(.bottom, 24)
            }
        }
        .onAppear { tracker.didAppear() }
        .onDisappear { tracker.didDisappear() }
    }

    private func handleMaybeLater() {
        Defaults.setString("onboarding", OnboardingData.signupPromptDismissedKey)
        onMaybeLater()
    }
}
