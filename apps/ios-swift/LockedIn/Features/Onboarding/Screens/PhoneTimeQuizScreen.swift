import SwiftUI
import DesignKit

/// PhoneTimeQuizScreen — Step 2: phone-usage band single-select.
/// Drives the Wake-Up Call math on the next screen.
///
/// Port of `screens/PhoneTimeQuizScreen.tsx`.
struct PhoneTimeQuizScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.phoneTimeQuiz)
    @State private var selected: String? = nil
    @State private var screenOpacity: Double = 0
    @State private var isAdvancing = false

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("DIAGNOSTICS")

                TypingText(
                    "How many hours do you spend on your phone each day?",
                    charDelay: 0.018,
                    startDelay: 0.2,
                    reserveSpace: true
                )
                    .font(.custom(FontFamily.heading.rawValue, size: 24))
                    .tracking(-0.3)
                    .lineSpacing(6)
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 8)

                Text("Be honest. The system needs accurate data.")
                    .font(.custom(FontFamily.body.rawValue, size: 15))
                    .lineSpacing(7)
                    .foregroundColor(AppColors.textMuted)
                    .padding(.bottom, 24)

                VStack(spacing: 8) {
                    ForEach(OnboardingData.phoneTimeOptions) { opt in
                        HUDOptionCard(
                            isSelected: selected == opt.value,
                            action: { handleSelect(opt.value) }
                        ) {
                            HStack(spacing: 12) {
                                PhoneBatteryIcon(level: opt.battery)
                                    .frame(width: 28)
                                Text(opt.label)
                                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 15))
                                    .foregroundColor(SystemTokens.textPrimary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                }

                Spacer()

                HStack {
                    Spacer()
                    Button(action: { advance(with: "unknown") }) {
                        Text("I DON'T KNOW")
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                            .tracking(0.5)
                            .foregroundColor(AppColors.textSecondary)
                    }
                    Spacer()
                }
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

    private func handleSelect(_ value: String) {
        guard !isAdvancing else { return }
        selected = value
        HapticsService.shared.light()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            advance(with: value)
        }
    }

    private func advance(with value: String) {
        guard !isAdvancing else { return }
        isAdvancing = true
        state.setPhoneUsage(value)
        OnboardingAnalytics.track(OnboardingAnalytics.answerSubmitted, properties: [
            "screen": OnboardingRoute.phoneTimeQuiz.rawValue,
            "answer": value,
        ])
        withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
    }
}

private struct PhoneBatteryIcon: View {
    let level: Double

    var body: some View {
        let clamped = max(0.05, min(1.0, level))
        let color: Color = {
            if clamped > 0.6 { return SystemTokens.green }
            if clamped > 0.3 { return SystemTokens.gold }
            return SystemTokens.red
        }()
        Canvas { ctx, _ in
            let w: CGFloat = 14, h: CGFloat = 22
            let pad: CGFloat = 2
            let innerW = w - pad * 2
            let innerH = h - pad * 2 - 2
            let fillH = innerH * clamped
            // notch
            let notch = CGRect(x: w/2 - 2, y: 1, width: 4, height: 1)
            ctx.fill(Path(roundedRect: notch, cornerRadius: 0.5), with: .color(color.opacity(0.6)))
            // outline
            let outline = CGRect(x: 0.5, y: 2.5, width: w - 1, height: h - 3)
            ctx.stroke(Path(roundedRect: outline, cornerRadius: 3), with: .color(color), lineWidth: 1.2)
            // fill
            let fill = CGRect(
                x: pad,
                y: pad + 2 + (innerH - fillH),
                width: innerW,
                height: fillH
            )
            ctx.fill(Path(roundedRect: fill, cornerRadius: 1.5), with: .color(color.opacity(0.85)))
        }
        .frame(width: 14, height: 22)
    }
}
