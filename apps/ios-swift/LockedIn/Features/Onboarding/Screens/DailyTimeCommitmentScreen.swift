import SwiftUI
import DesignKit

/// DailyTimeCommitmentScreen — Step 10: daily focus minutes single-select.
///
/// Port of `screens/DailyTimeCommitmentScreen.tsx`. Renders a wheel picker
/// with the 6 preset durations (15 / 30 / 45 / 1h / 1.5h / 2h) inside a HUD
/// glass panel + an explicit Continue button. The wheel matches the
/// duration-picker UX used in the Session feature so the visual language
/// stays consistent across the app.
struct DailyTimeCommitmentScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.dailyTimeCommitment)
    @State private var selectedMinutes: Int = 30
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    private var options: [OnboardingData.DailyMinuteOption] {
        OnboardingData.dailyMinuteOptions
    }

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("SESSION PROTOCOL")

                Text("How many minutes will you lock in each day?")
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 8)

                Text("Start where you can be consistent. The system adapts.")
                    .font(.custom(FontFamily.body.rawValue, size: 15))
                    .foregroundColor(AppColors.textMuted)
                    .padding(.bottom, 24)

                wheelPanel
                    .padding(.bottom, 16)

                Text("Most users start with 30 minutes.")
                    .font(.custom(FontFamily.body.rawValue, size: 13))
                    .foregroundColor(SystemTokens.textMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.bottom, 24)

                PrimaryButton("> CONTINUE", action: handleContinue)
                    .frame(maxWidth: .infinity)

                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 32)
            .opacity(screenOpacity)
        }
        .onAppear {
            // Seed the wheel from persisted state if available.
            if let saved = state.dailyMinutes,
               options.contains(where: { $0.minutes == saved }) {
                selectedMinutes = saved
            }
            tracker.didAppear()
            withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 1 }
        }
        .onDisappear { tracker.didDisappear() }
        .onChange(of: selectedMinutes) { _, _ in
            HapticsService.shared.selectionChanged()
        }
    }

    // MARK: - Wheel panel

    private var wheelPanel: some View {
        ZStack {
            // HUD glass surface — matches DurationPickerSheet's idiom:
            // dark panel background + 2pt cyan left-border accent.
            HStack(spacing: 0) {
                Rectangle()
                    .fill(SystemTokens.glowAccent.opacity(0.45))
                    .frame(width: 2)
                Color.white.opacity(0.02)
            }
            .overlay(
                Rectangle()
                    .stroke(SystemTokens.panelBorder, lineWidth: 1)
            )

            Picker("Daily minutes", selection: $selectedMinutes) {
                ForEach(options) { opt in
                    Text("\(opt.primary) \(opt.unit)")
                        .font(.custom(FontFamily.heading.rawValue, size: 28))
                        .foregroundColor(AppColors.textPrimary)
                        .tag(opt.minutes)
                }
            }
            .pickerStyle(.wheel)
            .frame(height: 180)
            .clipped()
            .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Actions

    private func handleContinue() {
        guard !isAdvancing else { return }
        state.setDailyMinutes(selectedMinutes)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.dailyTimeCommitment.rawValue,
            "answer": "\(selectedMinutes) min",
            "daily_minutes": selectedMinutes,
        ])
        HapticsService.shared.light()
        isAdvancing = true
        withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
    }
}
