import SwiftUI
import DesignKit

/// GuildDetailScreen — Full guild view: name + member count header, week
/// selector, ranked member rows, and a sticky invite-code footer.
///
/// **Route name:** `GuildDetail` with `{guild_id: String}` param (matches
/// `MainStackParamList.GuildDetail.guild_id` from
/// `apps/mobile/src/types/navigation.ts:63`).
///
/// Ported from `apps/mobile/src/features/leaderboard/screens/GuildDetailScreen.tsx`.
///
/// Owner-only actions: kick member, delete guild.
/// Non-owner: leave guild.
public struct GuildDetailScreen: View {
    @Bindable var state: GuildState

    let guildId: String
    let currentUserId: String?
    let onBack: () -> Void
    let onLeft: () -> Void

    public init(
        state: GuildState,
        guildId: String,
        currentUserId: String?,
        onBack: @escaping () -> Void,
        onLeft: @escaping () -> Void
    ) {
        self.state = state
        self.guildId = guildId
        self.currentUserId = currentUserId
        self.onBack = onBack
        self.onLeft = onLeft
    }

    // MARK: - Confirmation state

    @State private var showMoreSheet: Bool = false
    @State private var pendingDelete: Bool = false
    @State private var pendingLeave: Bool = false
    @State private var pendingKick: (userId: String, username: String)? = nil

    private var details: GuildService.GuildDetails? {
        state.detailsByGuild[guildId]
    }
    private var leaderboard: [GuildService.GuildLeaderboardEntry] {
        state.leaderboardByGuild[guildId] ?? []
    }
    private var isOwner: Bool {
        guard let details, let currentUserId else { return false }
        return details.owner_id == currentUserId
    }
    private var currentWeekKey: String { GuildService.currentWeekKey() }
    private var selectedWeekKey: String { state.weekKey(forOffset: state.weekOffset) }
    private var isCurrentWeek: Bool { state.weekOffset == 0 }

