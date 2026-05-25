import SwiftUI
import DesignKit

/// AgeQuizScreen — Step 4: age band single-select.
/// Persisted value is the band midpoint.
///
/// Port of `screens/AgeQuizScreen.tsx`.
struct AgeQuizScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.ageQuiz)
    @State private var selected: Int? = nil
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("PLAYER PROFILE")

                TypingText(
                    "How old are you?",
                    charDelay: 0.022,
                    startDelay: 0.2,
                    reserveSpace: true
                )
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 8)

                Text("Your system calibrates to your stage of life.")
                    .font(.custom(FontFamily.body.rawValue, size: 15))
                    .foregroundColor(AppColors.textMuted)
                    .padding(.bottom, 24)

                VStack(spacing: 8) {
                    ForEach(OnboardingData.ageOptions) { opt in
                        QuizOptionRow(
                            label: opt.label,
                            systemIcon: nil,
                            isSelected: selected == opt.value,
                            action: { handleSelect(opt) }
                        )
                    }
                }
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 32)
            .opacity(screenOpacity)
        }
        .onAppear {
            tracker.didAppear()
            withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 1 }
        }
        .onDisappear { tracker.didDisappear() }
    }

    private func handleSelect(_ opt: OnboardingData.AgeOption) {
        guard !isAdvancing else { return }
        selected = opt.value
        state.setUserAge(opt.value)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.ageQuiz.rawValue,
            "answer": opt.label,
        ])
        HapticsService.shared.light()
        isAdvancing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
        }
    }
}
