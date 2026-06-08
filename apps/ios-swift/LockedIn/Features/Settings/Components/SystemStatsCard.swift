import SwiftUI
import DesignKit

/// Profile-screen character-sheet panel: OVR letter + rank pill + 5 letter-tier
/// stat rows.
///
/// **Letter-tier UI (Wave 1, Agent 3):** each row renders the per-stat letter
/// (F- to S+), a tier-colored progress bar showing position within the current
/// tier, and an `x/y to NEXT` caption. At S+ the bar is replaced by an
/// animated `AngularGradient` shimmer cycling through the 5 stat colors at
/// 6s/rotation. The OVR letter at the top is computed from the average of the
/// 5 stat tier ordinals via `OvrTier.compute(...)`.
///
/// When `stats == nil` (no data yet) all stats render as `F-` with counter
/// values of 0 — the HUD never goes blank.
///
/// Cross-feature dep:
/// - `StatsService` (W3): per-user `UserStatsRow` (provides counter columns
///   `total_focus_minutes`, `total_distractions_resisted`, etc.).
/// - `RankService`  (W7/W3): `rankFromStreak(streakDays) -> (name, color)`.
struct SystemStatsCard: View {
    /// External data from the parent. The screen owner (`ProfileTabScreen`)
    /// pulls this from `HomeService.refreshStats(...)`.
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

    private var ovrTier: StatTier {
        stats?.ovrTier ?? .fMinus
    }

    var body: some View {
        HUDPanel(
            headerLabel: "SYSTEM STATS",
            headerRight: "\(stats?.totalXP ?? 0) XP",
            accentColor: ovrTier.color
        ) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("OVR")
                        .font(.custom(FontFamily.display.rawValue, size: 10))
                        .tracking(1.6)
                        .foregroundColor(AppColors.textMuted)
                    Text(ovrTier.rawValue)
                        .font(.custom(FontFamily.headingBold.rawValue, size: 32))
                        .monospacedDigit()
                        .foregroundColor(ovrTier.color)
                        .luminousTierGlow(ovrTier)
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

            VStack(spacing: 10) {
                ForEach(rows, id: \.stat) { row in
                    LetterTierStatRow(
                        label: row.label,
                        stat: row.stat,
                        counter: stats?.counter(for: row.stat) ?? 0
                    )
                    .contentShape(Rectangle())
                    .onTapGesture { openStat = row.stat }
                }
            }

            Text("Tap any stat for breakdown")
                .font(.custom(FontFamily.body.rawValue, size: 11))
                .tracking(0.4)
                .foregroundColor(AppColors.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.top, 12)
        }
        .sheet(item: $openStat) { stat in
            StatDetailSheet(stat: stat, currentValue: stats?.counter(for: stat) ?? 0)
                .presentationDetents([.medium, .large])
                .presentationBackground(SystemTokens.panelBg)
        }
    }
}

/// Single letter-tier stat row.
///
/// Layout (per fleet briefing UI shape):
/// ```
/// DIS  ░▓▓▓▓░░░░░░░░░░░░░░░░░░  12/35 to D
///        B-
/// ```
///
/// Left: stat abbreviation (display font, tracked uppercase).
/// Center column: progress bar (tier-colored on white-6% track). At S+ the
/// solid fill is replaced by the animated `AngularGradient` shimmer.
/// Below abbreviation: letter tier in `headingBold` 22, tier-colored.
/// Right: `x/y to NEXT` caption (monospaced, body 12).
struct LetterTierStatRow: View {
    let label: String
    let stat: Stat
    let counter: Int

    @State private var shimmerRotation: Double = 0

    private var tier: StatTier {
        StatTierTable.tier(for: counter, kind: UserStatsLite.counterKind(for: stat))
    }

    private var fraction: Double {
        StatTierTable.fractionWithinTier(counter: counter, kind: UserStatsLite.counterKind(for: stat))
    }

