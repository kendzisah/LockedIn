import SwiftUI
import DesignKit

/// StatRevealScreen — Step 14: character-creation moment.
///
/// **Letter-tier rewrite (Wave 1, Agent 3):** OVR = `F-`, all five stats =
/// `F-` (counters at zero). Pre/post-onboarding stat representation now
/// matches the profile tab's `SystemStatsCard` letter-tier UI.
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
    @State private var letterOpacity: [Double] = Array(repeating: 0, count: 5)
    @State private var isAdvancing = false

    /// Zero-XP rank — mirrors `RankHelpers.rankFromXp(0)` (NPC).
    private var startingRank: RankTier { RankHelpers.rankFromXp(0) }
    /// Next rank ladder rung above NPC.
    private var nextRank: RankTier? {
        RankHelpers.nextRankByXp(0)
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
                // Stagger letter-tier reveals.
                for idx in 0..<OnboardingData.statRevealRows.count {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4 + Double(idx) * 0.1) {
                        withAnimation(.easeOut(duration: 0.5)) {
                            letterOpacity[idx] = 1
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

    /// Starting tier — counter = 0 across all axes ⇒ `F-`.
    private var startingTier: StatTier { .fMinus }

    private var statusPanel: some View {
        OnboardingHUDPanel(headerLabel: "STATUS") {
            HStack(spacing: 16) {
                ZStack {
                    Rectangle()
                        .fill(startingTier.color.opacity(0.05))
                        .overlay(
                            Rectangle().stroke(startingTier.color.opacity(0.3), lineWidth: 1)
                        )
                    VStack(spacing: 2) {
                        Text("OVR")
                            .font(.custom(FontFamily.display.rawValue, size: 10))
                            .tracking(1.6)
                            .foregroundColor(AppColors.textMuted)
                        Text(startingTier.rawValue)
                            .font(.custom(FontFamily.headingBold.rawValue, size: 44))
                            .monospacedDigit()
                            .foregroundColor(startingTier.color)
                            .shadow(color: startingTier.color.opacity(0.6), radius: 10)
                    }
                }
                .frame(width: 96, height: 96)

                VStack(alignment: .leading, spacing: 4) {
                    Text(startingRank.name.uppercased())
                        .font(.custom(FontFamily.heading.rawValue, size: 22))
                        .foregroundColor(startingRank.color)
                    Text("Day 0 — Your character starts at F-.")
                        .font(.custom(FontFamily.body.rawValue, size: 11))
                        .foregroundColor(AppColors.textMuted)
                        .lineLimit(2)
                    Text("Complete missions and sessions to rank up.")
                        .font(.custom(FontFamily.body.rawValue, size: 10))
                        .foregroundColor(AppColors.textMuted)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var statsPanel: some View {
        OnboardingHUDPanel(headerLabel: "STATS") {
            VStack(spacing: 6) {
                ForEach(Array(OnboardingData.statRevealRows.enumerated()), id: \.element.id) { idx, row in
                    HStack(spacing: 12) {
                        Text(row.abbr)
                            .font(.custom(FontFamily.display.rawValue, size: 10))
                            .tracking(1.6)
                            .foregroundColor(AppColors.textMuted)
                            .frame(width: 36, alignment: .leading)
                        Text(startingTier.rawValue)
                            .font(.custom(FontFamily.headingBold.rawValue, size: 22))
                            .monospacedDigit()
                            .foregroundColor(startingTier.color)
                            .frame(width: 44, alignment: .leading)
                        Spacer()
                        // Show the next-tier target per the actual axis (FOC/SOC
                        // have different first-rung thresholds than DIS/EXE/CON).
                        Text(StatTierTable.progressLabel(counter: 0, kind: counterKind(for: row.abbr)))
                            .font(.custom(FontFamily.body.rawValue, size: 12))
                            .monospacedDigit()
                            .foregroundColor(AppColors.textSecondary)
                    }
                    .padding(.vertical, 4)
                    .opacity(letterOpacity[idx])
                }
            }
        }
    }

    /// Maps the stat row abbreviation to the matching `StatCounterKind` so
    /// `StatTierTable.progressLabel` can render the right "0/N to F" copy per
    /// axis (e.g. FOC's first rung is 30, SOC's is 2 — not all stats have F at 1).
    private func counterKind(for abbr: String) -> StatCounterKind {
        switch abbr {
        case "DIS": return .discipline
        case "FOC": return .focus
        case "EXE": return .execution
        case "CON": return .consistency
        case "SOC": return .social
        default:    return .execution
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
                        Text(" (\(nextRank?.minXp.formatted(.number.notation(.compactName)) ?? "0") XP)")
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
