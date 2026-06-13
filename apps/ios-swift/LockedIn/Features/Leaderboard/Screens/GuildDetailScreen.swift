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
    @State private var moreSheetStage: MoreSheetStage = .options
    @State private var pendingKick: (userId: String, username: String)? = nil

    /// Drives the HUD-themed options sheet — `.options` is the initial menu;
    /// the destructive branches swap the panel content in-place rather than
    /// stacking a second modal on top, so the user never sees a system alert
    /// that breaks the HUD vocabulary.
    fileprivate enum MoreSheetStage {
        case options
        case confirmDelete
        case confirmLeave
    }

    /// Alert payload shown when `runDeleteOrLeave(.leave)` fails. Identifiable
    /// so `.alert(item:)` can route on identity rather than a parallel Bool
    /// flag.
    private struct LeaveFailedAlert: Identifiable {
        let id = UUID()
        let title: String
        let message: String
    }
    @State private var leaveFailedAlert: LeaveFailedAlert?

    private var details: GuildService.GuildDetails? {
        state.detailsByGuild[guildId]
    }
    private var leaderboard: [GuildService.GuildLeaderboardEntry] {
        state.leaderboardByGuild[guildId] ?? []
    }
    private var isOwner: Bool {
        guard let currentUserId else { return false }
        if let details {
            return details.owner_id == currentUserId
        }
        // Fall back to `myGuilds` cache when the detail fetch hasn't landed
        // yet — otherwise an owner who opens the detail screen would briefly
        // see "Leave Guild" instead of "Delete Guild" and tapping Leave would
        // round-trip to the server only to hit `LeaveResult.ownerCannotLeave`.
        return state.myGuilds.first(where: { $0.guild_id == guildId })?.owner_id == currentUserId
    }
    private var currentMonthKey: String { GuildService.currentMonthKey() }
    private var selectedMonthKey: String { state.monthKey(forOffset: state.monthOffset) }
    private var isCurrentMonth: Bool { state.monthOffset == 0 }

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
                    monthSelector
                    listOrEmpty
                    inviteFooter
                }
            }
        }
        .task(id: guildId) {
            await state.loadDetail(guildId: guildId)
        }
        .task(id: state.monthOffset) {
            // Re-fetch leaderboard when month offset changes.
            await state.loadDetail(guildId: guildId, silent: true)
        }
        .refreshable {
            await state.refreshDetail(guildId: guildId)
        }
        .onChange(of: leaderboard.isEmpty) { _, _ in
            emitLeaderboardViewed()
        }
        .fullScreenCover(isPresented: $showMoreSheet) {
            MoreOptionsHUDSheet(
                guildName: details?.name ?? "",
                isOwner: isOwner,
                stage: $moreSheetStage,
                onShareInvite: {
                    handleShareInvite()
                    dismissMoreSheet()
                },
                onConfirm: { stage in
                    dismissMoreSheet()
                    switch stage {
                    case .confirmDelete:
                        Task { await runDeleteOrLeave(.delete) }
                    case .confirmLeave:
                        Task { await runDeleteOrLeave(.leave) }
                    case .options:
                        break
                    }
                },
                onCancel: { dismissMoreSheet() }
            )
        }
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
        .alert(item: $leaveFailedAlert) { alert in
            Alert(
                title: Text(alert.title),
                message: Text(alert.message),
                dismissButton: .default(Text("OK"))
            )
        }
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

            Button(action: {
                // Always re-open at the options stage; the destructive
                // confirmation screens are reached by tapping into them.
                moreSheetStage = .options
                showMoreSheet = true
            }) {
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

    // MARK: - Month selector

    private var monthSelector: some View {
        HStack {
            Button(action: { state.monthOffset -= 1 }) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(AppColors.textSecondary)
                    .padding(4)
            }
            .buttonStyle(PressOpacityButtonStyle())

            Spacer()

            HStack(spacing: 8) {
                Text(monthLabel(selectedMonthKey, currentMonthKey: currentMonthKey))
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                    .foregroundColor(AppColors.textPrimary)
                if isCurrentMonth {
                    Circle()
                        .fill(AppColors.success)
                        .frame(width: 6, height: 6)
                }
            }

            Spacer()

            Button(action: { state.monthOffset = min(state.monthOffset + 1, 0) }) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(isCurrentMonth ? AppColors.surface : AppColors.textSecondary)
                    .padding(4)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(isCurrentMonth)
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
                            ovrTier: entry.ovr_tier.flatMap { StatTier(rawValue: $0) },
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
            let result = await state.leaveGuild(guildId: guildId)
            switch result {
            case .success:
                AnalyticsService.shared.track("Guild Left", properties: [
                    "guild_id": guildId,
                    "was_owner": false,
                ])
                onLeft()
            case .ownerCannotLeave:
                leaveFailedAlert = LeaveFailedAlert(
                    title: "You're the guild owner",
                    message: "Owners can't leave — use Delete Guild to dissolve it instead."
                )
                AnalyticsService.shared.track("Guild Leave Failed", properties: [
                    "guild_id": guildId,
                    "reason": "owner_cannot_leave",
                ])
            case .notMember:
                // Already left somehow (membership row missing). Pop the
                // screen anyway so the user isn't stuck on a detail view for
                // a guild they aren't in.
                onLeft()
            case .networkError(let msg):
                leaveFailedAlert = LeaveFailedAlert(
                    title: "Couldn't leave guild",
                    message: msg.isEmpty ? "Please check your connection and try again." : msg
                )
                AnalyticsService.shared.track("Guild Leave Failed", properties: [
                    "guild_id": guildId,
                    "reason": "network",
                ])
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

    private func dismissMoreSheet() {
        showMoreSheet = false
        // Reset to options for the next open. fullScreenCover dismisses
        // before this state mutation matters, so the user never sees a
        // confirmation flash back to options.
        moreSheetStage = .options
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

    // MARK: - Month label

    private func monthLabel(_ monthKey: String, currentMonthKey: String) -> String {
        if monthKey == currentMonthKey { return "This Month" }
        // Parse `YYYY-MM`.
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1])
        else { return monthKey }

        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        guard let date = cal.date(from: DateComponents(year: year, month: month, day: 1)) else { return monthKey }

        let f = DateFormatter()
        f.calendar = cal
        f.timeZone = cal.timeZone
        // "May 2026" — drop the year for months in the current year.
        let currentYear = Calendar(identifier: .gregorian).component(.year, from: Date())
        f.dateFormat = (year == currentYear) ? "MMMM" : "MMMM yyyy"
        return f.string(from: date)
    }
}

// MARK: - HUD-themed options sheet

/// Single HUD-styled overlay that hosts both the initial options list and
/// the destructive confirmation steps. Mirrors the DurationPickerSheet
/// presentation pattern — black 0.75 backdrop, HUD panel with corner
/// brackets, "// LABEL" eyebrow, sharp 4pt corners.
///
/// Stays mounted across stage transitions so SwiftUI animates the inner
/// content swap instead of dismissing and re-presenting a fullScreenCover
/// (which would visibly flash on every confirm tap).
private struct MoreOptionsHUDSheet: View {
    let guildName: String
    let isOwner: Bool
    @Binding var stage: GuildDetailScreen.MoreSheetStage
    let onShareInvite: () -> Void
    let onConfirm: (GuildDetailScreen.MoreSheetStage) -> Void
    let onCancel: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.75)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { onCancel() }

            card
                .padding(.horizontal, 24)
        }
        .background(Color.clear)
    }

    private var card: some View {
        ZStack {
            Rectangle()
                .fill(SystemTokens.panelBg)
                .overlay(
                    Rectangle()
                        .stroke(SystemTokens.panelBorder, lineWidth: 1)
                )

            VStack(alignment: .leading, spacing: 0) {
                header
                content
                    .padding(.top, 16)
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .padding(.bottom, 16)

            HUDCornerBrackets(color: SystemTokens.bracketColor, pulses: false)
                .allowsHitTesting(false)
        }
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
        .animation(.easeInOut(duration: 0.18), value: stage)
    }

    // MARK: - Header strip

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(eyebrowLabel)
                .sectionLabel()
            LinearGradient(
                colors: [SystemTokens.bracketColor, .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 1)
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
            Text(guildName.isEmpty ? " " : guildName.uppercased())
                .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                .tracking(1.6)
                .foregroundColor(SystemTokens.textMuted)
                .lineLimit(1)
                .padding(.top, 2)
        }
    }

    private var eyebrowLabel: String {
        switch stage {
        case .options:       return "// OPTIONS"
        case .confirmDelete: return "// CONFIRM DELETE"
        case .confirmLeave:  return "// CONFIRM LEAVE"
        }
    }

    // MARK: - Stage content

    @ViewBuilder
    private var content: some View {
        switch stage {
        case .options:
            optionsView
        case .confirmDelete:
            confirmView(
                body: "Delete \"\(guildName)\"? This dissolves the guild for every member. This cannot be undone.",
                actionLabel: "Delete",
                onAct: { onConfirm(.confirmDelete) }
            )
        case .confirmLeave:
            confirmView(
                body: "Leave \"\(guildName)\"? Your scores stay on the board but you'll need a new invite code to rejoin.",
                actionLabel: "Leave",
                onAct: { onConfirm(.confirmLeave) }
            )
        }
    }

    private var optionsView: some View {
        VStack(alignment: .leading, spacing: 10) {
            actionRow(
                label: "SHARE INVITE CODE",
                style: .neutral,
                action: onShareInvite
            )
            if isOwner {
                actionRow(
                    label: "DELETE GUILD",
                    style: .destructive,
                    action: { stage = .confirmDelete }
                )
            } else {
                actionRow(
                    label: "LEAVE GUILD",
                    style: .destructive,
                    action: { stage = .confirmLeave }
                )
            }
            cancelRow
        }
    }

    private func confirmView(
        body: String,
        actionLabel: String,
        onAct: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(body)
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .foregroundColor(AppColors.textSecondary)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)

            actionRow(
                label: actionLabel.uppercased(),
                style: .destructive,
                action: onAct
            )
            actionRow(
                label: "BACK",
                style: .neutral,
                action: { stage = .options }
            )
        }
    }

    // MARK: - Row primitives

    private enum RowStyle { case neutral, destructive }

    private func actionRow(label: String, style: RowStyle, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color.white.opacity(0.02))
                    .overlay(
                        Rectangle()
                            .stroke(rowBorderColor(style), lineWidth: 1)
                    )
                Rectangle()
                    .fill(rowAccentColor(style))
                    .frame(width: 2)
                Text(label)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                    .tracking(1.4)
                    .foregroundColor(rowTextColor(style))
                    .padding(.leading, 14)
                    .padding(.vertical, 14)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressOpacityButtonStyle())
    }

    private var cancelRow: some View {
        Button(action: onCancel) {
            Text("Cancel")
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                .foregroundColor(SystemTokens.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressOpacityButtonStyle())
    }

    private func rowAccentColor(_ s: RowStyle) -> Color {
        switch s {
        case .neutral:     return AppColors.primary
        case .destructive: return AppColors.danger
        }
    }

    private func rowBorderColor(_ s: RowStyle) -> Color {
        switch s {
        case .neutral:     return Color.white.opacity(0.06)
        case .destructive: return AppColors.danger.opacity(0.35)
        }
    }

    private func rowTextColor(_ s: RowStyle) -> Color {
        switch s {
        case .neutral:     return AppColors.textPrimary
        case .destructive: return AppColors.danger
        }
    }
}
