import SwiftUI
import DesignKit

/// BenefitRanksScreen — Step 17: rank ladder rendered top → bottom with
/// the NPC tier highlighted as "YOU".
///
/// Port of `screens/BenefitRanksScreen.tsx`.
struct BenefitRanksScreen: View {
    let onContinue: () -> Void
    @State private var tracker = OnboardingScreenTracker(.benefitRanks)

    private var orderedTiers: [RankTier] { RankTiers.all.reversed() }

    var body: some View {
        BenefitTemplate(
            panelLabel: "RANK SYSTEM",
            headline: "9 RANKS. 365 DAYS TO THE TOP.",
            headlineColor: AppColors.textPrimary,
            body: "Every day you show up, your rank climbs. Every day you skip, you sacrifice XP you can't get back. The path to LOCKED IN won't wait. Most won't make it. Will you?",
            graphic: { ladder },
            onContinue: onContinue
        )
        .onAppear { tracker.didAppear() }
        .onDisappear { tracker.didDisappear() }
    }

    private var ladder: some View {
        VStack(spacing: 0) {
            ForEach(Array(orderedTiers.enumerated()), id: \.element.id) { idx, tier in
                let isYou = tier.id == .npc
                let isFirst = idx == 0
                let isLast = idx == orderedTiers.count - 1

                HStack(alignment: .center, spacing: 10) {
                    VStack(spacing: 0) {
                        Rectangle()
                            .fill(isFirst ? Color.clear : Color.white.opacity(0.08))
                            .frame(width: 2)
                            .frame(maxHeight: .infinity)
                        Circle()
                            .fill(tier.color)
                            .frame(
                                width: isYou ? 16 : 12,
                                height: isYou ? 16 : 12
                            )
                            .overlay {
                                if isYou {
                                    Circle().stroke(Color.white, lineWidth: 2)
                                }
                            }
                            .shadow(color: tier.color.opacity(isYou ? 0.9 : 0.6), radius: isYou ? 10 : 6)
                        Rectangle()
                            .fill(isLast ? Color.clear : Color.white.opacity(0.08))
                            .frame(width: 2)
                            .frame(maxHeight: .infinity)
                    }
                    .frame(width: 24)

                    HStack {
                        Text(tier.name)
                            .font(.custom(isYou ? FontFamily.heading.rawValue : FontFamily.headingSemiBold.rawValue, size: 14))
                            .tracking(0.8)
                            .foregroundColor(tier.color)
                        Spacer()
                        if isYou {
                            Text("YOU")
                                .font(.custom(FontFamily.heading.rawValue, size: 9))
                                .tracking(1)
                                .foregroundColor(AppColors.textPrimary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(tier.color.opacity(0.25))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(tier.color, lineWidth: 1)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        } else {
                            Text("Day \(tier.minDays)+")
                                .font(.custom(FontFamily.body.rawValue, size: 10))
                                .tracking(0.4)
                                .foregroundColor(AppColors.textMuted)
                        }
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
                    .background(isYou ? tier.color.opacity(0.1) : Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.4))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(isYou ? tier.color : tier.color.opacity(0.2), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .padding(.vertical, 3)
                }
                .frame(minHeight: 36)
            }
        }
        .padding(.horizontal, 8)
    }
}
