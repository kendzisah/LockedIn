import SwiftUI
import DesignKit

/// BenefitMissionsScreen — Step 16: mission-rows graphic.
///
/// Port of `screens/BenefitMissionsScreen.tsx`.
struct BenefitMissionsScreen: View {
    let onContinue: () -> Void
    @State private var tracker = OnboardingScreenTracker(.benefitMissions)

    private struct SampleRow: Identifiable {
        let title: String
        let xp: Int
        let done: Bool
        let statLabel: String
        let statColor: Color
        var id: String { title }
    }

    private let sample: [SampleRow] = [
        .init(title: "Morning Focus Sprint", xp: 25, done: false, statLabel: "+FOCUS",      statColor: SystemTokens.cyan),
        .init(title: "Digital Sunset",        xp: 35, done: true,  statLabel: "+DISCIPLINE", statColor: SystemTokens.glowAccent),
        .init(title: "Cold Discipline",       xp: 15, done: false, statLabel: "+DISCIPLINE", statColor: SystemTokens.glowAccent),
    ]

    var body: some View {
        BenefitTemplate(
            panelLabel: "MISSIONS",
            headline: "DAILY MISSIONS",
            headlineColor: AppColors.success,
            body: "3 missions every day, built around your goal and weaknesses. Each mission targets a specific stat. Complete them all for bonus XP.",
            graphic: { missionsCard },
            onContinue: onContinue
        )
        .onAppear { tracker.didAppear() }
        .onDisappear { tracker.didDisappear() }
    }

    private var missionsCard: some View {
        VStack(spacing: 10) {
            ForEach(sample) { m in
                HStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 5)
                            .fill(m.done ? AppColors.success : Color.clear)
                            .overlay(
                                RoundedRectangle(cornerRadius: 5)
                                    .stroke(Color.white.opacity(0.12), lineWidth: 1)
                            )
                            .frame(width: 18, height: 18)
                        if m.done {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                    Text(m.title)
                        .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                        .strikethrough(m.done)
                        .foregroundColor(m.done ? AppColors.textMuted : AppColors.textPrimary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(m.statLabel)
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 9))
                        .tracking(0.6)
                        .foregroundColor(m.statColor)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(m.statColor.opacity(0.15))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(m.statColor.opacity(0.33), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    Text("+\(m.xp)")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 12))
                        .foregroundColor(AppColors.accent)
                        .frame(width: 32, alignment: .trailing)
                }
            }

            HStack {
                Text("Complete all 3:")
                    .font(.custom(FontFamily.body.rawValue, size: 12))
                    .foregroundColor(AppColors.textSecondary)
                Spacer()
                Text("+50 XP BONUS")
                    .font(.custom(FontFamily.heading.rawValue, size: 12))
                    .tracking(0.5)
                    .foregroundColor(AppColors.warning)
            }
            .padding(.top, 4)
            .padding(.top, 10)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(Color.white.opacity(0.05))
                    .frame(height: 1)
            }
        }
        .padding(14)
        .background(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.5))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.white.opacity(0.04), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
