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

    private var ovr: Int {
        let total = stats.reduce(0) { $0 + $1.value }
        return Int(Double(total) / Double(max(1, stats.count)).rounded())
    }

    private var sessions: Int { 90 }
    private var minutes: Int { sessions * (state.dailyMinutes ?? 30) }

    private let statColor: [OnboardingEngine.StatKey: Color] = [
        .discipline:  SystemTokens.glowAccent,
        .focus:       SystemTokens.cyan,
        .execution:   SystemTokens.green,
        .consistency: SystemTokens.gold,
        .social:      SystemTokens.purple,
    ]

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
                Text("S")
                    .font(.custom(FontFamily.heading.rawValue, size: 56))
                    .foregroundColor(AppColors.warning)
                    .shadow(color: SystemTokens.gold.opacity(0.4), radius: 14)
            }
            .padding(.top, 8)

            HStack(spacing: 12) {
                Text("OVR")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                    .tracking(1)
                    .foregroundColor(AppColors.textSecondary)
                Text("\(ovr)")
                    .font(.custom(FontFamily.heading.rawValue, size: 22))
                    .foregroundColor(AppColors.textPrimary)
                Text("LEGEND")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 12))
                    .tracking(1.2)
                    .foregroundColor(SystemTokens.purple)
            }
            .padding(.top, 4)

            VStack(spacing: 6) {
                ForEach(stats) { row in
                    HStack(spacing: 8) {
                        Text(statLabel[row.key] ?? row.key.rawValue)
                            .font(.custom(FontFamily.body.rawValue, size: 11))
                            .foregroundColor(AppColors.textSecondary)
                            .frame(width: 80, alignment: .leading)
                        GeometryReader { proxy in
                            ZStack(alignment: .leading) {
                                Rectangle()
                                    .fill(Color.white.opacity(0.05))
                                Rectangle()
                                    .fill(statColor[row.key] ?? SystemTokens.glowAccent)
                                    .frame(width: proxy.size.width * Double(row.value) / 100.0)
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 3))
                        }
                        .frame(height: 6)
                        Text("\(row.value)")
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                            .foregroundColor(AppColors.textPrimary)
                            .frame(width: 24, alignment: .trailing)
                    }
                }
            }
            .padding(.top, 12)

            HStack {
                metric("\(sessions)",        label: "Sessions")
                metric("\(minutes.formatted())", label: "Minutes")
                metric("90",                  label: "Streak")
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

    private func metric(_ value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.custom(FontFamily.heading.rawValue, size: 16))
                .foregroundColor(AppColors.textPrimary)
            Text(label)
                .font(.custom(FontFamily.body.rawValue, size: 10))
                .tracking(0.5)
                .foregroundColor(AppColors.textMuted)
        }
        .frame(maxWidth: .infinity)
    }
}
