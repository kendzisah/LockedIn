import SwiftUI
import UIKit
import UserNotifications
import DesignKit

/// ScheduleSessionScreen — Step 24: time-of-day picker for the user's first
/// session reminder. Also schedules a local notification.
///
/// Port of `screens/ScheduleSessionScreen.tsx`.
///
/// Wired in `OnboardingNavigator`: `scheduleNotification` calls
/// `NotificationService.shared.scheduleDailyReminder(at:)`. Identifier
/// `lockedin.daily_reminder` matches the RN `@lockedin/first_session_reminder`
/// semantics.
///
/// Permission UX: when the user taps Schedule Session, we check the current
/// `UNAuthorizationStatus` and gate accordingly:
///   - `.authorized` / `.provisional` / `.ephemeral` — schedule + advance.
///   - `.notDetermined` — fire the system prompt; schedule on grant; advance
///     regardless (silently skip if they decline).
///   - `.denied` — surface an alert offering one more chance: "Open Settings"
///     deep-links into the app's iOS Settings page; "Continue Without
///     Reminder" advances without scheduling. After enabling notifications
///     in Settings and returning, the screen detects the foreground
///     transition via `@Environment(\.scenePhase)` and auto-retries.
struct ScheduleSessionScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void
    /// Schedules the local "first session" reminder. Provided by the
    /// coordinator so this view stays UI-only.
    let scheduleNotification: (_ hour: Int, _ minute: Int) async -> Void

    @Environment(\.scenePhase) private var scenePhase

    @State private var tracker = OnboardingScreenTracker(.scheduleSession)
    @State private var hour = 7
    @State private var minute = 0
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false
    /// True while the "Notifications are off" alert is visible. Drives
    /// the post-Settings auto-retry path: when the screen returns to
    /// `.active` after the user came back from Settings, we re-check
    /// authorization and proceed automatically if they enabled it.
    @State private var showNotificationAlert = false
    /// Set when the user taps "Open Settings". On scene reactivation we
    /// only retry the schedule when this is true — otherwise scene
    /// changes unrelated to the alert (e.g. notification banners) would
    /// trigger redundant checks.
    @State private var awaitingSettingsReturn = false

    init(
        onContinue: @escaping () -> Void,
        scheduleNotification: @escaping (Int, Int) async -> Void = { _, _ in }
    ) {
        self.onContinue = onContinue
        self.scheduleNotification = scheduleNotification
    }

    private var durationMin: Int { state.dailyMinutes ?? 30 }
    private var timeLabel: String { OnboardingEngine.format12h(hour: hour, minute: minute) }

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(spacing: 0) {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        HUDSectionLabel("FIRST PROTOCOL")

                        Text("When will you lock in tomorrow?")
                            .font(.custom(FontFamily.heading.rawValue, size: 24))
                            .tracking(-0.3)
                            .foregroundColor(AppColors.textPrimary)
                            .padding(.bottom, 6)

                        Text("Pick a time. The system will remind you.")
                            .font(.custom(FontFamily.body.rawValue, size: 15))
                            .foregroundColor(AppColors.textMuted)
                            .padding(.bottom, 18)

                        OnboardingHUDPanel(headerLabel: "SESSION TIME") {
                            VStack(spacing: 0) {
                                HStack(alignment: .center, spacing: 8) {
                                    Picker("Hour", selection: $hour) {
                                        ForEach(OnboardingData.scheduleHours, id: \.self) { h in
                                            Text(OnboardingEngine.pad(h))
                                                .foregroundColor(AppColors.textPrimary)
                                                .tag(h)
                                        }
                                    }
                                    .pickerStyle(.wheel)
                                    .frame(maxWidth: 120)
                                    .frame(height: 120)

                                    Text(":")
                                        .font(.custom(FontFamily.heading.rawValue, size: 28))
                                        .foregroundColor(SystemTokens.cyan)

                                    Picker("Minute", selection: $minute) {
                                        ForEach(OnboardingData.scheduleMinutes, id: \.self) { m in
                                            Text(OnboardingEngine.pad(m))
                                                .foregroundColor(AppColors.textPrimary)
                                                .tag(m)
                                        }
                                    }
                                    .pickerStyle(.wheel)
                                    .frame(maxWidth: 120)
                                    .frame(height: 120)
                                }
                                .frame(maxWidth: .infinity)

                                VStack(spacing: 4) {
                                    Text(timeLabel)
                                        .font(.custom(FontFamily.heading.rawValue, size: 22))
                                        .tracking(-0.3)
                                        .foregroundColor(SystemTokens.cyan)
                                    Text("Duration: \(durationMin) min")
                                        .font(.custom(FontFamily.display.rawValue, size: 9))
                                        .tracking(1.6)
                                        .foregroundColor(SystemTokens.textMuted)
                                }
                                .padding(.top, 14)
                            }
                        }
                        .padding(.bottom, 12)

                        Text("7:00 AM – 8:00 AM is the most popular time slot.")
                            .font(.custom(FontFamily.body.rawValue, size: 13))
                            .foregroundColor(SystemTokens.textMuted)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 8)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 24)
                    .padding(.bottom, 32)
                }

                VStack {
                    PrimaryButton("> SCHEDULE SESSION", action: handleConfirm)
                        .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 40)
                .background(AppColors.background)
            }
            .opacity(screenOpacity)
        }
        .onAppear {
            tracker.didAppear()
            withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 1 }
        }
        .onDisappear { tracker.didDisappear() }
        .onChange(of: scenePhase) { _, newPhase in
            // User came back from iOS Settings — if they enabled
            // notifications, retry the schedule and advance.
            guard newPhase == .active, awaitingSettingsReturn else { return }
            awaitingSettingsReturn = false
            Task { await retryAfterSettingsReturn() }
        }
        .alert("Notifications are off", isPresented: $showNotificationAlert) {
            Button("Open Settings") {
                awaitingSettingsReturn = true
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
                // Don't advance — wait for the user to come back. The
                // `.onChange(of: scenePhase)` handler retries.
            }
            Button("Continue Without Reminder", role: .cancel) {
                // User explicitly opted out — proceed without scheduling.
                OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
                    "screen": OnboardingRoute.scheduleSession.rawValue,
                    "notifications_denied_continued": true,
                ])
                fadeAndContinue()
            }
        } message: {
            Text("Daily reminders keep the habit alive. Enable them in Settings — we'll schedule one for \(timeLabel) as soon as you do.")
        }
    }

    // MARK: - Confirm flow

    private func handleConfirm() {
        guard !isAdvancing else { return }
        isAdvancing = true
        HapticsService.shared.medium()

        let stored = "\(OnboardingEngine.pad(hour)):\(OnboardingEngine.pad(minute))"
        state.setScheduledSessionTime(stored)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.scheduleSession.rawValue,
            "answer": stored,
            "duration_min": durationMin,
        ])

        Task { await confirmWithAuthCheck() }
    }

    /// Branch on the current notification authorization status:
    ///  - granted → schedule and advance
    ///  - notDetermined → fire system prompt, schedule if granted, advance
    ///    regardless (silent skip on decline matches platform conventions
    ///    for the first denial)
    ///  - denied → surface the "give them another chance" alert
    private func confirmWithAuthCheck() async {
        let status = await NotificationService.shared.currentAuthorizationStatus()
        switch status {
        case .authorized, .provisional, .ephemeral:
            await scheduleNotification(hour, minute)
            await MainActor.run { fadeAndContinue() }

        case .notDetermined:
            let granted = await NotificationService.shared.requestAuthorization()
            if granted {
                await scheduleNotification(hour, minute)
            }
            await MainActor.run { fadeAndContinue() }

        case .denied:
            await MainActor.run {
                isAdvancing = false  // let them re-tap if they cancel the alert
                showNotificationAlert = true
            }

        @unknown default:
            await MainActor.run { fadeAndContinue() }
        }
    }

    /// Called when scenePhase returns to `.active` after the user tapped
    /// "Open Settings" on the alert. If they enabled notifications, we
    /// schedule the reminder and advance automatically — no second tap
    /// of Schedule Session required.
    private func retryAfterSettingsReturn() async {
        let status = await NotificationService.shared.currentAuthorizationStatus()
        switch status {
        case .authorized, .provisional, .ephemeral:
            await scheduleNotification(hour, minute)
            await MainActor.run { fadeAndContinue() }
        default:
            // Still denied (or notDetermined again somehow) — leave them
            // on the screen so they can tap again or cancel out.
            await MainActor.run { isAdvancing = false }
        }
    }

    private func fadeAndContinue() {
        withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
    }
}
