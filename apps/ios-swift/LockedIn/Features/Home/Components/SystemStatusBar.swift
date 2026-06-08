import SwiftUI
import DesignKit

/// SystemStatusBar — Character HUD panel.
///
/// Identity (OVR + rank + progress to next), 5 animated stat bars,
/// week-at-a-glance blocks, and a streak status readout. Reads cached
/// stats from `HomeService.shared`; tap routes the user to `ProfileTab`.
///
/// Ported from `apps/mobile/src/features/home/components/SystemStatusBar.tsx`.
struct SystemStatusBar: View {
    @Bindable var home: HomeState
    let streakAtRisk: Bool

    /// Live stats. Defaults to `HomeService.shared.getCachedStats()` so the
    /// view renders synchronously while the async refresh runs.
    @State private var stats: HomeService.UserStatsRow?
    @State private var displayName: String?
    @State private var avatarUrl: String?

    // Animation state
    @State private var ovrGlow: Double = 0.5
    @State private var todayPulse: Double = 0.6

    /// Provided by the coordinator so the panel can route to ProfileTab.
    let onTapStatus: () -> Void
    /// Provided by the auth provider, so we know whether to fetch profile.
    let isAnonymous: Bool
    /// Current user UUID (Supabase) — needed for the profile read.
    let userId: String?

    init(
        home: HomeState,
        streakAtRisk: Bool,
        isAnonymous: Bool,
        userId: String?,
        onTapStatus: @escaping () -> Void
    ) {
        self.home = home
        self.streakAtRisk = streakAtRisk
        self.isAnonymous = isAnonymous
        self.userId = userId
        self.onTapStatus = onTapStatus
    }

    private static let statRows: [Stat] = [.discipline, .focus, .execution, .consistency, .social]
    private static let dayLabels: [String] = ["M", "T", "W", "T", "F", "S", "S"]