    private var captionText: String {
        let raw = StatTierTable.progressLabel(counter: counter, kind: UserStatsLite.counterKind(for: stat))
        return raw == "MAX" ? "MAX" : raw
    }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            // Abbreviation + letter stacked vertically
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.custom(FontFamily.display.rawValue, size: 10))
                    .tracking(1.6)
                    .foregroundColor(AppColors.textMuted)
                Text(tier.rawValue)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 22))
                    .monospacedDigit()
                    .foregroundColor(tier.color)
                    .luminousTierGlow(tier)
            }
            .frame(width: 48, alignment: .leading)

            // Progress bar (or shimmer at S+).
            progressBar
                .frame(maxWidth: .infinity)
                .frame(height: 8)

            // Right caption. Fixed-width leading frame so the **left edge**
            // of every caption lines up across rows. Without this, varying
            // caption widths ("0/50 to F" vs "8500/11000 to B+") would
            // anchor at the trailing edge — visually misaligned starts.
            Text(captionText)
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .monospacedDigit()
                .foregroundColor(AppColors.textSecondary)
                .lineLimit(1)
                .frame(width: 120, alignment: .leading)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private var progressBar: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                // Track.
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(Color.white.opacity(0.06))

                if tier.isPeak {
                    // S+ multi-color shimmer — full bar width, no progress slice.
                    AngularGradient(
                        colors: [
                            Color(hex: "#FF006E"), // pink
                            Color(hex: "#A855F7"), // purple
                            Color(hex: "#3A66FF"), // discipline blue
                            Color(hex: "#00C2FF"), // accent cyan
                            Color(hex: "#00D68F"), // emerald
                            Color(hex: "#FFC857"), // gold
                            Color(hex: "#FF006E"), // back to pink, seamless
                        ],
                        center: .center
                    )
                    .rotationEffect(.degrees(shimmerRotation))
                    .mask(
                        RoundedRectangle(cornerRadius: 2, style: .continuous)
                            .frame(height: 8)
                    )
                    .onAppear {
                        withAnimation(.linear(duration: 6).repeatForever(autoreverses: false)) {
                            shimmerRotation = 360
                        }
                    }
                } else {
                    // Standard tier-colored fill.
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(tier.color)
                        .frame(width: max(0, proxy.size.width * fraction))
                        .shadow(color: tier.color.opacity(0.4), radius: 4)
                }
            }
        }
    }
}

