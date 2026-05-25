import SwiftUI
import DesignKit

/// WhyNowScreen — Step 11: motivation reason single-select.
/// Selected value drives notification copy after onboarding.
///
/// Port of `screens/WhyNowQuizScreen.tsx`. Route name `WhyNow`.
struct WhyNowScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.whyNow)
    @State private var selected: WhyNow? = nil
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("CORE DRIVE")

                Text("Why now? What made you download this today?")
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 24)

                VStack(spacing: 8) {
                    ForEach(OnboardingData.whyNowOptions) { opt in
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

    private func handleSelect(_ value: WhyNow) {
        guard !isAdvancing else { return }
        selected = value
        state.setWhyNow(value)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.whyNow.rawValue,
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
