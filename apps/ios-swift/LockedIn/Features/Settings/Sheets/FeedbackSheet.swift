import SwiftUI
import DesignKit

/// Send-feedback modal. Port of the inline `FeedbackModal` defined inside
/// `apps/mobile/src/features/settings/screens/SettingsScreen.tsx`.
///
/// POSTs `{ message, email, _subject }` to Formspree
/// (`SettingsConstants.feedbackFormspreeURL`). On success, shows a "Thank you!"
/// state and auto-dismisses after 1.6 seconds.
struct FeedbackSheet: View {
    let userEmail: String?

    @Environment(\.dismiss) private var dismiss
    @State private var message: String = ""
    @State private var sending: Bool = false
    @State private var sent: Bool = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea().onTapGesture { dismiss() }

            VStack(spacing: 0) {
                if sent {
                    Text("Thank you!")
                        .appText(TypographyPreset(family: .heading, size: 18))
                        .foregroundColor(AppColors.success)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 24)
                } else {
                    Text("Send Feedback")
                        .appText(TypographyPreset(family: .heading, size: 18))
                        .foregroundColor(AppColors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.bottom, 12)

                    TextEditor(text: $message)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 100, maxHeight: 160)
                        .padding(8)
                        .background(AppColors.surface)
                        .foregroundColor(AppColors.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .padding(.bottom, 12)

                    if let errorMessage {
                        Text(errorMessage)
                            .appText(TypographyPreset(family: .body, size: 13))
                            .foregroundColor(AppColors.danger)
                            .padding(.bottom, 8)
                    }

                    Button(action: { Task { await send() } }) {
                        Group {
                            if sending {
                                ProgressView().tint(AppColors.textPrimary)
                            } else {
                                Text("Send")
                                    .appText(TypographyPreset(family: .headingSemiBold, size: 16))
                                    .foregroundColor(AppColors.textPrimary)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(AppColors.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                    .disabled(sending || message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    Button("Cancel") { dismiss() }
                        .foregroundColor(AppColors.textMuted)
                        .padding(.top, 12)
                }
            }
            .padding(20)
            .background(AppColors.backgroundSecondary)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .padding(.horizontal, 24)
        }
    }

    private func send() async {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        sending = true
        errorMessage = nil
        defer { sending = false }

        var request = URLRequest(url: SettingsConstants.feedbackFormspreeURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let body: [String: Any] = [
            "message": trimmed,
            "email": userEmail ?? "anonymous",
            "_subject": "Locked In App Feedback"
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, http.statusCode >= 200, http.statusCode < 300 {
                sent = true
                try? await Task.sleep(nanoseconds: 1_600_000_000)
                dismiss()
            } else {
                errorMessage = "Failed to send feedback."
            }
        } catch {
            errorMessage = "Network error."
        }
    }
}
