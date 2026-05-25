import SwiftUI
import DesignKit

/// StatRevealScreen — Step 14: character-creation moment.
/// OVR=1, all five stats=1, plus build summary inside HUD panels.
/// Button is gated behind a 2s absorption delay.
///
/// Port of `screens/StatRevealScreen.tsx`.
struct StatRevealScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.statReveal)
    @State private var screenOpacity: Double = 1
    @State private var panelOpacity: Double = 0
    @State private var panelOffset: CGFloat = 20
    @State private var buttonOpacity: Double = 0
    @State private var barFills: [Double] = Array(repeating: 0, count: 5)
    @State private var isAdvancing = false

    /// Day-zero rank — mirrors `RankHelpers.rankFromStreak(0)` (NPC).
    private var startingRank: RankTier { RankHelpers.rankFromStreak(0) }
    /// Next rank ladder rung above NPC.
    private var nextRank: RankTier? {
        RankHelpers.nextRank(streak: 0)
    }

    private var commitmentLabel: String {
        let m = state.dailyMinutes ?? 30
        if m >= 60 {
            let h = Double(m) / 60.0
            return h.truncatingRemainder(dividingBy: 1) == 0
                ? "\(Int(h)) h/day"
                : "\(String(format: "%g", h)) h/day"
        }
        return "\(m) min/day"
    }

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    TypingText("// SYSTEM INITIALIZED", charDelay: 0.028)
                        .font(.custom(FontFamily.display.rawValue, size: 9))
                        .tracking(1.8)
                        .foregroundColor(SystemTokens.cyan)
                        .shadow(color: SystemTokens.cyan, radius: 8)
                    LinearGradient(
                        colors: [SystemTokens.cyan, .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(height: 1)
                    .padding(.top, 6)

                    VStack(spacing: 10) {
                        statusPanel
                        statsPanel
                        buildPanel
                    }
                    .padding(.top, 16)
                    .opacity(panelOpacity)
                    .offset(y: panelOffset)
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)

                Spacer(minLength: 0)

                VStack {
                    PrimaryButton("> BEGIN MY EVOLUTION", action: handleBegin)
                        .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .padding(.bottom, 8)
                .opacity(buttonOpacity)
            }
            .opacity(screenOpacity)
        }
        .onAppear {
            tracker.didAppear()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                withAnimation(.easeOut(duration: 0.6)) {
                    panelOpacity = 1
                    panelOffset = 0
                }
                // Stagger stat-bar fills.
                for idx in 0..<OnboardingData.statRevealRows.count {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4 + Double(idx) * 0.1) {
                        withAnimation(.easeOut(duration: 0.5)) {
                            barFills[idx] = Double(OnboardingData.startingStat) / Double(OnboardingData.maxStat)
                        }
                    }
                }
            }
            // CTA after 1000 + 400 + 5*100 + 500 + 2000 = 4400ms.
            DispatchQueue.main.asyncAfter(deadline: .now() + 4.4) {
                withAnimation(.easeOut(duration: 0.5)) { buttonOpacity = 1 }
            }
        }
        .onDisappear { tracker.didDisappear() }
    }

    private var statusPanel: some View {
        OnboardingHUDPanel(headerLabel: "STATUS") {
            HStack(spacing: 16) {
                ZStack {
                    Rectangle()
                        .fill(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.04))
                        .overlay(
                            Rectangle().stroke(SystemTokens.glowAccent.opacity(0.3), lineWidth: 1)
                        )
                    VStack(spacing: 0) {
                        Text("OVR")
                            .font(.custom(FontFamily.mono.rawValue, size: 10))
                            .tracking(1.6)
                            .foregroundColor(SystemTokens.textMuted)
                        CountUpNumber(value: 1, duration: 0.9, startDelay: 0.2)
                            .font(.custom(FontFamily.heading.rawValue, size: 56))
                            .foregroundColor(AppColors.textPrimary)
                            .shadow(color: SystemTokens.glowAccent, radius: 10)
                    }
                }
                .frame(width: 96, height: 96)

                VStack(alignment: .leading, spacing: 4) {
                    Text(startingRank.name.uppercased())
                        .font(.custom(FontFamily.heading.rawValue, size: 22))
                        .foregroundColor(startingRank.color)
                    Text("Day 0")
                        .font(.custom(FontFamily.mono.rawValue, size: 11))
                        .tracking(1.4)
                        .foregroundColor(SystemTokens.textMuted)
                }
                Spacer()
            }
        }
    }

    private var statsPanel: some View {
        OnboardingHUDPanel(headerLabel: "STATS") {
            VStack(spacing: 4) {
                ForEach(Array(OnboardingData.statRevealRows.enumerated()), id: \.element.id) { idx, row in
                    HStack(spacing: 10) {
                        Text(row.abbr)
                            .font(.custom(FontFamily.mono.rawValue, size: 11))
                            .tracking(1.5)
                            .foregroundColor(SystemTokens.textSecondary)
                            .frame(width: 32, alignment: .leading)
                        GeometryReader { proxy in
                            ZStack(alignment: .leading) {
                                Rectangle().fill(Color.white.opacity(0.05))
                                Rectangle().fill(row.color)
                                    .frame(width: proxy.size.width * barFills[idx])
                            }
                        }
                        .frame(height: 6)
                        Text(String(OnboardingData.startingStat))
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 13))
                            .foregroundColor(AppColors.textPrimary)
                            .frame(width: 24, alignment: .trailing)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    private var buildPanel: some View {
        OnboardingHUDPanel(headerLabel: "BUILD") {
            VStack(spacing: 4) {
                buildLine("Goal", state.primaryGoal ?? "Build discipline")
                buildLine(
                    "Weakness",
                    state.selectedWeaknesses.isEmpty ? "Inconsistency" : state.selectedWeaknesses.joined(separator: " · ")
                )
                buildLine("Commitment", commitmentLabel)
                Rectangle()
                    .fill(Color.white.opacity(0.05))
                    .frame(height: 1)
                    .padding(.top, 8)
                HStack {
                    Text("XP: 0")
                        .font(.custom(FontFamily.bodyMedium.rawValue, size: 12))
                        .foregroundColor(AppColors.textPrimary)
                    Spacer()
                    HStack(spacing: 0) {
                        Text("Next rank ")
                            .font(.custom(FontFamily.bodyMedium.rawValue, size: 12))
                            .foregroundColor(AppColors.textPrimary)
                        Text((nextRank?.name ?? "MAX").uppercased())
                            .font(.custom(FontFamily.bodyMedium.rawValue, size: 12))
                            .foregroundColor(nextRank?.color ?? AppColors.textPrimary)
                        Text(" (Day \(nextRank?.minDays ?? 0))")
                            .font(.custom(FontFamily.body.rawValue, size: 12))
                            .foregroundColor(SystemTokens.textMuted)
                    }
                }
                .padding(.top, 8)
            }
        }
    }

    private func buildLine(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(label)
                .font(.custom(FontFamily.mono.rawValue, size: 11))
                .tracking(1.2)
                .foregroundColor(SystemTokens.textMuted)
                .frame(width: 96, alignment: .leading)
                .padding(.top, 2)
            Text(value)
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                .lineSpacing(5)
                .foregroundColor(AppColors.textPrimary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 4)
    }

    private func handleBegin() {
        guard !isAdvancing else { return }
        isAdvancing = true
        HapticsService.shared.heavy()
        withAnimation(.easeOut(duration: 0.35)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { onContinue() }
    }
}
