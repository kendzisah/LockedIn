import SwiftUI
import DesignKit

/// TriggersScreen — Step 8: multi-select up to 3 distraction triggers.
///
/// Port of `screens/TriggersQuizScreen.tsx`. Route name `Triggers`.
struct TriggersScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.triggers)
    @State private var selected: [Trigger] = []
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("THREAT ANALYSIS")

                TypingText(
                    "When do you lose focus?",
                    charDelay: 0.022,
                    startDelay: 0.2,
                    reserveSpace: true
                )
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 8)

                Text("Select up to 3. The system learns your patterns.")
                    .font(.custom(FontFamily.body.rawValue, size: 15))
                    .foregroundColor(AppColors.textMuted)
                    .padding(.bottom, 24)

                VStack(spacing: 8) {
                    ForEach(OnboardingData.triggerOptions) { opt in
                        QuizOptionRow(
                            label: opt.label,
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

    private func toggle(_ value: Trigger) {
        guard !isAdvancing else { return }
        HapticsService.shared.light()
        if let idx = selected.firstIndex(of: value) {
            selected.remove(at: idx)
        } else if selected.count >= OnboardingData.triggersMaxSelect {
            selected = Array(selected.dropFirst()) + [value]
        } else {
            selected.append(value)
        }
    }

    private func handleContinue() {
        guard !isAdvancing, !selected.isEmpty else { return }
        isAdvancing = true
        HapticsService.shared.medium()
        state.setTriggers(selected)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.triggers.rawValue,
            "answer": selected.map { $0.rawValue }.joined(separator: ", "),
        ])
        withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
    }
}
