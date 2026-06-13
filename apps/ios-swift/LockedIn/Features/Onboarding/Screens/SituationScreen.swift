import SwiftUI
import DesignKit

/// SituationScreen — Step 5: current life stage single-select.
///
/// Port of `screens/SituationQuizScreen.tsx`. Route name `Situation`
/// matches `OnboardingStackParamList`.
struct SituationScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.situation)
    @State private var selected: Situation? = nil
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("CURRENT STATUS")

                TypingText(
                    "What's your situation right now?",
                    charDelay: 0.022,
                    startDelay: 0.2,
                    reserveSpace: true
                )
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 8)

                Text("The system adapts to where you are — not where you pretend to be.")
                    .font(.custom(FontFamily.body.rawValue, size: 15))
                    .lineSpacing(7)
                    .foregroundColor(AppColors.textMuted)
                    .padding(.bottom, 28)

                VStack(spacing: 8) {
                    ForEach(OnboardingData.situationOptions) { opt in
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
        }
        .onAppear {
            tracker.didAppear()
            withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 1 }
        }
        .onDisappear { tracker.didDisappear() }
    }

    private func handleSelect(_ value: Situation) {
        guard !isAdvancing else { return }
        selected = value
        state.setSituation(value)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.situation.rawValue,
            "answer": value.rawValue,
        ])
        HapticsService.shared.light()
        isAdvancing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
        }
    }
}
