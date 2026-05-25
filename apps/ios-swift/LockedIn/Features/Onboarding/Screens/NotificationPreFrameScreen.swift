import SwiftUI
import DesignKit

/// NotificationPreFrameScreen — Step 21: push permission prompt preview +
/// actual request.
///
/// Port of `screens/NotificationPreFrameScreen.tsx`.
///
/// Wired in `OnboardingNavigator`: `requestPermission` calls
/// `NotificationService.shared.requestAuthorization()` and
/// `scheduleDailyNotifications` calls
/// `NotificationService.shared.scheduleAllDailyNotifications(streak: 0, ...)`.
struct NotificationPreFrameScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void
    let requestPermission: () async -> Bool
    let scheduleDailyNotifications: () async -> Void

    @State private var tracker = OnboardingScreenTracker(.notificationPreFrame)
    @State private var screenOpacity: Double = 1
    @State private var headlineOpacity: Double = 0
    @State private var headlineOffset: CGFloat = 20
    @State private var bodyOpacity: Double = 0
    @State private var bodyOffset: CGFloat = 20
    @State private var buttonOpacity: Double = 0

    init(
        onContinue: @escaping () -> Void,
        requestPermission: @escaping () async -> Bool = { false },
        scheduleDailyNotifications: @escaping () async -> Void = {}
    ) {
        self.onContinue = onContinue
        self.requestPermission = requestPermission
        self.scheduleDailyNotifications = scheduleDailyNotifications
    }

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                Spacer()
                // TODO(post-launch): replace SF Symbol with Lottie
                // `bell-ring.json` once the asset is bundled.
                Image(systemName: "bell.fill")
                    .font(.system(size: 36))
                    .foregroundColor(AppColors.textPrimary)
                    .frame(width: 64, height: 64)
                    .padding(.bottom, 20)

                Text("We'll signal your session.\nYou show up.")
                    .font(.custom(FontFamily.heading.rawValue, size: 30))
                    .tracking(-0.6)
                    .lineSpacing(4)
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 16)
                    .opacity(headlineOpacity)
                    .offset(y: headlineOffset)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Daily Lock In notifications are your trigger.")
                        .font(.custom(FontFamily.body.rawValue, size: 16))
                        .lineSpacing(8)
                        .foregroundColor(AppColors.textSecondary)
                    Text("Miss the trigger, miss the session.")
                        .font(.custom(FontFamily.bodyMedium.rawValue, size: 15))
                        .lineSpacing(7)
                        .foregroundColor(AppColors.textPrimary)
                }
                .opacity(bodyOpacity)
                .offset(y: bodyOffset)

                Spacer()

                VStack(spacing: 12) {
                    Button(action: { Task { await handleTurnOn() } }) {
                        Text("Turn On Daily Signal")
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 17))
                            .tracking(0.5)
                            .foregroundColor(Color.white.opacity(0.55))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.white.opacity(0.04))
                            .overlay(
                                RoundedRectangle(cornerRadius: 28)
                                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 28))
                    }
                    Button(action: handleSkip) {
                        Text("Skip (not recommended)")
                            .font(.custom(FontFamily.body.rawValue, size: 14))
                            .foregroundColor(AppColors.textMuted)
                            .padding(.vertical, 8)
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
            withAnimation(.easeOut(duration: 0.5)) { buttonOpacity = 1 }
        }
    }

    private func handleTurnOn() async {
        HapticsService.shared.medium()
        let granted = await requestPermission()
        if granted {
            OnboardingAnalytics.track(OnboardingAnalytics.notifPermissionGranted, properties: [
                "source": "onboarding"
            ])
            await scheduleDailyNotifications()
        } else {
            OnboardingAnalytics.track(OnboardingAnalytics.notifPermissionDenied, properties: [
                "source": "onboarding"
            ])
        }
        state.setNotificationsGranted(granted)
        navigateForward()
    }

    private func handleSkip() {
        OnboardingAnalytics.track(OnboardingAnalytics.notifPermissionDenied, properties: [
            "source": "onboarding"
        ])
        state.setNotificationsGranted(false)
        navigateForward()
    }

    private func navigateForward() {
        withAnimation(.easeOut(duration: 0.5)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { onContinue() }
    }
}
