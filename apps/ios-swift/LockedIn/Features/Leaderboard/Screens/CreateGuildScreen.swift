import SwiftUI
import DesignKit

/// CreateGuildScreen — Glass form for creating a new guild.
///
/// **Route name:** `CreateGuild` (no params; see
/// `MainStackParamList.CreateGuild`).
///
/// Ported from `apps/mobile/src/features/leaderboard/screens/CreateGuildScreen.tsx`.
///
/// Behavior:
///   - When `isAnonymous == true`, replaces the form with a "Sign up to create
///     a guild" gate. (Joining still works for guests; that path is in
///     `JoinGuildScreen`.)
///   - On successful create, calls `onCreated(guildId)` so the navigator can
///     `replace` to `GuildDetail` with the new id.
///   - Cap: owners can own at most 3 guilds (enforced server-side by
///     `create_guild` RPC). The error string mirrors RN verbatim.
public struct CreateGuildScreen: View {
    @Bindable var state: GuildState

    let isAnonymous: Bool
    let onBack: () -> Void
    let onSignUp: () -> Void
    let onCreated: (_ guildId: String) -> Void

    @State private var name: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil

    private let maxNameLength = 30

    public init(
        state: GuildState,
        isAnonymous: Bool,
        onBack: @escaping () -> Void,
        onSignUp: @escaping () -> Void,
        onCreated: @escaping (String) -> Void
    ) {
        self.state = state
        self.isAnonymous = isAnonymous
        self.onBack = onBack
        self.onSignUp = onSignUp
        self.onCreated = onCreated
    }

    private var trimmed: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    private var canCreate: Bool { !trimmed.isEmpty && !isLoading }

    public var body: some View {
        ZStack {
            AppColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                header(title: "Create a Guild")

                if isAnonymous {
                    anonymousGate
                } else {
                    formBody
                }
            }
        }
        .onAppear {
            if isAnonymous {
                // Preserve the legacy RN event name `crew_create` verbatim.
                AnalyticsService.shared.track("Signup Nudge Shown", properties: [
                    "nudge_type": "crew_create",
                ])
            }
        }
    }

    // MARK: - Header

    @ViewBuilder
    private func header(title: String) -> some View {
        HStack(spacing: 12) {
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(10)
            }
            .buttonStyle(PressOpacityButtonStyle())

            Spacer()

            Text(title)
                .font(.custom(FontFamily.heading.rawValue, size: 18))
                .foregroundColor(AppColors.textPrimary)

            Spacer()

            // Spacer balancer
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    // MARK: - Form

    private var formBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            Spacer()

            Text("Guild Name")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                .foregroundColor(AppColors.textSecondary)
                .padding(.horizontal, 24)

            // Custom input matching RN spec.
            TextField(
                "",
                text: Binding(
                    get: { name },
                    set: { name = String($0.prefix(maxNameLength)) }
                ),
                prompt: Text("e.g. Discipline Guild").foregroundColor(AppColors.textMuted)
            )
            .font(.custom(FontFamily.bodyMedium.rawValue, size: 16))
            .foregroundColor(AppColors.textPrimary)
            .submitLabel(.done)
            .onSubmit { Task { await handleCreate() } }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(minHeight: 52)
            .background(Color(.sRGB, red: 44/255, green: 52/255, blue: 64/255, opacity: 0.4))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.white.opacity(0.06), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 24)

            HStack {
                Spacer()
                Text("\(trimmed.count)/\(maxNameLength)")
                    .font(.custom(FontFamily.body.rawValue, size: 12))
                    .foregroundColor(AppColors.textMuted)
            }
            .padding(.horizontal, 24)
            .padding(.top, 6)

            Button(action: { Task { await handleCreate() } }) {
                ZStack {
                    if isLoading {
                        ProgressView()
                            .tint(AppColors.textPrimary)
                    } else {
                        Text("Create Guild")
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                            .foregroundColor(AppColors.primary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.12))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.25), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .opacity(canCreate ? 1.0 : 0.4)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(!canCreate)
            .padding(.horizontal, 24)
            .padding(.top, 24)

            if let errorMessage {
                Text(errorMessage)
                    .font(.custom(FontFamily.body.rawValue, size: 13))
                    .foregroundColor(AppColors.danger)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 14)
                    .padding(.horizontal, 24)
            }

            Spacer()
            Spacer()
        }
        .padding(.bottom, 80)
    }

    // MARK: - Anonymous gate

    private var anonymousGate: some View {
        VStack(spacing: 0) {
            Spacer()
            Image(systemName: "person.2.fill")
                .font(.system(size: 48))
                .foregroundColor(AppColors.textMuted)
                .padding(.bottom, 20)

            Text("Sign up to create a guild")
                .font(.custom(FontFamily.heading.rawValue, size: 18))
                .foregroundColor(AppColors.textPrimary)
                .multilineTextAlignment(.center)

            Text("Guild owners need an account so your guild stays safe. You can still join guilds as a guest.")
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(6)
                .frame(maxWidth: 280)
                .padding(.top, 8)

            Button(action: onSignUp) {
                Text("Create Free Account")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                    .foregroundColor(AppColors.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.25), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(PressOpacityButtonStyle())
            .padding(.horizontal, 32)
            .padding(.top, 24)

            Button(action: onBack) {
                Text("Go back")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                    .foregroundColor(AppColors.textMuted)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .padding(.top, 14)

            Spacer()
            Spacer()
        }
        .padding(.bottom, 80)
        .padding(.horizontal, 32)
    }

    // MARK: - Actions

    private func handleCreate() async {
        guard canCreate else { return }
        isLoading = true
        errorMessage = nil
        let result = await state.createGuild(name: trimmed)
        isLoading = false
        if let result {
            AnalyticsService.shared.track("Guild Created", properties: [
                "guild_name": result.name,
                "guild_id": result.guild_id,
            ])
            onCreated(result.guild_id)
        } else {
            errorMessage = "Failed to create guild. You may own a maximum of 3 guilds."
        }
    }
}
