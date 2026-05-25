import SwiftUI
import DesignKit

/// GoalQuizScreen — Step 6: primary goal single-select.
/// Persisted value drives mission generation downstream (slot 2 pool).
///
/// Port of `screens/GoalQuizScreen.tsx`.
struct GoalQuizScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.goalQuiz)
    @State private var selected: String? = nil
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("PRIMARY OBJECTIVE")

                TypingText(
                    "What are you building toward?",
                    charDelay: 0.022,
                    startDelay: 0.2,
                    reserveSpace: true
                )
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 8)

                Text("This determines your daily missions and stat growth.")
                    .font(.custom(FontFamily.body.rawValue, size: 15))
                    .foregroundColor(AppColors.textMuted)
                    .padding(.bottom, 24)

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 8) {
                        ForEach(OnboardingData.goalOptions) { opt in
                            QuizOptionRow(
                                label: opt.value,
                                systemIcon: opt.icon,
                                isSelected: selected == opt.value,
                                action: { handleSelect(opt.value) }
                            )
                        }
                    }
                }
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

    private func handleSelect(_ value: String) {
        guard !isAdvancing else { return }
        selected = value
        state.setPrimaryGoal(value)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.goalQuiz.rawValue,
            "answer": value,
        ])
        HapticsService.shared.light()
        isAdvancing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
        }
    }
}
