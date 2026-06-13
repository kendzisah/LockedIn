import SwiftUI
import DesignKit

/// BenefitReportScreen — Step 19: weekly grade-bar preview projecting the
/// user's stats at Day 90. Uses `OnboardingEngine.projectStats`.
///
/// Port of `screens/BenefitReportScreen.tsx`.
struct BenefitReportScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void
    @State private var tracker = OnboardingScreenTracker(.benefitReport)

    private var stats: [OnboardingEngine.ProjectedStat] {
        OnboardingEngine.projectStats(
            primaryGoal: state.primaryGoal,
            weaknesses: state.selectedWeaknesses
        )
    }

    /// Map a 0-100 projected `value` (legacy numeric scale from
    /// `OnboardingEngine.projectStats`) onto the new letter-tier ladder.
    /// 78 → A-, 72 → B+, 64 → B-, 58 → C+ etc. Keeps the visual progression
    /// monotonic without rebuilding the projection engine.
    private func projectedTier(forValue value: Int) -> StatTier {
        switch value {
        case 85...:      return .aPlus
        case 78..<85:    return .aMinus
        case 72..<78:    return .bPlus
        case 66..<72:    return .b
        case 60..<66:    return .bMinus
        case 54..<60:    return .cPlus
        case 48..<54:    return .c
        case 42..<48:    return .cMinus
        case 36..<42:    return .dPlus
        case 30..<36:    return .d
        case 24..<30:    return .dMinus
        case 18..<24:    return .fPlus
        case 12..<18:    return .f
        default:         return .fMinus
        }
    }

    /// OVR letter tier for the Day-90 projection — average of the 5 projected
    /// tier ordinals.
    private var projectedOvrTier: StatTier {
        OvrTier.compute(stats.map { projectedTier(forValue: $0.value) })
    }

    private var sessions: Int { 90 }
    private var minutes: Int { sessions * (state.dailyMinutes ?? 30) }

    private let statLabel: [OnboardingEngine.StatKey: String] = [
        .discipline:  "Discipline",
        .focus:       "Focus",
        .execution:   "Execution",
        .consistency: "Consistency",
        .social:      "Social",
    ]

    var body: some View {
        BenefitTemplate(
            panelLabel: "DAY 90 PROJECTION",
            headline: "THIS IS YOU IN 90 DAYS",
            headlineColor: AppColors.warning,
            body: "Show up daily and your stats compound around the goal you picked. This is your character at Day 90 — not a hypothetical, the projection from your answers.",
            callout: "If you stay locked in.",
            calloutColor: SystemTokens.purple,
            graphic: { reportCard },
            onContinue: onContinue
        )
        .onAppear { tracker.didAppear() }
        .onDisappear { tracker.didDisappear() }
    }

    private var reportCard: some View {
        VStack(spacing: 0) {
            Text("SYSTEM REPORT — DAY 90")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                .tracking(1.4)
                .foregroundColor(AppColors.textSecondary)
                .frame(maxWidth: .infinity)

            VStack(spacing: 0) {
                Text("GRADE")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 10))
                    .tracking(1.4)
                    .foregroundColor(AppColors.textMuted)
                Text(projectedOvrTier.rawValue)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 56))
                    .monospacedDigit()
                    .foregroundColor(projectedOvrTier.color)
                    .luminousTierGlow(projectedOvrTier, strength: 1.5)
            }
            .padding(.top, 8)

            HStack(spacing: 8) {
                Text("OVR")
                    .font(.custom(FontFamily.display.rawValue, size: 10))
                    .tracking(1.6)
                    .foregroundColor(AppColors.textMuted)
                Text("F-")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 18))
                    .monospacedDigit()
                    .foregroundColor(StatTier.fMinus.color)
                Image(systemName: "arrow.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(AppColors.textMuted)
                Text(projectedOvrTier.rawValue)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 22))
                    .monospacedDigit()
                    .foregroundColor(projectedOvrTier.color)
                    .luminousTierGlow(projectedOvrTier)
            }
            .padding(.top, 4)

            VStack(spacing: 6) {
                ForEach(stats) { row in
                    let endTier = projectedTier(forValue: row.value)
                    // Grades are left-packed after the fixed-width stat label
                    // (no leading Spacer) so the "F- → X" transition starts at
                    // the same X on every row. Fixed sub-columns keep the arrow
                    // + end-grade aligned regardless of letter width.
                    HStack(spacing: 8) {
                        Text(statLabel[row.key] ?? row.key.rawValue)
                            .font(.custom(FontFamily.body.rawValue, size: 11))
                            .foregroundColor(AppColors.textSecondary)
                            .frame(width: 80, alignment: .leading)
                        Text("F-")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                            .monospacedDigit()
                            .foregroundColor(StatTier.fMinus.color)
                            .frame(width: 24, alignment: .leading)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(AppColors.textMuted)
                        Text(endTier.rawValue)
                            .font(.custom(FontFamily.headingBold.rawValue, size: 16))
                            .monospacedDigit()
                            .foregroundColor(endTier.color)
                            .luminousTierGlow(endTier)
                            .frame(width: 36, alignment: .leading)
                        Spacer(minLength: 0)
                    }
                }
            }
            .padding(.top, 12)

            HStack {
                metric("\(sessions)",        label: "Sessions")
                metric("\(minutes.formatted())", label: "Minutes")
                // The Day-90 streak reads in its own tier color (3-month = cyan)
                // so it pops as the milestone it is.
                metric("90", label: "Streak",
                       valueColor: getStreakTierInfo(streak: 90).color,
                       glow: true)
            }
            .padding(.top, 12)
            .padding(.top, 10)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(Color.white.opacity(0.05))
                    .frame(height: 1)
            }

            HStack(spacing: 6) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 11))
                    .foregroundColor(AppColors.warning)
                Text("\"Elite focus. You outperformed 94% of users this week.\"")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 11))
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 12)
        }
        .padding(16)
        .background(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.72))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(AppColors.primary.opacity(0.18), lineWidth: 2)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    private func metric(_ value: String, label: String, valueColor: Color = AppColors.textPrimary, glow: Bool = false) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.custom(FontFamily.heading.rawValue, size: 16))
                .foregroundColor(valueColor)
                .shadow(color: glow ? valueColor.opacity(0.6) : .clear, radius: glow ? 8 : 0)
            Text(label)
                .font(.custom(FontFamily.body.rawValue, size: 10))
                .tracking(0.5)
                .foregroundColor(AppColors.textMuted)
        }
        .frame(maxWidth: .infinity)
    }
}
