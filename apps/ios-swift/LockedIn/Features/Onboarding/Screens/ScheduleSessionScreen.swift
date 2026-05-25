import SwiftUI
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
struct ScheduleSessionScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void
    /// Schedules the local "first session" reminder. Provided by the
    /// coordinator so this view stays UI-only.
    let scheduleNotification: (_ hour: Int, _ minute: Int) async -> Void

    @State private var tracker = OnboardingScreenTracker(.scheduleSession)
    @State private var hour = 7
    @State private var minute = 0
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

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
    }

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
        Task { await scheduleNotification(hour, minute) }

        withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
    }
}
