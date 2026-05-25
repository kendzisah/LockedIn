import SwiftUI
import DesignKit

/// CommitmentScreen — Step 23: typed-out commitment pledge with a pulsing
/// CTA after a 7.2s reveal sequence.
///
/// Port of `screens/CommitmentScreen.tsx`.
struct CommitmentScreen: View {
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.commitment)
    @State private var screenOpacity: Double = 1
    @State private var blockOpacities: [Double] = Array(repeating: 0, count: OnboardingData.commitmentBlocks.count)
    @State private var ctaOpacity: Double = 0
    @State private var pulseGlow: Double = 0.6
    @State private var isAdvancing = false

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(spacing: 0) {
                VStack(spacing: 24) {
                    ForEach(Array(OnboardingData.commitmentBlocks.enumerated()), id: \.element.id) { idx, block in
                        VStack(spacing: 0) {
                            ForEach(0..<block.lines.count, id: \.self) { i in
                                let line = block.lines[i]
                                Text(line.text)
                                    .font(.custom(line.bold ? FontFamily.heading.rawValue : FontFamily.bodyMedium.rawValue, size: line.bold ? 22 : 18))
                                    .tracking(line.bold ? -0.2 : 0)
                                    .lineSpacing(line.bold ? 6 : 6)
                                    .foregroundColor(line.color)
                                    .multilineTextAlignment(.center)
                            }
                        }
                        .opacity(blockOpacities[idx])
                    }
                }
                .padding(.horizontal, 32)
                .frame(maxHeight: .infinity, alignment: .center)

                Button(action: handleCommit) {
                    Text("I'M READY TO WORK")
                        .font(.custom(FontFamily.heading.rawValue, size: 18))
                        .tracking(0.5)
                        .foregroundColor(AppColors.textPrimary)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .padding(.vertical, 18)
                        .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.42))
                        .overlay(
                            RoundedRectangle(cornerRadius: 28)
                                .stroke(Color(.sRGB, red: 120/255, green: 160/255, blue: 255/255, opacity: 0.55), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 28))
                        .shadow(color: AppColors.primary.opacity(pulseGlow), radius: 24)
                }
                .opacity(ctaOpacity)
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
            }
            .opacity(screenOpacity)
        }
        .onAppear {
            tracker.didAppear()
            for (idx, block) in OnboardingData.commitmentBlocks.enumerated() {
                DispatchQueue.main.asyncAfter(deadline: .now() + block.delay) {
                    withAnimation(.easeOut(duration: 0.7)) {
                        blockOpacities[idx] = 1
                    }
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + OnboardingData.commitmentCTADelay) {
                withAnimation(.easeOut(duration: 0.6)) { ctaOpacity = 1 }
                withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
                    pulseGlow = 1.0
                }
            }
        }
        .onDisappear { tracker.didDisappear() }
    }

    private func handleCommit() {
        guard !isAdvancing else { return }
        isAdvancing = true
        HapticsService.shared.heavy()
        OnboardingAnalytics.track(OnboardingAnalytics.screenViewed, properties: [
            "screen": OnboardingRoute.commitment.rawValue,
            "step": OnboardingRoute.commitment.step,
            "committed": true,
        ])
        withAnimation(.easeOut(duration: 0.35)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { onContinue() }
    }
}
