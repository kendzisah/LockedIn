import SwiftUI
import DesignKit

/// MorningRoutineScreen — Step 9: first wake-up action single-select with
/// a brief system-response flash before advancing.
///
/// Port of `screens/MorningRoutineQuizScreen.tsx`. Route name
/// `MorningRoutine`.
struct MorningRoutineScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.morningRoutine)
    @State private var selected: MorningRoutine? = nil
    @State private var flash: OnboardingData.MorningFlash? = nil
    @State private var flashOpacity: Double = 0
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    var body: some View {
        ZStack(alignment: .bottom) {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("DAILY PATTERN")

                TypingText(
                    "What's the first thing you do when you wake up?",
                    charDelay: 0.018,
                    startDelay: 0.2,
                    reserveSpace: true
                )
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 24)

                VStack(spacing: 8) {
                    ForEach(OnboardingData.morningRoutineOptions) { opt in
                        QuizOptionRow(
                            label: opt.label,
                            systemIcon: opt.icon,
                            isSelected: selected == opt.value,
                            action: { handleSelect(opt.value) }
                        )
                    }
                }
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 32)
            .opacity(screenOpacity)

            if let flash {
                Text(flash.text)
                    .font(.custom(FontFamily.display.rawValue, size: 10))
                    .tracking(1.6)
                    .foregroundColor(flash.color)
                    .shadow(color: flash.color, radius: 8)
                    .opacity(flashOpacity)
                    .padding(.bottom, 80)
            }
        }
        .onAppear {
            tracker.didAppear()
            withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 1 }
        }
        .onDisappear { tracker.didDisappear() }
    }

    private func handleSelect(_ value: MorningRoutine) {
        guard !isAdvancing else { return }
        isAdvancing = true
        selected = value
        state.setMorningRoutine(value)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.morningRoutine.rawValue,
            "answer": value.rawValue,
        ])
        HapticsService.shared.light()

        flash = OnboardingData.morningFlash(for: value)
        withAnimation(.easeOut(duration: 0.25)) { flashOpacity = 1 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            withAnimation(.easeOut(duration: 0.25)) { flashOpacity = 0 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
            withAnimation(.easeOut(duration: 0.35)) { screenOpacity = 0 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { onContinue() }
        }
    }
}
