import SwiftUI
import DesignKit

/// Profile-screen character-sheet panel: OVR + rank pill + 5 stat bars.
/// Port of `apps/mobile/src/features/settings/components/SystemStatsCard.tsx`.
///
/// W3 (Home) owns the canonical `StatsService` + `RankService`; until those
/// exist in Swift, this card binds to the values exposed by the parent.
/// When `stats == nil` we render baseline values (OVR 1, all stats 1) so the
/// HUD never goes blank.
///
/// Cross-feature dep:
/// - `StatsService` (W3): per-user `UserStatsRow` (provides OVR, total_xp,
///   current_streak_days, and the five stat columns).
/// - `RankService`  (W7/W3): `rankFromStreak(streakDays) -> (name, color)`.
struct SystemStatsCard: View {
    /// External data from the parent. The screen owner (`ProfileTabScreen`)
    /// pulls this from the eventual StatsService once W3 wires it.
    let stats: UserStatsLite?
    let rank: RankLite

    @State private var openStat: Stat?

    private let rows: [(stat: Stat, label: String)] = [
        (.discipline, "DIS"),
        (.focus, "FOC"),
        (.execution, "EXE"),
        (.consistency, "CON"),
        (.social, "SOC")
    ]

    var body: some View {
        HUDPanel(
            headerLabel: "SYSTEM STATS",
            headerRight: "\(stats?.totalXP ?? 0) XP",
            accentColor: rank.color
        ) {
            HStack {
                VStack(alignment: .leading, spacing: 0) {
                    Text("OVR")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                        .tracking(1.6)
                        .foregroundColor(SystemTokens.textMuted)
                    Text("\(stats?.ovr ?? 1)")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 44))
                        .foregroundColor(SystemTokens.textPrimary)
                        .shadow(color: rank.color, radius: 8)
                }
                Spacer()

                Text(rank.name)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                    .tracking(1.6)
                    .foregroundColor(rank.color)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(rank.color.opacity(0.1))
                    .overlay(
                        Rectangle()
                            .stroke(rank.color.opacity(0.33), lineWidth: 1.5)
                    )
                    .shadow(color: rank.color.opacity(0.4), radius: 10)
            }
            .padding(.bottom, 14)

            VStack(spacing: 8) {
                ForEach(rows, id: \.stat) { row in
                    let value = stats?.value(for: row.stat) ?? 1
                    Button(action: { openStat = row.stat }) {
                        HStack {
                            Text(row.label)
                                .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                                .tracking(1.6)
                                .foregroundColor(StatTokens.colors[row.stat] ?? SystemTokens.glowAccent)
                                .frame(width: 36, alignment: .leading)

                            StatBar(
                                progress: Double(value) / 99.0,
                                color: StatTokens.colors[row.stat] ?? SystemTokens.glowAccent,
                                height: 8
                            )

                            Text("\(value)")
                                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                                .foregroundColor(SystemTokens.textPrimary)
                                .frame(width: 32, alignment: .trailing)
                        }
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                }
            }

            Text("Tap any stat for breakdown")
                .font(.custom(FontFamily.body.rawValue, size: 11))
                .tracking(0.4)
                .foregroundColor(SystemTokens.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.top, 12)
        }
        .sheet(item: $openStat) { stat in
            StatDetailSheet(stat: stat, currentValue: stats?.value(for: stat) ?? 1)
                .presentationDetents([.medium, .large])
                .presentationBackground(SystemTokens.panelBg)
        }
    }
}

/// Lightweight stand-in for `@lockedin/shared-types` `UserStatsRow`. The
/// parent feature populates this from `StatsService` once W3 wires the
/// Swift port. Until then defaults (`nil`) render baseline values.
public struct UserStatsLite: Equatable, Sendable {
    public let ovr: Int
    public let totalXP: Int
    public let currentStreakDays: Int
    public let discipline: Int
    public let focus: Int
    public let execution: Int
    public let consistency: Int
    public let social: Int

    /// Lifetime records (used by `RecordsPanel`).
    public let longestStreakDays: Int
    public let totalCompletedSessions: Int
    public let totalFocusMinutes: Int
    public let totalMissionsCompleted: Int
    public let totalPerfectDays: Int

    public init(
        ovr: Int = 1,
        totalXP: Int = 0,
        currentStreakDays: Int = 0,
        discipline: Int = 1,
        focus: Int = 1,
        execution: Int = 1,
        consistency: Int = 1,
        social: Int = 1,
        longestStreakDays: Int = 0,
        totalCompletedSessions: Int = 0,
        totalFocusMinutes: Int = 0,
        totalMissionsCompleted: Int = 0,
        totalPerfectDays: Int = 0
    ) {
        self.ovr = ovr
        self.totalXP = totalXP
        self.currentStreakDays = currentStreakDays
        self.discipline = discipline
        self.focus = focus
        self.execution = execution
        self.consistency = consistency
        self.social = social
        self.longestStreakDays = longestStreakDays
        self.totalCompletedSessions = totalCompletedSessions
        self.totalFocusMinutes = totalFocusMinutes
        self.totalMissionsCompleted = totalMissionsCompleted
        self.totalPerfectDays = totalPerfectDays
    }

    public func value(for stat: Stat) -> Int {
        switch stat {
        case .discipline:  return discipline
        case .focus:       return focus
        case .execution:   return execution
        case .consistency: return consistency
        case .social:      return social
        }
    }
}

/// Lightweight stand-in for `RankService.rankFromStreak(...)`. W7 supplies
/// the canonical implementation; this binds the rank pill UI in the meantime.
public struct RankLite: Equatable, Sendable {
    public let name: String
    public let color: Color

    public init(name: String = "INITIATE", color: Color = SystemTokens.glowAccent) {
        self.name = name
        self.color = color
    }
}

extension Stat: @retroactive Identifiable {
    public var id: String { rawValue }
}
