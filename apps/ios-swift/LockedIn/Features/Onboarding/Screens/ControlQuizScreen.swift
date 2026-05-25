import SwiftUI
import DesignKit

/// ControlQuizScreen — Step 7: weakness multi-select (max 2).
///
/// Port of `screens/ControlQuizScreen.tsx`.
struct ControlQuizScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.controlQuiz)
    @State private var selected: [String] = []
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("VULNERABILITIES")

                TypingText(
                    "What holds you back?",
                    charDelay: 0.022,
                    startDelay: 0.2,
                    reserveSpace: true
                )
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 8)

                Text("Select up to 2. The system will target these.")
                    .font(.custom(FontFamily.body.rawValue, size: 15))
                    .foregroundColor(AppColors.textMuted)
                    .padding(.bottom, 24)

                VStack(spacing: 8) {
                    ForEach(OnboardingData.weaknessOptions) { opt in
                        QuizOptionRow(
                            label: opt.value,
                            systemIcon: opt.icon,
                            isSelected: selected.contains(opt.value),
                            action: { toggle(opt.value) }
                        )
                    }
                }

                Spacer()

                PrimaryButton(
                    selected.isEmpty ? "SELECT AT LEAST ONE" : "> CONTINUE",
                    isEnabled: !selected.isEmpty,
                    action: handleContinue
                )
                .frame(maxWidth: .infinity)
                .padding(.top, 12)
                .padding(.bottom, 8)
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

    private func toggle(_ value: String) {
        guard !isAdvancing else { return }
        HapticsService.shared.light()
        if let idx = selected.firstIndex(of: value) {
            selected.remove(at: idx)
        } else if selected.count >= OnboardingData.weaknessMaxSelect {
            // Drop oldest then append.
            selected = Array(selected.dropFirst()) + [value]
        } else {
            selected.append(value)
        }
    }

    private func handleContinue() {
        guard !isAdvancing, !selected.isEmpty else { return }
        isAdvancing = true
        HapticsService.shared.medium()
        state.setWeaknesses(selected)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.controlQuiz.rawValue,
            "answer": selected.joined(separator: ", "),
        ])
        withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
    }
}
