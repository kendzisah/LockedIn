import SwiftUI
import DesignKit

/// InviteCodeCard — Copy + share invite code. Pinned to the bottom of
/// GuildDetail.
///
/// Port of `apps/mobile/src/features/leaderboard/components/InviteCodeCard.tsx`.
struct InviteCodeCard: View {
    let inviteCode: String
    let guildName: String

    @State private var copied: Bool = false
    @State private var resetCopyTask: Task<Void, Never>?
    @State private var presentShareSheet: Bool = false

    private var spacedCode: String {
        // RN spaces out characters via `.split('').join(' ')` — letter-spacing
        // here uses real spacing for VoiceOver clarity.
        inviteCode.map(String.init).joined(separator: " ")
    }

    private var shareMessage: String {
        // App Store URL is wired through the existing `LockedInConfig.iosAppStoreURL`
        // xcconfig entry. Falls back to a stable App Store URL if missing.
        let url = LockedInConfig.string(.iosAppStoreURL) ?? "https://apps.apple.com/app/locked-in"
        return "Join my guild \"\(guildName)\" on Locked In! 🔒\n\nMy invite code: \(inviteCode)\n\nDownload the app and enter the code to compete with me:\n\(url)"
    }

    var body: some View {
        ZStack {
            // Subtle cyan glow.
            Circle()
                .fill(Color(.sRGB, red: 0/255, green: 194/255, blue: 255/255, opacity: 0.05))
                .frame(width: 80, height: 80)
                .blur(radius: 8)
                .offset(x: 110, y: -25)

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 5) {
                    Image(systemName: "key")
                        .font(.system(size: 11))
                        .foregroundColor(AppColors.textMuted)
                    Text("INVITE CODE")
                        .font(.custom(FontFamily.body.rawValue, size: 11))
                        .tracking(0.8)
                        .foregroundColor(AppColors.textMuted)
                }

                HStack(spacing: 12) {
                    Text(spacedCode)
                        .font(.custom(FontFamily.headingBold.rawValue, size: 20))
                        .tracking(4)
                        .foregroundColor(AppColors.accent)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    HStack(spacing: 8) {
                        actionButton(
                            icon: copied ? "checkmark" : "doc.on.doc",
                            tint: copied ? AppColors.success : AppColors.textSecondary,
                            success: copied,
                            label: "Copy invite code"
                        ) { handleCopy() }

                        actionButton(
                            icon: "square.and.arrow.up",
                            tint: AppColors.textSecondary,
                            success: false,
                            label: "Share invite"
                        ) { handleShare() }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(
            Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.72)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .sheet(isPresented: $presentShareSheet) {
            ActivityShareSheet(activityItems: [shareMessage])
        }
    }

    private func handleCopy() {
        AnalyticsService.shared.track("Guild Invite Shared", properties: [
            "guild_id": guildName,
            "share_method": "copy",
        ])
        UIPasteboard.general.string = inviteCode
        copied = true
        resetCopyTask?.cancel()
        resetCopyTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            if !Task.isCancelled {
                copied = false
            }
        }
    }

    private func handleShare() {
        AnalyticsService.shared.track("Guild Invite Shared", properties: [
            "guild_id": guildName,
            "share_method": "share_sheet",
        ])
        // Preserve the legacy RN AppsFlyer event name `crew_invite`.
        AnalyticsService.shared.trackAppsFlyer("af_invite", values: ["method": "crew_invite"])
        presentShareSheet = true
    }

    @ViewBuilder
    private func actionButton(icon: String, tint: Color, success: Bool, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(tint)
                .frame(width: 32, height: 32)
                .background(
                    success
                        ? Color(.sRGB, red: 0/255, green: 214/255, blue: 143/255, opacity: 0.08)
                        : Color.white.opacity(0.04)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(
                            success
                                ? Color(.sRGB, red: 0/255, green: 214/255, blue: 143/255, opacity: 0.2)
                                : Color.white.opacity(0.06),
                            lineWidth: 1
                        )
                )
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(PressOpacityButtonStyle())
        .accessibilityLabel(label)
    }
}

/// Thin `UIActivityViewController` wrapper for SwiftUI.
private struct ActivityShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
