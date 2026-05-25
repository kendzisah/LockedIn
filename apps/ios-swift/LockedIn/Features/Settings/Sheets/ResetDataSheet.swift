import SwiftUI
import DesignKit

/// Reset-all-data sheet. Port of
/// `apps/mobile/src/features/settings/sheets/ResetDataSheet.tsx`.
///
/// Wipes every persisted `@lockedin/*` key and asks the parent to perform a
/// full session reset via `onConfirm` (typically signs out + dispatches
/// `FULL_RESET` to the home/onboarding state providers).
struct ResetDataSheet: View {
    let onConfirm: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var loading: Bool = false

    var body: some View {
        SettingsSheetShell(title: "Reset all data?") {
            Text("This will clear your streak, missions, and all local data. You'll start fresh as if you just downloaded the app.")
                .appText(TypographyPreset(family: .body, size: 14, lineHeight: 20))
                .foregroundColor(AppColors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 20)

            Button(action: { Task { await run() } }) {
                Group {
                    if loading {
                        ProgressView().tint(AppColors.textPrimary)
                    } else {
                        Text("Reset Everything")
                            .appText(TypographyPreset(family: .headingSemiBold, size: 16))
                            .foregroundColor(AppColors.textPrimary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(AppColors.danger)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(loading)
            .padding(.bottom, 8)

            Button(action: { dismiss() }) {
                Text("Cancel")
                    .appText(TypographyPreset(family: .bodyMedium, size: 14))
                    .foregroundColor(AppColors.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(loading)
        }
    }

    @MainActor
    private func run() async {
        loading = true
        defer { loading = false }
        clearAllLockedInStorage()
        await onConfirm()
        dismiss()
    }

    /// Best-effort wipe of every `@lockedin/*` key in both default suites.
    /// Mirrors `apps/mobile/src/services/lockedInStorage.ts`.
    private func clearAllLockedInStorage() {
        for store in [Defaults.standard, Defaults.appGroup] {
            let prefix = "@lockedin/"
            for key in store.dictionaryRepresentation().keys where key.hasPrefix(prefix) {
                store.removeObject(forKey: key)
            }
        }
    }
}
