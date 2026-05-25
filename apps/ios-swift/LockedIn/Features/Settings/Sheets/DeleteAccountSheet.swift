import SwiftUI
import DesignKit

/// Final-confirm account deletion. Port of
/// `apps/mobile/src/features/settings/sheets/DeleteAccountSheet.tsx`.
///
/// User must type `DELETE` to enable the destructive button. On confirm,
/// dispatches to `AuthState.deleteAccount()` (uses `delete_own_account` RPC)
/// then notifies the parent via `onDeleted` so the screen can reset other
/// state and route the user back to a fresh session.
struct DeleteAccountSheet: View {
    let onDeleted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthState.self) private var auth

    @State private var confirmText: String = ""
    @State private var loading: Bool = false
    @State private var errorMessage: String?

    private var canDelete: Bool { confirmText == "DELETE" }

    var body: some View {
        SettingsSheetShell(title: "Delete your account?") {
            Text("This will permanently delete your account, all your data, streak history, guild memberships, and scores. This cannot be undone.")
                .appText(TypographyPreset(family: .body, size: 14, lineHeight: 20))
                .foregroundColor(AppColors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 16)

            ZStack(alignment: .leading) {
                if confirmText.isEmpty {
                    Text("Type DELETE to confirm")
                        .foregroundColor(AppColors.textMuted)
                        .appText(TypographyPreset(family: .body, size: 15))
                        .allowsHitTesting(false)
                }
                TextField("", text: $confirmText)
                    .foregroundColor(AppColors.textPrimary)
                    .appText(TypographyPreset(family: .body, size: 15))
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled(true)
            }
            .padding(.horizontal, 14)
            .frame(height: 48)
            .background(AppColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

            if let errorMessage {
                Text(errorMessage)
                    .appText(TypographyPreset(family: .body, size: 13))
                    .foregroundColor(AppColors.danger)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 8)
            }

            Button(action: { Task { await runDelete() } }) {
                Group {
                    if loading {
                        ProgressView().tint(AppColors.textPrimary)
                    } else {
                        Text("Delete My Account")
                            .appText(TypographyPreset(family: .headingSemiBold, size: 16))
                            .foregroundColor(AppColors.textPrimary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(AppColors.danger)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .opacity(canDelete ? 1 : 0.4)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(!canDelete || loading)
            .padding(.top, 16)
        }
    }

    @MainActor
    private func runDelete() async {
        guard canDelete else { return }
        loading = true
        defer { loading = false }
        let result = await auth.deleteAccount()
        if let error = result.error {
            errorMessage = error.message
            return
        }
        SettingsAnalytics.log(SettingsAnalytics.accountDeleted)
        // Best-effort wipe of `@lockedin/*` keys handled by the parent
        // (see `ProfileTabScreen.afterDeleteAccount`).
        onDeleted()
        dismiss()
    }
}
