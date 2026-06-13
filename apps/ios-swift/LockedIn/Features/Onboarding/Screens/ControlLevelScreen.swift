import SwiftUI
import DesignKit

/// ControlLevelScreen — Step 12: self-rate control level. Sets starting
/// difficulty tier for the mission engine.
///
/// Port of `screens/ControlLevelScreen.tsx`.
struct ControlLevelScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.controlLevel)
    @State private var selected: ControlLevel? = nil
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("BASELINE ASSESSMENT")

                TypingText(
                    "How much control do you have over your daily habits?",
                    charDelay: 0.018,
                    startDelay: 0.2,
                    reserveSpace: true
                )
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 8)

                Text("This sets your starting difficulty.")
                    .font(.custom(FontFamily.body.rawValue, size: 15))
                    .foregroundColor(AppColors.textMuted)
                    .padding(.bottom, 24)

                VStack(spacing: 8) {
                    ForEach(OnboardingData.controlLevelOptions) { opt in
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

    private func handleSelect(_ value: ControlLevel) {
        guard !isAdvancing else { return }
        selected = value
        state.setControlLevel(value)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.controlLevel.rawValue,
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
