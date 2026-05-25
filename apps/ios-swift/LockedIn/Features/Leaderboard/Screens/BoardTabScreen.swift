import SwiftUI
import DesignKit

/// BoardTabScreen — `BoardTab` tab body. Pull-to-refresh list of the user's
/// guilds. Shows `EmptyGuildState` if none, otherwise a vertical stack of
/// `GuildCard`s + a "JOIN A GUILD" footer button when slots remain.
///
/// **Route name:** `BoardTab` (the tab name; the RN source mounts
/// `GuildListScreen` inside the `BoardTab` wrapper).
///
/// Ported from `apps/mobile/src/features/leaderboard/screens/BoardTab.tsx`
/// and `GuildListScreen.tsx`.
///
/// Navigation callbacks (`onTapGuild`, `onCreateGuild`, `onJoinGuild`) are
/// wired by `TabNavigator` to push the matching `MainStackRoute` cases
/// (`.guildDetail(id)`, `.createGuild`, `.joinGuild`).
public struct BoardTabScreen: View {
    @Bindable var state: GuildState

    let onCreateGuild: () -> Void
    let onJoinGuild: () -> Void
    let onTapGuild: (_ guildId: String) -> Void

    public init(
        state: GuildState,
        onCreateGuild: @escaping () -> Void = {},
        onJoinGuild: @escaping () -> Void = {},
        onTapGuild: @escaping (String) -> Void = { _ in }
    ) {
        self.state = state
        self.onCreateGuild = onCreateGuild
        self.onJoinGuild = onJoinGuild
        self.onTapGuild = onTapGuild
    }

    public var body: some View {
        ZStack(alignment: .top) {
            // BoardTab uses the same blue-shifted gradient as GuildList.
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

            GlowOrb(preset: .blue, size: 220, blurRadius: 40)
                .offset(x: 140, y: -80)

            VStack(spacing: 0) {
                headerPanel
                content
            }
            .padding(.horizontal, 16)
        }
        .task {
            await state.loadMyGuilds()
        }
        .refreshable {
            await state.refreshMyGuilds()
        }
    }

    // MARK: - Header

    private var headerPanel: some View {
        HUDPanel(
            headerLabel: "GUILD",
            headerRight: nil,
            accentColor: nil,
            idle: true,
            onPress: nil
        ) {
            // HUDPanel's `headerRight` parameter expects a String — to render
            // the iconic `+` button from RN we layer a button outside the
            // panel header. Achieve the same visual by placing the button as
            // an overlay aligned to top-trailing.
            EmptyView()
        }
        .overlay(alignment: .topTrailing) {
            Button(action: onCreateGuild) {
                Image(systemName: "plus")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(AppColors.primary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .accessibilityLabel("Create guild")
            .padding(.top, 10)
            .padding(.trailing, 16)
        }
        .padding(.top, 12)
        .padding(.bottom, 12)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if state.isLoading && state.myGuilds.isEmpty {
            VStack {
                Spacer()
                ProgressView()
                    .tint(AppColors.primary)
                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if state.myGuilds.isEmpty {
            EmptyGuildState(
                onCreateGuild: onCreateGuild,
                onJoinGuild: onJoinGuild
            )
            Spacer(minLength: 0)
        } else {
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 12) {
                    ForEach(state.myGuilds) { guild in
                        GuildCard(
                            guildName: guild.name,
                            memberCount: guild.member_count,
                            maxMembers: 10,
                            myRank: guild.my_rank > 0 ? guild.my_rank : nil,
                            myScore: guild.my_score,
                            topScore: guild.top_score,
                            onTap: { onTapGuild(guild.guild_id) }
                        )
                    }
                }
                .padding(.bottom, 140)
            }
            .overlay(alignment: .bottom) {
                if state.myGuilds.count > 0 && state.myGuilds.count < 5 {
                    Button(action: onJoinGuild) {
                        Text("⟐  JOIN A GUILD")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                            .tracking(1.8)
                            .foregroundColor(SystemTokens.glowAccent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.12))
                            .overlay(
                                Rectangle()
                                    .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.35), lineWidth: 1)
                            )
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                    .padding(.bottom, 100)
                    .padding(.top, 12)
                }
            }
        }
    }
}