    var body: some View {
        let streakDays = home.consecutiveStreak
        let rankXp = stats?.totalRankXp ?? 0
        let currentRank = RankHelpers.rankFromXp(rankXp)
        let nextRank = RankHelpers.nextRankByXp(rankXp)
        let progress = RankHelpers.progressToNextByXp(rankXp)
        let xpToNext = RankHelpers.xpToNext(rankXp)
        let ovrTier = stats?.ovrTier ?? .fMinus
        let totalXp = rankXp

        let todayKey = SessionDayEngine.todayKey()
        let weekKeys = SessionDayEngine.currentWeekDayKeys()
        let completedSet = computeCompletedSet(weekKeys: weekKeys)

        HUDPanel(
            headerLabel: "STATUS",
            headerRight: "\(formatThousands(totalXp)) XP",
            accentColor: currentRank.color,
            onPress: onTapStatus
        ) {
            VStack(alignment: .leading, spacing: 0) {
                identityRow(currentRank: currentRank, nextRank: nextRank, progress: progress, xpToNext: xpToNext, ovrTier: ovrTier, streakDays: streakDays)

                sectionLabel("STATS")
                statsBlock

                sectionLabel("WEEK")
                weekRow(weekKeys: weekKeys, todayKey: todayKey, completedSet: completedSet)

                sectionLabel("STREAK")
                streakReadout(streakDays: streakDays)
            }
        }
        .task(id: streakDays) {
            // Refresh stats from Supabase on first appearance + every streak change.
            if let userId {
                _ = try? await HomeService.shared.refreshStats(userId: userId)
                stats = HomeService.shared.getCachedStats()
            }
        }
        .task(id: isAnonymous) {
            // Reload profile (display name + avatar URL) when auth state flips.
            if isAnonymous {
                displayName = nil
                avatarUrl = nil
                return
            }
            if let userId {
                if let profile = try? await HomeService.shared.fetchProfile(userId: userId) {
                    displayName = profile.displayName
                    avatarUrl = profile.avatarUrl
                }
            }
        }
        .onAppear {
            // OVR glow pulse — 1500ms each direction, easeInOut.
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                ovrGlow = 1.0
            }
            // Today marker pulse — 1000ms each direction.
            withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
                todayPulse = 1.0
            }
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private func identityRow(
        currentRank: RankTier,
        nextRank: RankTier?,
        progress: Double,
        xpToNext: Int,
        ovrTier: StatTier,
        streakDays: Int
    ) -> some View {
        HStack(alignment: .top, spacing: 14) {
            // Avatar column
            VStack(spacing: 4) {
                Text(String((displayName?.trimmingCharacters(in: .whitespaces) ?? "Anonymous").prefix(16)))
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 10))
                    .tracking(0.6)
                    .foregroundColor(SystemTokens.textSecondary)
                    .frame(maxWidth: 60)
                    .lineLimit(1)

                ZStack {
                    Rectangle()
                        .fill(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.06))
                    if let urlString = avatarUrl, let url = URL(string: urlString) {
                        AsyncImage(url: url) { img in
                            img.resizable().scaledToFill()
                        } placeholder: {
                            initialMonogram
                        }
                    } else {
                        initialMonogram
                    }
                }
                .frame(width: 60, height: 60)
                .overlay(
                    Rectangle()
                        .stroke(currentRank.color.opacity(0.33), lineWidth: 1)
                )
                .cornerRadius(2)
                .clipped()
            }
            .frame(width: 60)

            // Rank column
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .lastTextBaseline, spacing: 8) {
                    Text(currentRank.name)
                        .font(.custom(FontFamily.headingBold.rawValue, size: 20))
                        .tracking(1.6)
                        .foregroundColor(currentRank.color)
                        .shadow(color: currentRank.color.opacity(0.4), radius: 8)
                        .lineLimit(1)

                    Spacer(minLength: 0)

                    HStack(alignment: .lastTextBaseline, spacing: 0) {
                        Text("OVR ")
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                            .tracking(1.4)
                            .foregroundColor(SystemTokens.textMuted)
                        Text(ovrTier.rawValue)
                            .font(.custom(FontFamily.headingBold.rawValue, size: 22))
                            .tracking(0.6)
                            .foregroundColor(ovrTier.color)
                            .shadow(color: ovrTier.color, radius: CGFloat(ovrGlow * 4 + 6))
                            .monospacedDigit()
                    }
                }

                Text("DAY \(streakDays)")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 11))
                    .tracking(1.2)
                    .foregroundColor(SystemTokens.textSecondary)

                if let nextRank {
                    VStack(alignment: .leading, spacing: 4) {
                        // 3px progress track
                        ZStack(alignment: .leading) {
                            Rectangle()
                                .fill(Color.white.opacity(0.06))
                            GeometryReader { proxy in
                                Rectangle()
                                    .fill(currentRank.color)
                                    .frame(width: max(2, proxy.size.width * progress))
                                    .shadow(color: currentRank.color.opacity(0.6), radius: 4)
                            }
                        }
                        .frame(height: 3)

                        HStack(spacing: 0) {
                            Text("NEXT: ")
                                .font(.custom(FontFamily.body.rawValue, size: 10))
                                .tracking(0.6)
                                .foregroundColor(SystemTokens.textMuted)
                            Text(nextRank.name)
                                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 10))
                                .tracking(0.6)
                                .foregroundColor(nextRank.color)
                            Text(" · \(formatThousands(xpToNext)) XP")
                                .font(.custom(FontFamily.body.rawValue, size: 10))
                                .tracking(0.6)
                                .foregroundColor(SystemTokens.textMuted)
                        }
                    }
                    .padding(.top, 4)
                } else {
                    Text("MAX RANK")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                        .tracking(1.4)
                        .foregroundColor(SystemTokens.gold)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var initialMonogram: some View {
        Text(String((displayName?.trimmingCharacters(in: .whitespaces).first ?? "A")).uppercased())
            .font(.custom(FontFamily.headingBold.rawValue, size: 26))
            .tracking(-0.5)
            .foregroundColor(SystemTokens.textPrimary)
    }

    @ViewBuilder
    private func sectionLabel(_ label: String) -> some View {
        HStack(spacing: 8) {
            Text("// \(label)")
                .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                .tracking(2.0)
                .foregroundColor(SystemTokens.textMuted)
            Rectangle()
                .fill(SystemTokens.divider)
                .frame(height: 1)
        }
        .padding(.top, 14)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var statsBlock: some View {
        VStack(spacing: 5) {
            ForEach(Array(Self.statRows.enumerated()), id: \.element) { (idx, stat) in
                let counter = stats?.counter(for: stat) ?? 0
                let kind = UserStatsLite.counterKind(for: stat)
                let tier = StatTierTable.tier(for: counter, kind: kind)
                let fraction = StatTierTable.fractionWithinTier(counter: counter, kind: kind)
                let label = StatTokens.labels[stat] ?? "—"
                HUDStatBar(
                    label: label,
                    value: tier.rawValue,
                    progress: fraction,
                    color: tier.color,
                    delay: Double(idx) * 0.1,
                    // Letter tiers vary in width ("F" vs "F-" vs "S+") — leading
                    // alignment keeps every row's letter starting at the same X.
                    valueAlignment: .leading
                )
            }
        }
    }

    @ViewBuilder
    private func weekRow(weekKeys: [String], todayKey: String, completedSet: Set<String>) -> some View {
        HStack {
            ForEach(Array(Self.dayLabels.enumerated()), id: \.offset) { idx, label in
                let dayKey = weekKeys[idx]
                let isToday = dayKey == todayKey
                let isCompleted = completedSet.contains(dayKey)
                let isPast = dayKey < todayKey
                let isFuture = dayKey > todayKey
                let isMissed = isPast && !isCompleted

                VStack(spacing: 4) {
                    if isToday {
                        Rectangle()
                            .fill(Color(.sRGB, red: 0/255, green: 194/255, blue: 255/255, opacity: 0.5))
                            .frame(width: 1, height: 4)
                            .offset(y: -2)
                    } else {
                        Color.clear.frame(width: 1, height: 4)
                    }

                    Text(label)
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 10))
                        .tracking(0.8)
                        .foregroundColor(
                            isMissed ? SystemTokens.red
                            : isCompleted ? SystemTokens.green
                            : isToday ? SystemTokens.cyan
                            : SystemTokens.textMuted
                        )

                    ZStack {
                        if isCompleted {
                            Rectangle()
                                .fill(SystemTokens.green)
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                        } else if isMissed {
                            Rectangle()
                                .fill(Color(.sRGB, red: 255/255, green: 71/255, blue: 87/255, opacity: 0.08))
                            Image(systemName: "xmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(SystemTokens.red)
                        } else if isToday {
                            Rectangle()
                                .fill(Color(.sRGB, red: 0/255, green: 194/255, blue: 255/255, opacity: 0.08))
                                .opacity(todayPulse)
                        } else {
                            Rectangle()
                                .fill(Color.white.opacity(0.04))
                        }
                    }
                    .frame(width: 26, height: 26)
                    .overlay(
                        Rectangle()
                            .stroke(
                                isCompleted ? SystemTokens.green
                                : isMissed ? Color(.sRGB, red: 255/255, green: 71/255, blue: 87/255, opacity: 0.6)
                                : isToday ? SystemTokens.cyan
                                : SystemTokens.divider,
                                lineWidth: isToday && !isCompleted ? 1.5 : 1
                            )
                    )
                    .cornerRadius(3)
                    .opacity(isFuture ? 0.45 : 1.0)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 4)
    }

    @ViewBuilder
    private func streakReadout(streakDays: Int) -> some View {
        let status = streakStatus(streakDays: streakDays)
        HStack(spacing: 12) {
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                Text(String(format: "%02d", streakDays))
                    .font(.custom(FontFamily.headingBold.rawValue, size: 28))
                    .tracking(-0.5)
                    .foregroundColor(SystemTokens.textPrimary)
                Text("DAYS")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                    .tracking(1.6)
                    .foregroundColor(SystemTokens.textMuted)
            }

            Spacer()

            HStack(spacing: 6) {
                Rectangle()
                    .fill(status.color)
                    .frame(width: 8, height: 8)
                    .cornerRadius(1)
                Text(status.label)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                    .tracking(1.2)
                    .foregroundColor(status.color)
                    .lineLimit(1)
            }
        }
    }

    // MARK: - Helpers

    private struct StreakStatus { let label: String; let color: Color }
    private func streakStatus(streakDays: Int) -> StreakStatus {
        if streakAtRisk {
            return StreakStatus(label: "STATUS: AT RISK", color: SystemTokens.red)
        }
        if streakDays == 0 {
            return StreakStatus(label: "STATUS: INACTIVE", color: SystemTokens.textMuted)
        }
        let mult = 1.0 + min(Double(streakDays) / 30.0, 0.5)
        let label = String(format: "STATUS: ACTIVE · ×%.1f MULT", mult)
        return StreakStatus(label: label, color: SystemTokens.gold)
    }

    private func computeCompletedSet(weekKeys: [String]) -> Set<String> {
        // A day is "completed" only when the daily focus goal was met.
        // `weekCompletedDays` + `lastSessionDayKey` are both written by
        // `HomeState.dailyGoalMet()` which only fires once the user crosses
        // their `OnboardingState.dailyMinutes` target. Do NOT fall back to
        // `lastLockInCompletedDate` — that is set by every successful lock-in
        // regardless of duration, so a 1-minute session would falsely mark
        // the day complete even if the goal was 90 minutes.
        var s = Set<String>()
        let week = Set(weekKeys)
        for dk in home.weekCompletedDays where week.contains(dk) {
            s.insert(dk)
        }
        if let last = home.lastSessionDayKey, week.contains(last) {
            s.insert(last)
        }
        return s
    }

    private func formatThousands(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }
}
