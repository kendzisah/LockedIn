import SwiftUI
import DesignKit

/// Sign Up — glassmorphic layout aligned with Sign In / Missions.
///
/// Port of `apps/mobile/src/features/auth/screens/SignUpScreen.tsx`.
///
/// Navigation callbacks are wired in `OnboardingNavigator` (for the
/// onboarding-auth route) and `MainNavigator` (for the post-onboarding
/// sign-up modal). On successful sign-up the main stack pushes
/// `.editProfile`.
public struct SignUpScreen: View {
    let goToSignIn: () -> Void
    let continueAsGuest: () -> Void
    let onSignedUp: () -> Void

    @Environment(AuthState.self) private var auth

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var confirmPassword: String = ""
    @State private var errorMessage: String = ""
    @State private var authErrorCode: String? = nil
    @State private var isLoading: Bool = false

    public init(
        goToSignIn: @escaping () -> Void,
        continueAsGuest: @escaping () -> Void,
        onSignedUp: @escaping () -> Void
    ) {
        self.goToSignIn = goToSignIn
        self.continueAsGuest = continueAsGuest
        self.onSignedUp = onSignedUp
    }

    public var body: some View {
        ZStack {
            ScreenGradient()

            GlowOrb(preset: .blue, size: 220)
                .offset(x: -90 - 110, y: 40 - UIScreen.main.bounds.height / 2 + 110)
            GlowOrb(preset: .cyan, size: 280)
                .offset(x: 110 + UIScreen.main.bounds.width / 2 - 140,
                        y: 280 - UIScreen.main.bounds.height / 2 + 140)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    if !errorMessage.isEmpty {
                        errorPanel
                    }
                    formCard
                    actions
                    signInLinkRow
                    Spacer(minLength: 16)
                    guestRow
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 16)
                .frame(minHeight: UIScreen.main.bounds.height - 40)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(AppColors.background.ignoresSafeArea())
    }

    // MARK: - Subviews

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Create Account")
                .appText(Typography.heading)
                .foregroundColor(AppColors.textPrimary)
            Text("Sign up to save your progress")
                .appText(Typography.subtext)
                .foregroundColor(AppColors.textMuted)
            LinearGradient(
                colors: [AppColors.primary, AppColors.accent],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(width: 48, height: 3)
            .clipShape(RoundedRectangle(cornerRadius: 2))
            .padding(.top, 8)
        }
        .padding(.bottom, 22)
    }

    private var errorPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(errorMessage)
                .appText(Typography.subtext)
                .foregroundColor(AppColors.danger)
            if authErrorCode == "email_already_registered" {
                Button(action: goToSignIn) {
                    Text("Go to Sign In")
                        .appText(Typography.subtext)
                        .foregroundColor(AppColors.accent)
                }
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .background(AppColors.danger.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColors.danger.opacity(0.2), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .padding(.bottom, 18)
    }

    private var formCard: some View {
        GlassCard(style: .prominent, cornerRadius: 18, padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                fieldLabel("Email")
                InputField(
                    text: $email,
                    placeholder: "you@example.com",
                    keyboardType: .emailAddress,
                    autocapitalization: .never
                )
                .disabled(isLoading)
                .padding(.bottom, 16)

                fieldLabel("Password")
                InputField(
                    text: $password,
                    placeholder: "At least 8 characters",
                    isSecure: true,
                    autocapitalization: .never
                )
                .disabled(isLoading)
                .padding(.bottom, 16)

                fieldLabel("Confirm Password")
                InputField(
                    text: $confirmPassword,
                    placeholder: "Re-enter your password",
                    isSecure: true,
                    autocapitalization: .never
                )
                .disabled(isLoading)
            }
            .padding(.horizontal, 18)
            .padding(.top, 20)
            .padding(.bottom, 18)
        }
        .padding(.bottom, 22)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .appText(Typography.subtext)
            .foregroundColor(AppColors.textSecondary)
            .tracking(0.2)
            .padding(.bottom, 8)
    }

    private var actions: some View {
        VStack(spacing: 12) {
            PrimaryButton(
                isLoading ? "" : "Sign Up",
                style: .glass,
                isEnabled: !isLoading
            ) {
                Task { await handleSignUp() }
            }
            .overlay {
                if isLoading {
                    ProgressView().tint(AppColors.textPrimary)
                }
            }
            .shineSweep(cornerRadius: 28, peakAlpha: isLoading ? 0 : 0.18)

            AppleSignInButton(
                kind: .signUp,
                isDisabled: isLoading
            ) {
                Task { await handleSignUpWithApple() }
            }
        }
        .padding(.bottom, 20)
    }

    private var signInLinkRow: some View {
        HStack(spacing: 0) {
            Spacer()
            Text("Already have an account? ")
                .appText(Typography.body)
                .foregroundColor(AppColors.textMuted)
            Button(action: goToSignIn) {
                Text("Sign In")
                    .appText(Typography.body)
                    .foregroundColor(AppColors.accent)
            }
            Spacer()
        }
    }

    private var guestRow: some View {
        HStack {
            Spacer()
            Button(action: continueAsGuest) {
                Text("Continue as Guest")
                    .appText(Typography.subtext)
                    .foregroundColor(AppColors.textSecondary)
            }
            .padding(.vertical, 8)
            Spacer()
        }
    }

    // MARK: - Actions

    private func validateForm() -> Bool {
        errorMessage = ""
        authErrorCode = nil
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            errorMessage = "Email is required"
            return false
        }
        if !SignInScreen.isValidEmail(trimmed) {
            errorMessage = "Invalid email address"
            return false
        }
        if password.isEmpty {
            errorMessage = "Password is required"
            return false
        }
        if password.count < 8 {
            errorMessage = "Password must be at least 8 characters"
            return false
        }
        if password != confirmPassword {
            errorMessage = "Passwords do not match"
            return false
        }
        return true
    }

    private func handleSignUp() async {
        guard !isLoading else { return }
        if !validateForm() { return }

        isLoading = true
        defer { isLoading = false }

        let result = await auth.signUp(email: email, password: password)
        if let err = result.error {
            errorMessage = err.message
            authErrorCode = err.code
            AuthAnalytics.log(AuthAnalytics.signUpFailed, properties: [
                "method": "email",
                "error_code": err.code ?? ""
            ])
            return
        }
        AuthAnalytics.log(AuthAnalytics.accountCreated, properties: [
            "method": "email",
            "was_anonymous": true
        ])
        AuthAnalytics.logAF(AuthAnalytics.afCompleteRegistration, properties: ["method": "email"])
        onSignedUp()
    }

    private func handleSignUpWithApple() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        let result = await auth.signInWithApple()
        if let err = result.error {
            errorMessage = err.message
            if err.code != "ERR_CANCELED" {
                authErrorCode = err.code
                AuthAnalytics.log(AuthAnalytics.signUpFailed, properties: [
                    "method": "apple",
                    "error_code": err.code ?? ""
                ])
            }
            return
        }
        AuthAnalytics.log(AuthAnalytics.accountCreated, properties: [
            "method": "apple",
            "was_anonymous": true
        ])
        AuthAnalytics.logAF(AuthAnalytics.afCompleteRegistration, properties: ["method": "apple"])
        onSignedUp()
    }
}