    public var body: some View {
        ZStack(alignment: .top) {
            LinearGradient(
                stops: [
                    Gradient.Stop(color: Color(hex: "#0A1628"), location: 0.0),
                    Gradient.Stop(color: Color(hex: "#0E1116"), location: 0.55),
                    Gradient.Stop(color: Color(hex: "#0E1116"), location: 1.0),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            GlowOrb(preset: .blue, size: 200, blurRadius: 40)
                .offset(x: UIScreen.main.bounds.width / 2 - 80, y: 60 - UIScreen.main.bounds.height / 2)

            VStack(spacing: 0) {
                if state.isLoadingDetail && details == nil {
                    Spacer()
                    ProgressView()
                        .tint(AppColors.primary)
                    Spacer()
                } else {
                    header
                    weekSelector
                    listOrEmpty
                    inviteFooter
                }
            }
        }
        .task(id: guildId) {
            await state.loadDetail(guildId: guildId)
        }
        .task(id: state.weekOffset) {
            // Re-fetch leaderboard when week offset changes.
            await state.loadDetail(guildId: guildId, silent: true)
        }
        .refreshable {
            await state.refreshDetail(guildId: guildId)
        }
        .onChange(of: leaderboard.isEmpty) { _, _ in
            emitLeaderboardViewed()
        }
        .confirmationDialog(
            details?.name ?? "Options",
            isPresented: $showMoreSheet,
            titleVisibility: .visible
        ) {
            Button("Share Invite Code") { handleShareInvite() }
            if isOwner {
                Button("Delete Guild", role: .destructive) {
                    pendingDelete = true
                }
            } else {
                Button("Leave Guild", role: .destructive) {
                    pendingLeave = true
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert(
            "Delete Guild",
            isPresented: $pendingDelete,
            actions: {
                Button("Delete", role: .destructive) {
                    Task { await runDeleteOrLeave(.delete) }
                }
                Button("Cancel", role: .cancel) {}
            },
            message: {
                Text("Are you sure you want to delete \"\(details?.name ?? "")\"? This cannot be undone.")
            }
        )
        .alert(
            "Leave Guild",
            isPresented: $pendingLeave,
            actions: {
                Button("Leave", role: .destructive) {
                    Task { await runDeleteOrLeave(.leave) }
                }
                Button("Cancel", role: .cancel) {}
            },
            message: {
                Text("Are you sure you want to leave \"\(details?.name ?? "")\"?")
            }
        )
        .alert(
            "Remove Member",
            isPresented: Binding(
                get: { pendingKick != nil },
                set: { if !$0 { pendingKick = nil } }
            ),
            actions: {
                Button("Remove", role: .destructive) {
                    guard let pending = pendingKick else { return }
                    Task {
                        _ = await state.kickMember(guildId: guildId, targetUserId: pending.userId)
                        pendingKick = nil
                    }
                }
                Button("Cancel", role: .cancel) { pendingKick = nil }
            },
            message: {
                Text("Remove \(pendingKick?.username ?? "this member") from this guild? Their scores will be deleted.")
            }
        )
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(AppColors.textPrimary)
                    .frame(width: 36, height: 36)
                    .background(Color.white.opacity(0.04))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(PressOpacityButtonStyle())

            VStack(spacing: 2) {
                Text(details?.name ?? "")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 18))
                    .tracking(-0.2)
                    .foregroundColor(AppColors.textPrimary)
                    .lineLimit(1)
                if let details {
                    HStack(spacing: 4) {
                        Image(systemName: "person.2")
                            .font(.system(size: 11))
                            .foregroundColor(AppColors.textMuted)
                        Text("\(details.member_count) members")
                            .font(.custom(FontFamily.body.rawValue, size: 12))
                            .foregroundColor(AppColors.textMuted)
                    }
                }
            }
            .frame(maxWidth: .infinity)

            Button(action: { showMoreSheet = true }) {
                Image(systemName: "ellipsis")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(AppColors.textSecondary)
                    .frame(width: 36, height: 36)
                    .background(Color.white.opacity(0.04))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(PressOpacityButtonStyle())
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 16)
    }

    // MARK: - Week selector

    private var weekSelector: some View {
        HStack {
            Button(action: { state.weekOffset -= 1 }) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(AppColors.textSecondary)
                    .padding(4)
            }
            .buttonStyle(PressOpacityButtonStyle())

            Spacer()

            HStack(spacing: 8) {
                Text(weekLabel(selectedWeekKey, currentWeekKey: currentWeekKey))
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                    .foregroundColor(AppColors.textPrimary)
                if isCurrentWeek {
                    Circle()
                        .fill(AppColors.success)
                        .frame(width: 6, height: 6)
                }
            }

            Spacer()

            Button(action: { state.weekOffset = min(state.weekOffset + 1, 0) }) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(isCurrentWeek ? AppColors.surface : AppColors.textSecondary)
                    .padding(4)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(isCurrentWeek)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .background(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.5))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.white.opacity(0.04), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
    }

    // MARK: - List / empty

    @ViewBuilder
    private var listOrEmpty: some View {
        if leaderboard.isEmpty {
            VStack(spacing: 8) {
                Spacer()
                Image(systemName: "chart.bar.xaxis")
                    .font(.system(size: 36))
                    .foregroundColor(AppColors.textMuted.opacity(0.5))
                Text("No activity yet")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                    .foregroundColor(AppColors.textSecondary)
                    .padding(.top, 4)
                Text("Start a focus session to get on the board")
                    .font(.custom(FontFamily.body.rawValue, size: 14))
                    .foregroundColor(AppColors.textMuted)
                Spacer()
                    .frame(maxHeight: 80)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 0) {
                    ForEach(Array(leaderboard.enumerated()), id: \.element.user_id) { (index, entry) in
                        MemberRow(
                            rank: entry.rank,
                            username: entry.username,
                            avatarUrl: entry.avatar_url,
                            focusMinutes: entry.focus_minutes,
                            missionsDone: entry.missions_done,
                            streakDays: entry.streak_days,
                            totalScore: entry.total_score,
                            isCurrentUser: entry.is_current_user,
                            isLast: index == leaderboard.count - 1,
                            ovr: entry.ovr,
                            rankId: entry.rank_id.flatMap { RankId(rawValue: $0) },
                            onRemove: (isOwner && !entry.is_current_user)
                                ? { pendingKick = (entry.user_id, entry.username) }
                                : nil
                        )
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 120)
            }
        }
    }

    // MARK: - Invite footer

    @ViewBuilder
    private var inviteFooter: some View {
        if let details {
            VStack(spacing: 0) {
                InviteCodeCard(inviteCode: details.invite_code, guildName: details.name)
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 34)
            .background(Color(.sRGB, red: 14/255, green: 17/255, blue: 22/255, opacity: 0.95))
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(Color.white.opacity(0.04))
                    .frame(height: 1)
            }
        }
    }

    // MARK: - Actions

    private enum LeaveAction { case delete, leave }

    private func runDeleteOrLeave(_ action: LeaveAction) async {
        switch action {
        case .delete:
            let ok = await state.deleteGuild(guildId: guildId)
            if ok {
                AnalyticsService.shared.track("Guild Left", properties: [
                    "guild_id": guildId,
                    "was_owner": true,
                ])
                onLeft()
            }
        case .leave:
            let ok = await state.leaveGuild(guildId: guildId)
            if ok {
                AnalyticsService.shared.track("Guild Left", properties: [
                    "guild_id": guildId,
                    "was_owner": false,
                ])
                onLeft()
            }
        }
    }

    private func handleShareInvite() {
        // No-op here: InviteCodeCard owns the share UI. The "Share Invite Code"
        // option in the more-sheet is functionally redundant with the inline
        // share button, but RN keeps both to match Apple's HIG.
        // TODO(post-launch): wire a programmatic UIActivityViewController
        // here for parity with the RN HIG behaviour.
    }

    private func emitLeaderboardViewed() {
        guard let details, !leaderboard.isEmpty, let _ = currentUserId else { return }
        let me = leaderboard.first(where: { $0.is_current_user })
        AnalyticsService.shared.track("Guild Leaderboard Viewed", properties: [
            "guild_id": guildId,
            "member_count": details.member_count,
            "user_rank": me?.rank ?? 0,
        ])
        if let me {
            state.cacheUserRank(guildId: guildId, guildName: details.name, rank: me.rank)
        }
    }

    // MARK: - Week label

    private func weekLabel(_ weekKey: String, currentWeekKey: String) -> String {
        if weekKey == currentWeekKey { return "This Week" }
        // Parse `YYYY-Www`.
        let parts = weekKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              parts[1].hasPrefix("W"),
              let week = Int(parts[1].dropFirst())
        else { return weekKey }

        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        // Anchor: Jan 4 always falls in ISO week 1.
        guard let jan4 = cal.date(from: DateComponents(year: year, month: 1, day: 4)) else { return weekKey }
        let weekday = cal.component(.weekday, from: jan4) // 1 = Sun
        // Shift to that week's Monday.
        let mondayOffset = (weekday == 1 ? -6 : 2 - weekday)
        guard let startOfWeek1 = cal.date(byAdding: .day, value: mondayOffset, to: jan4) else { return weekKey }
        guard let startOfWeek = cal.date(byAdding: .day, value: (week - 1) * 7, to: startOfWeek1) else { return weekKey }
        guard let endOfWeek = cal.date(byAdding: .day, value: 6, to: startOfWeek) else { return weekKey }

        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return "\(f.string(from: startOfWeek)) – \(f.string(from: endOfWeek))"
    }
}
