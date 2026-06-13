import SwiftUI
import DesignKit

/// Per-stat info modal. Port of
/// `apps/mobile/src/features/settings/components/StatDetailSheet.tsx`.
///
/// Lists what grows the stat plus three sample missions. The mission list
/// depends on W4's MissionEngine (mission catalogs + `MISSION_TYPE_STATS`);
/// until that lands, we render the growth-source bullets only and W4 wires
/// the mission samples during integration.
struct StatDetailSheet: View {
    let stat: Stat
    let currentValue: Int

    @Environment(\.dismiss) private var dismiss

    private static let fullLabel: [Stat: String] = [
        .discipline:  "DISCIPLINE",
        .focus:       "FOCUS",
        .execution:   "EXECUTION",
        .consistency: "CONSISTENCY",
        .social:      "SOCIAL"
    ]

    /// Plain-language explanations from RN `StatDetailSheet.tsx`.
    private static let growthSources: [Stat: [String]] = [
        .discipline: [
            "Completing discipline-tagged missions",
            "Resisting blocked-app attempts during focus sessions",
            "Cold exposure / no-phone / no-social challenges"
        ],
        .focus: [
            "Logging focus session minutes",
            "Hitting your daily focus goal consistently",
            "Long focus blocks (60 min+) earn bonus XP"
        ],
        .execution: [
            "Completing focus sessions",
            "Completing daily missions",
            "Logging your daily activity check-in"
        ],
        .consistency: [
            "Hitting your daily focus goal day after day",
            "Perfect days (clearing all 3 daily missions) count double",
            "Streaks reset, but lifetime consistency does not"
        ],
        .social: [
            "Inviting friends — every redeemed code grows your stat",
            "Completing social-tagged missions (accountability, networking)",
            "Guild check-ins each week"
        ]
    ]

    var body: some View {
        let color = StatTokens.colors[stat] ?? SystemTokens.glowAccent
        let label = Self.fullLabel[stat] ?? stat.rawValue.uppercased()
        let sources = Self.growthSources[stat] ?? []

        ZStack {
            SystemTokens.panelBg.ignoresSafeArea()

            VStack(spacing: 0) {
                Capsule()
                    .fill(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.3))
                    .frame(width: 40, height: 3)
                    .padding(.top, 14)
                    .padding(.bottom, 14)

                HStack(alignment: .firstTextBaseline) {
                    Text("// \(label)")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                        .tracking(2.2)
                        .foregroundColor(color)
                    Spacer()
                    Text("\(currentValue)")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 28))
                        .tracking(-0.5)
                        .foregroundColor(SystemTokens.textPrimary)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 12)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("WHAT GROWS THIS STAT")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                            .tracking(1.6)
                            .foregroundColor(SystemTokens.textMuted)

                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(sources, id: \.self) { src in
                                HStack(alignment: .top, spacing: 10) {
                                    Rectangle()
                                        .fill(color)
                                        .frame(width: 4, height: 4)
                                        .offset(y: 7)
                                    Text(src)
                                        .font(.custom(FontFamily.body.rawValue, size: 13))
                                        .foregroundColor(SystemTokens.textSecondary)
                                        .lineSpacing(4)
                                }
                            }
                        }

                        // TODO(W4): MissionEngine samples ("MISSIONS THAT TARGET …")
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 12)
                }

                Button(action: { dismiss() }) {
                    Text("Close")
                        .appText(TypographyPreset(family: .bodyMedium, size: 13))
                        .foregroundColor(SystemTokens.textMuted)
                        .padding(.vertical, 12)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PressOpacityButtonStyle())
            }
            .overlay(alignment: .top) {
                HUDCornerBrackets(
                    length: 14,
                    thickness: 1.5,
                    color: color,
                    pulses: true
                )
                .frame(height: 30)
                .padding(.horizontal, 4)
            }
            .overlay(
                Rectangle()
                    .stroke(SystemTokens.panelBorder, lineWidth: 1)
                    .ignoresSafeArea()
            )
        }
    }
}
