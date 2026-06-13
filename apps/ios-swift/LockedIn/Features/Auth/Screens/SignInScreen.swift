import SwiftUI
import DesignKit

/// Sign In — glassmorphic layout aligned with SignUp / Missions (gradient,
/// glow orbs, frosted panels).
///
/// Port of `apps/mobile/src/features/auth/screens/SignInScreen.tsx`.
///
/// Navigation callbacks (`goToSignUp`, `continueAsGuest`, `onSignedIn`) are
/// wired in `OnboardingNavigator` (for the onboarding-auth route) and
/// `MainNavigator` (for the post-onboarding modals).
public struct SignInScreen: View {
    // MARK: - Inputs / callbacks (coordinator-owned)

    let goToSignUp: () -> Void
    let continueAsGuest: () -> Void
    let onSignedIn: () -> Void

    @Environment(AuthState.self) private var auth

    // MARK: - Local state

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var errorMessage: String = ""
    @State private var isLoading: Bool = false
    @State private var resetSending: Bool = false
    @State private var showResetAlert: Bool = false
    @State private var resetAlertTitle: String = ""
    @State private var resetAlertMessage: String = ""

    public init(
        goToSignUp: @escaping () -> Void,
        continueAsGuest: @escaping () -> Void,
        onSignedIn: @escaping () -> Void
    ) {
        self.goToSignUp = goToSignUp
        self.continueAsGuest = continueAsGuest
        self.onSignedIn = onSignedIn
    }

    public var body: some View {
        ZStack {
            ScreenGradient()

            // Glow orbs (positions match RN SignInScreen.tsx:344-358)
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
                    signUpLinkRow
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
        .alert(resetAlertTitle, isPresented: $showResetAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(resetAlertMessage)
        }
        .background(AppColors.background.ignoresSafeArea())
    }

    // MARK: - Subviews

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Sign In")
                .appText(Typography.heading)
                .foregroundColor(AppColors.textPrimary)
            Text("Welcome back to Locked In")
                .appText(Typography.subtext)
                .foregroundColor(AppColors.textMuted)
            titleAccent
                .padding(.top, 8)
        }
        .padding(.bottom, 22)
    }

    private var titleAccent: some View {
        LinearGradient(
            colors: [AppColors.primary, AppColors.accent],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(width: 48, height: 3)
        .clipShape(RoundedRectangle(cornerRadius: 2))
    }

    private var errorPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(errorMessage)
                .appText(Typography.subtext)
                .foregroundColor(AppColors.danger)
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
                .disabled(isLoading || resetSending)
                .padding(.bottom, 16)

                fieldLabel("Password")
                InputField(
                    text: $password,
                    placeholder: "Your password",
                    isSecure: true,
                    autocapitalization: .never
                )
                .disabled(isLoading || resetSending)
                .padding(.bottom, 10)

                HStack {
                    Spacer()
                    Button(action: { Task { await handleForgotPassword() } }) {
                        Text(resetSending ? "Sending…" : "Forgot password?")
                            .appText(Typography.subtext)
                            .foregroundColor(resetSending ? AppColors.textMuted : AppColors.accent)
                    }
                    .disabled(isLoading || resetSending)
                }
                .padding(.vertical, 4)
            }
            .padding(.horizontal, 18)
            .padding(.top, 20)
            .padding(.bottom, 14)
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
                isLoading ? "" : "Sign In",
                style: .glass,
                isEnabled: !isLoading
            ) {
                Task { await handleSignIn() }
            }
            .overlay {
                if isLoading {
                    ProgressView().tint(AppColors.textPrimary)
                }
            }
            .shineSweep(cornerRadius: 28, peakAlpha: isLoading ? 0 : 0.18)

            AppleSignInButton(
                kind: .signIn,
                isDisabled: isLoading
            ) {
                Task { await handleSignInWithApple() }
            }
        }
        .padding(.bottom, 20)
    }

    private var signUpLinkRow: some View {
        HStack(spacing: 0) {
            Spacer()
            Text("Don't have an account? ")
                .appText(Typography.body)
                .foregroundColor(AppColors.textMuted)
            Button(action: goToSignUp) {
                Text("Sign Up")
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
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            errorMessage = "Email is required"
            return false
        }
        if !Self.isValidEmail(trimmed) {
            errorMessage = "Invalid email address"
            return false
        }
        if password.isEmpty {
            errorMessage = "Password is required"
            return false
        }
        return true
    }

    private func handleSignIn() async {
        guard !isLoading else { return }
        if !validateForm() { return }

        isLoading = true
        defer { isLoading = false }

        let result = await auth.signIn(email: email, password: password)
        if let err = result.error {
            errorMessage = err.message
            AuthAnalytics.log(AuthAnalytics.signInFailed, properties: [
                "method": "email",
                "error_code": err.code ?? ""
            ])
            return
        }
        AuthAnalytics.log(AuthAnalytics.signInCompleted, properties: ["method": "email"])
        onSignedIn()
    }

    private func handleSignInWithApple() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        let result = await auth.signInWithApple()
        if let err = result.error {
            errorMessage = err.message
            if err.code != "ERR_CANCELED" {
                AuthAnalytics.log(AuthAnalytics.signInFailed, properties: [
                    "method": "apple",
                    "error_code": err.code ?? ""
                ])
            }
            return
        }
        AuthAnalytics.log(AuthAnalytics.signInCompleted, properties: ["method": "apple"])
        onSignedIn()
    }

    private func handleForgotPassword() async {
        guard !resetSending, !isLoading else { return }
        errorMessage = ""
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            errorMessage = "Enter your email address to reset your password"
            return
        }
        if !Self.isValidEmail(trimmed) {
            errorMessage = "Enter a valid email address"
            return
        }

        resetSending = true
        let result = await auth.resetPasswordForEmail(trimmed)
        resetSending = false

        if let err = result.error {
            resetAlertTitle = "Couldn't send reset email"
            resetAlertMessage = err.message
            showResetAlert = true
            return
        }
        AuthAnalytics.log(AuthAnalytics.passwordResetRequested, properties: ["source": "sign_in"])
        resetAlertTitle = "Check your email"
        resetAlertMessage = "If an account exists for that address, we sent a link to reset your password."
        showResetAlert = true
    }

    static func isValidEmail(_ email: String) -> Bool {
        // Mirrors the RN regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
        let pattern = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }
}
