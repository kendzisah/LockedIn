import SwiftUI
import DesignKit
import Supabase

/// Change-password sheet. Port of
/// `apps/mobile/src/features/settings/sheets/ChangePasswordSheet.tsx`.
///
/// Flow (matches RN line-for-line):
///   1. Re-verify the current password via `auth.signInWithPassword`.
///   2. Call `auth.updateUser({ password: pw1 })`.
///   3. Show success alert and dismiss.
struct ChangePasswordSheet: View {
    let email: String

    @Environment(\.dismiss) private var dismiss
    @State private var currentPw: String = ""
    @State private var pw1: String = ""
    @State private var pw2: String = ""
    @State private var errorMessage: String?
    @State private var loading: Bool = false
    @State private var showSuccess: Bool = false

    private var isValid: Bool {
        !currentPw.isEmpty &&
        pw1.count >= 8 &&
        pw2.count >= 8 &&
        pw1 == pw2
    }

    var body: some View {
        SettingsSheetShell(title: "Change password") {
            VStack(spacing: 12) {
                input("Current password", $currentPw)
                input("New password", $pw1)
                input("Confirm password", $pw2)
            }

            if !pw1.isEmpty && pw1.count < 8 {
                Text("At least 8 characters")
                    .appText(TypographyPreset(family: .body, size: 13))
                    .foregroundColor(AppColors.danger)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 8)
            }
            if !pw2.isEmpty && pw1 != pw2 {
                Text("Passwords do not match")
                    .appText(TypographyPreset(family: .body, size: 13))
                    .foregroundColor(AppColors.danger)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
            }
            if let errorMessage {
                Text(errorMessage)
                    .appText(TypographyPreset(family: .body, size: 13))
                    .foregroundColor(AppColors.danger)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
            }

            Button(action: { Task { await save() } }) {
                Group {
                    if loading {
                        ProgressView().tint(AppColors.textPrimary)
                    } else {
                        Text("Update Password")
                            .appText(TypographyPreset(family: .headingSemiBold, size: 16))
                            .foregroundColor(AppColors.textPrimary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(AppColors.primary)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .opacity(isValid ? 1 : 0.4)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(!isValid || loading)
            .padding(.top, 16)
        }
        .alert("Password updated", isPresented: $showSuccess) {
            Button("OK", role: .cancel) { dismiss() }
        } message: {
            Text("Your password has been updated.")
        }
    }

    @ViewBuilder
    private func input(_ placeholder: String, _ text: Binding<String>) -> some View {
        ZStack(alignment: .leading) {
            if text.wrappedValue.isEmpty {
                Text(placeholder)
                    .foregroundColor(AppColors.textMuted)
                    .appText(TypographyPreset(family: .body, size: 15))
                    .allowsHitTesting(false)
            }
            SecureField("", text: text)
                .foregroundColor(AppColors.textPrimary)
                .appText(TypographyPreset(family: .body, size: 15))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
        }
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func save() async {
        guard isValid else { return }
        errorMessage = nil
        loading = true
        defer { loading = false }
        let client = LockedInSupabase.shared.client
        do {
            // Verify current password.
            _ = try await client.auth.signIn(email: email, password: currentPw)
        } catch {
            errorMessage = "Current password is incorrect"
            return
        }
        do {
            _ = try await client.auth.update(user: UserAttributes(password: pw1))
            showSuccess = true
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Something went wrong"
        }
    }
}