/// Lightweight stand-in for `@lockedin/shared-types` `UserStatsRow`. The
/// parent feature populates this from `StatsService` once W3 wires the
/// Swift port. Until then defaults (`nil`) render baseline (F-) values.
///
/// **Letter-tier migration (Wave 1, Agent 3):** the legacy `discipline`,
/// `focus`, `execution`, `consistency`, `social` numeric fields (1–99) are
/// retained ONLY for backwards compatibility with code that hasn't migrated
/// yet. The new tier UI reads from the raw counter fields (`focusCounter`,
/// `disciplineCounter`, etc.) and maps through `StatTierTable`.
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

    // ─── Raw counter values (letter-tier UI source of truth) ───
    //
    // These mirror the `user_stats` columns the server bumps via
    // `bump_user_stat`. The letter-tier UI maps each one through
    // `StatTierTable.tier(for:kind:)` to produce the per-stat letter.
    /// `user_stats.total_distractions_resisted`.
    public let totalDistractionsResisted: Int
    /// `user_stats.total_streak_days` (lifetime, never decrements).
    public let totalStreakDays: Int
    /// `user_stats.invites_used`.
    public let invitesUsed: Int
    /// `user_stats.guild_check_ins`.
    public let guildCheckIns: Int

    // ─── Per-stat XP (post-unified-XP migration) ───
    //
    // These are the new source of truth for letter-tier rendering. The
    // legacy counter columns above are kept populated for backwards
    // compat with admin queries, but `counter(for:)` now reads from
    // these XP columns directly.
    public let focusXp: Int
    public let disciplineXp: Int
    public let executionXp: Int
    public let consistencyXp: Int
    public let socialXp: Int

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
        totalPerfectDays: Int = 0,
        totalDistractionsResisted: Int = 0,
        totalStreakDays: Int = 0,
        invitesUsed: Int = 0,
        guildCheckIns: Int = 0,
        focusXp: Int = 0,
        disciplineXp: Int = 0,
        executionXp: Int = 0,
        consistencyXp: Int = 0,
        socialXp: Int = 0
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
        self.totalDistractionsResisted = totalDistractionsResisted
        self.totalStreakDays = totalStreakDays
        self.invitesUsed = invitesUsed
        self.guildCheckIns = guildCheckIns
        self.focusXp = focusXp
        self.disciplineXp = disciplineXp
        self.executionXp = executionXp
        self.consistencyXp = consistencyXp
        self.socialXp = socialXp
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

    // MARK: - Letter-tier counter accessors
    //
    // After the unified per-stat XP migration, every stat reads directly
    // from its dedicated `<stat>_xp` column. The legacy counter formulas
    // below are kept as backwards-compat fallbacks for old cached rows
    // (pre-migration) where the XP column would otherwise be 0.

    /// Sum of all five per-stat XP buckets. Drives `RankHelpers.rankFromXp`.
    public var totalRankXp: Int {
        focusCounter + disciplineCounter + executionCounter + consistencyCounter + socialCounter
    }

    /// FOC XP. Falls back to clamped `total_focus_minutes` if the row
    /// predates the migration.
    public var focusCounter: Int {
        focusXp > 0 ? focusXp : min(35000, totalFocusMinutes)
    }

    /// DIS XP. Falls back to `total_distractions_resisted * 30`.
    public var disciplineCounter: Int {
        disciplineXp > 0 ? disciplineXp : totalDistractionsResisted * 30
    }

    /// EXE XP. Falls back to the same formula as the migration backfill.
    public var executionCounter: Int {
        executionXp > 0
            ? executionXp
            : (totalCompletedSessions * 15
               + totalMissionsCompleted * 15
               + totalPerfectDays * 50)
    }

    /// CON XP. Falls back to `streak_days * 30 + perfect_days * 30`.
    public var consistencyCounter: Int {
        consistencyXp > 0
            ? consistencyXp
            : (totalStreakDays * 30 + totalPerfectDays * 30)
    }

    /// SOC XP. Falls back to `invites_used * 200 + guild_check_ins * 30`.
    public var socialCounter: Int {
        socialXp > 0
            ? socialXp
            : (invitesUsed * 200 + guildCheckIns * 30)
    }

    /// Counter value for the given stat, used by the letter-tier UI.
    public func counter(for stat: Stat) -> Int {
        switch stat {
        case .focus:       return focusCounter
        case .discipline:  return disciplineCounter
        case .execution:   return executionCounter
        case .consistency: return consistencyCounter
        case .social:      return socialCounter
        }
    }

    /// `StatCounterKind` for the given stat axis. Used to look up the
    /// correct threshold table in `StatTierTable`.
    public static func counterKind(for stat: Stat) -> StatCounterKind {
        switch stat {
        case .focus:       return .focus
        case .discipline:  return .discipline
        case .execution:   return .execution
        case .consistency: return .consistency
        case .social:      return .social
        }
    }

    /// Letter tier for the given stat, derived from raw counters.
    public func tier(for stat: Stat) -> StatTier {
        StatTierTable.tier(for: counter(for: stat), kind: Self.counterKind(for: stat))
    }

    /// OVR letter tier — average ordinal across the five stat tiers.
    public var ovrTier: StatTier {
        OvrTier.compute(Stat.allCases.map { tier(for: $0) })
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

// MARK: - HomeService bridge

extension UserStatsLite {
    /// Project a server-side `HomeService.UserStatsRow` into the lite snapshot
    /// the Settings/Onboarding UI consumes. Keeps the call sites a one-liner
    /// and ensures the new raw counter fields are populated.
    public init(from row: HomeService.UserStatsRow) {
        self.init(
            ovr: row.ovr ?? 1,
            totalXP: row.totalXp ?? 0,
            currentStreakDays: row.currentStreakDays ?? 0,
            discipline: row.discipline ?? 1,
            focus: row.focus ?? 1,
            execution: row.execution ?? 1,
            consistency: row.consistency ?? 1,
            social: row.social ?? 1,
            longestStreakDays: row.longestStreakDays ?? 0,
            totalCompletedSessions: row.totalCompletedSessions ?? 0,
            totalFocusMinutes: row.totalFocusMinutes ?? 0,
            totalMissionsCompleted: row.totalMissionsCompleted ?? 0,
            totalPerfectDays: row.totalPerfectDays ?? 0,
            totalDistractionsResisted: row.totalDistractionsResisted ?? 0,
            totalStreakDays: row.totalStreakDays ?? 0,
            invitesUsed: row.invitesUsed ?? 0,
            guildCheckIns: row.guildCheckIns ?? 0,
            focusXp: row.focusXp ?? 0,
            disciplineXp: row.disciplineXp ?? 0,
            executionXp: row.executionXp ?? 0,
            consistencyXp: row.consistencyXp ?? 0,
            socialXp: row.socialXp ?? 0
        )
    }
}
