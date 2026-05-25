import SwiftUI
import DesignKit

/// SystemAnalysisScreen — Step 13: terminal-style processing.
/// Auto-advances to StatReveal after the final line lands (with a ~5.5s
/// safety ceiling).
///
/// Port of `screens/SystemAnalysisScreen.tsx`.
struct SystemAnalysisScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.systemAnalysis)
    @State private var screenOpacity: Double = 0
    @State private var showFinal = false
    @State private var isAdvancing = false

    private var goalText: String {
        OnboardingEngine.humanizedGoal(state.primaryGoal)
    }

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(alignment: .leading, spacing: 0) {
                HUDSectionLabel("ANALYZING")

                VStack(alignment: .leading, spacing: 0) {
                    TerminalLine("> Processing answers...", delay: 0.0, showCheck: false)
                    TerminalLine("> Goal: \(goalText)", delay: 1.0)
                    TerminalLine("> Weakness scan: \(state.selectedWeaknesses.count) flagged", delay: 1.5)
                    TerminalLine("> Trigger map: \(state.triggers.isEmpty ? "pending" : "loaded")", delay: 2.0)
                    TerminalLine("> Morning pattern: \(state.morningRoutine == nil ? "pending" : "flagged")", delay: 2.5)
                    TerminalLine("> Calibrating difficulty...", delay: 3.0)
                    TerminalLine("> Building mission set...", delay: 3.5)
                    TerminalLine(
                        "> SYSTEM READY",
                        delay: 4.0,
                        color: SystemTokens.cyan
                    ) {
                        showFinal = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { advance() }
                    }

                    if showFinal {
                        Text("Initializing your character...")
                            .font(.custom(FontFamily.body.rawValue, size: 13))
                            .foregroundColor(SystemTokens.textMuted)
                            .padding(.top, 18)
                    }
                }
                .padding(.top, 8)

                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 48)
            .opacity(screenOpacity)
        }
        .onAppear {
            tracker.didAppear()
            withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 1 }
            // Hard safety ceiling so we never strand the user.
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.5) {
                advance()
            }
        }
        .onDisappear { tracker.didDisappear() }
    }

    private func advance() {
        guard !isAdvancing else { return }
        isAdvancing = true
        withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
    }
}
