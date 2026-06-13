import SwiftUI
import DesignKit

/// ScreenTimePreFrameScreen — Step 20: Family Controls authorization prompt
/// preview + actual request.
///
/// Port of `screens/ScreenTimePreFrameScreen.tsx`.
///
/// The Family Controls request is wired in `OnboardingNavigator` —
/// `requestPermission` calls `LockModeService.shared.requestAuthorization()`
/// and maps the result onto `ScreenTimeStatus`. `showAppPicker` invokes
/// `LockModeService.shared.showAppPicker()`.
struct ScreenTimePreFrameScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void
    /// Coordinator injects the real Family Controls request.
    /// Returns `.granted` / `.denied` / `.unavailable` — matches RN's
    /// `PermissionService.requestScreenTimePermission()` return type.
    let requestPermission: () async -> ScreenTimeStatus
    /// Coordinator injects the family-activity picker presentation.
    /// Matches RN's `LockModeService.showAppPicker()`.
    let showAppPicker: () async -> Void

    @State private var tracker = OnboardingScreenTracker(.screenTimePreFrame)
    @State private var screenOpacity: Double = 1
    @State private var headlineOpacity: Double = 0
    @State private var headlineOffset: CGFloat = 20
    @State private var bodyOpacity: Double = 0
    @State private var bodyOffset: CGFloat = 20
    @State private var privacyOpacity: Double = 0
    @State private var buttonOpacity: Double = 0
    @State private var deniedOpacity: Double = 0
    @State private var denied = false
    @State private var loading = false

    init(
        onContinue: @escaping () -> Void,
        requestPermission: @escaping () async -> ScreenTimeStatus = { .denied },
        showAppPicker: @escaping () async -> Void = {}
    ) {
        self.onContinue = onContinue
        self.requestPermission = requestPermission
        self.showAppPicker = showAppPicker
    }

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                Spacer()
                // Lottie lock animation slot — TODO(post-launch): swap the
                // SF Symbol below for a LottieView pointing at
                // `lock_close.json` once the asset is bundled in
                // `LockedIn/Resources/Lottie/`.
                ZStack {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 36))
                        .foregroundColor(AppColors.accent)
                }
                .frame(width: 64, height: 64)
                .padding(.bottom, 20)

                Text("No exits means no loopholes.")
                    .font(.custom(FontFamily.heading.rawValue, size: 30))
                    .tracking(-0.6)
                    .lineSpacing(4)
                    .foregroundColor(AppColors.textPrimary)
                    .opacity(headlineOpacity)
                    .offset(y: headlineOffset)
                    .padding(.bottom, 16)

                VStack(alignment: .leading, spacing: 12) {
                    Text("To enforce your blocks, Locked In needs access to Screen Time.")
                        .font(.custom(FontFamily.body.rawValue, size: 16))
                        .lineSpacing(8)
                        .foregroundColor(AppColors.textSecondary)
                    Text("100% private. No tracking, no data collection.")
                        .font(.custom(FontFamily.body.rawValue, size: 13))
                        .foregroundColor(AppColors.textMuted.opacity(0.7))
                    Text("Your data never leaves this device — it's protected by Apple, not us.")
                        .font(.custom(FontFamily.body.rawValue, size: 13))
                        .foregroundColor(AppColors.textMuted)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
                .opacity(bodyOpacity)
                .offset(y: bodyOffset)

                VStack(spacing: 6) {
                    Text("\"Locked In\" Would Like to Access Screen Time")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                        .foregroundColor(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                    Text("This allows Locked In to enforce focus blocks on your device.")
                        .font(.custom(FontFamily.body.rawValue, size: 13))
                        .foregroundColor(AppColors.textMuted)
                        .multilineTextAlignment(.center)
                }
                .padding(16)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(AppColors.primary, lineWidth: 1)
                )
                .opacity(privacyOpacity * 0.7)
                .padding(.top, 24)

                if denied {
                    Text("Screen Time is required for full focus enforcement.")
                        .font(.custom(FontFamily.body.rawValue, size: 14))
                        .foregroundColor(AppColors.danger)
                        .padding(.top, 16)
                        .opacity(deniedOpacity)
                }

                Spacer()

                VStack(spacing: 12) {
                    Button(action: { Task { await handleGrant() } }) {
                        ZStack {
                            if loading {
                                ProgressView()
                                    .tint(AppColors.textPrimary)
                            } else {
                                Text(denied ? "Try Again" : "Connect Securely")
                                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 17))
                                    .tracking(0.5)
                                    .foregroundColor(Color.white.opacity(0.55))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.white.opacity(0.04))
                        .overlay(
                            RoundedRectangle(cornerRadius: 28)
                                .stroke(Color.white.opacity(0.08), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 28))
                    }
                    .disabled(loading)

                    if denied {
                        Button(action: navigateForward) {
                            Text("Continue anyway (limited)")
                                .font(.custom(FontFamily.body.rawValue, size: 14))
                                .foregroundColor(AppColors.textMuted)
                                .padding(.vertical, 8)
                        }
                    }
                }
                .padding(.bottom, 32)
                .padding(.horizontal, 4)
                .opacity(buttonOpacity)
            }
            .padding(.horizontal, 24)
            .opacity(screenOpacity)
        }
        .onAppear {
            tracker.didAppear()
            runIntro()
        }
        .onDisappear { tracker.didDisappear() }
    }

    private func runIntro() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            withAnimation(.easeOut(duration: 0.5)) {
                headlineOpacity = 1; headlineOffset = 0
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            withAnimation(.easeOut(duration: 0.5)) {
                bodyOpacity = 1; bodyOffset = 0
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            withAnimation(.easeOut(duration: 0.5)) { privacyOpacity = 1 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation(.easeOut(duration: 0.5)) { buttonOpacity = 1 }
        }
    }

    private func navigateForward() {
        withAnimation(.easeOut(duration: 0.5)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { onContinue() }
    }

    private func handleGrant() async {
        guard !loading else { return }
        loading = true
        HapticsService.shared.medium()
        defer { loading = false }
        let status = await requestPermission()
        state.setScreenTimeStatus(status)
        if status == .granted {
            OnboardingAnalytics.track(OnboardingAnalytics.permissionGranted, properties: [
                "screen": OnboardingRoute.screenTimePreFrame.rawValue,
                "permission": "screen_time",
            ])
            await showAppPicker()
            navigateForward()
        } else {
            OnboardingAnalytics.track(OnboardingAnalytics.permissionDenied, properties: [
                "screen": OnboardingRoute.screenTimePreFrame.rawValue,
                "permission": "screen_time",
            ])
            denied = true
            withAnimation(.easeOut(duration: 0.4)) { deniedOpacity = 1 }
        }
    }
}
