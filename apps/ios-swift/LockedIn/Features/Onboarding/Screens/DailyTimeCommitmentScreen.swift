import SwiftUI
import DesignKit

/// DailyTimeCommitmentScreen — Step 10: daily focus minutes single-select.
///
/// Port of `screens/DailyTimeCommitmentScreen.tsx`. Renders a 3-column
/// grid of cards (vs. the standard option row layout).
struct DailyTimeCommitmentScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.dailyTimeCommitment)
    @State private var selected: Int? = nil
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
    ]

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

                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(OnboardingData.dailyMinuteOptions) { opt in
                        Button(action: { handleSelect(opt) }) {
                            VStack(spacing: 4) {
                                Text(opt.primary)
                                    .font(.custom(FontFamily.heading.rawValue, size: 30))
                                    .tracking(-1)
                                    .foregroundColor(selected == opt.minutes ? SystemTokens.glowAccent : AppColors.textPrimary)
                                    .shadow(color: selected == opt.minutes ? SystemTokens.glowAccent : .clear, radius: 8)
                                Text(opt.unit)
                                    .font(.custom(FontFamily.display.rawValue, size: 9))
                                    .tracking(1.6)
                                    .foregroundColor(selected == opt.minutes ? SystemTokens.glowAccent : SystemTokens.textMuted)
                            }
                            .frame(maxWidth: .infinity)
                            .aspectRatio(1, contentMode: .fit)
                            .background(
                                selected == opt.minutes
                                ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.14)
                                : SystemTokens.panelBg
                            )
                            .overlay(
                                Rectangle()
                                    .stroke(
                                        selected == opt.minutes ? SystemTokens.glowAccent : SystemTokens.panelBorder,
                                        lineWidth: 1
                                    )
                            )
                            .overlay(alignment: .leading) {
                                Rectangle()
                                    .fill(selected == opt.minutes ? SystemTokens.glowAccent : Color.white.opacity(0.06))
                                    .frame(width: 2)
                            }
                        }
                        .buttonStyle(PressOpacityButtonStyle())
                    }
                }

                Text("Most users start with 30 minutes.")
                    .font(.custom(FontFamily.body.rawValue, size: 13))
                    .foregroundColor(SystemTokens.textMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 20)

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

    private func handleSelect(_ opt: OnboardingData.DailyMinuteOption) {
        guard !isAdvancing else { return }
        selected = opt.minutes
        state.setDailyMinutes(opt.minutes)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.dailyTimeCommitment.rawValue,
            "answer": "\(opt.minutes) min",
            "daily_minutes": opt.minutes,
        ])
        HapticsService.shared.light()
        isAdvancing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
        }
    }
}
