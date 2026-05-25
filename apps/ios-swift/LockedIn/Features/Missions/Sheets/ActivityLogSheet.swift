import SwiftUI
import DesignKit

/// ActivityLogSheet — Quick-log bottom sheet for the daily activity check-in.
///
/// Ported 1:1 from
/// `apps/mobile/src/features/missions/sheets/ActivityLogSheet.tsx`.
///
/// On submit: parent receives `onLogged()` (DailyActivityCard handles the
/// per-day flag write). The stat / XP / achievement pipeline is wired by the
/// coordinator (W3 owns StatsService / XPService).
///
/// On submit we forward to `StatsService.bumpCounter(.totalMissionsCompleted, 1)`
/// and `XPService.award(.mission)`. The deeper achievement pipeline is left
/// as a `TODO(post-launch)` inside the submit handler.
struct ActivityLogSheet: View {
    let template: MissionTemplate
    let onLogged: () -> Void
    let onClose: () -> Void

    @State private var summary: String = ""
    @State private var note: String = ""
    @State private var isSubmitting: Bool = false

    private var canSubmit: Bool {
        summary.trimmingCharacters(in: .whitespacesAndNewlines).count > 0 && !isSubmitting
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Handle bar
            Rectangle()
                .fill(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.3))
                .frame(width: 40, height: 3)
                .frame(maxWidth: .infinity)
                .padding(.top, 14)
                .padding(.bottom, 16)

            // Header
            HStack {
                Text("// \(template.title.uppercased())")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                    .tracking(2.5)
                    .foregroundColor(SystemTokens.glowAccent)
                Spacer()
                Text("+\(template.xp.medium) XP")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                    .tracking(0.6)
                    .foregroundColor(SystemTokens.cyan)
            }
            .padding(.bottom, 4)

            Text(template.description)
                .font(.custom(FontFamily.body.rawValue, size: 13))
                .foregroundColor(SystemTokens.textMuted)
                .lineSpacing(18 - 13)
                .padding(.bottom, 18)

            // Summary
            Text("WHAT DID YOU DO?")
                .font(.custom(FontFamily.headingBold.rawValue, size: 9))
                .tracking(1.4)
                .foregroundColor(SystemTokens.textMuted)
                .padding(.bottom, 6)
                .padding(.top, 4)

            TextField("", text: $summary, prompt: Text("One-line summary").foregroundColor(SystemTokens.textMuted))
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .foregroundColor(SystemTokens.textPrimary)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color.white.opacity(0.04))
                .overlay(
                    Rectangle()
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
                .disabled(isSubmitting)
                .padding(.bottom, 14)

            // Note (optional)
            Text("NOTE  (OPTIONAL)")
                .font(.custom(FontFamily.headingBold.rawValue, size: 9))
                .tracking(1.4)
                .foregroundColor(SystemTokens.textMuted)
                .padding(.bottom, 6)
                .padding(.top, 4)

            ZStack(alignment: .topLeading) {
                if note.isEmpty {
                    Text("Anything worth remembering")
                        .font(.custom(FontFamily.body.rawValue, size: 14))
                        .foregroundColor(SystemTokens.textMuted)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $note)
                    .font(.custom(FontFamily.body.rawValue, size: 14))
                    .foregroundColor(SystemTokens.textPrimary)
                    .scrollContentBackground(.hidden)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .frame(minHeight: 80)
            }
            .background(Color.white.opacity(0.04))
            .overlay(
                Rectangle()
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
            .disabled(isSubmitting)
            .padding(.bottom, 14)

            // Submit
            Button(action: handleSubmit) {
                Text(isSubmitting ? "LOGGING…" : "⟐  LOG ACTIVITY")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                    .tracking(1.8)
                    .foregroundColor(SystemTokens.glowAccent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.18))
                    .overlay(
                        Rectangle()
                            .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.45), lineWidth: 1)
                    )
                    .opacity(canSubmit ? 1.0 : 0.4)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(!canSubmit)
            .padding(.top, 8)

            // Cancel
            Button(action: { if !isSubmitting { onClose() } }) {
                Text("Cancel")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                    .foregroundColor(SystemTokens.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .padding(.top, 4)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(SystemTokens.panelBg)
        .overlay(
            Rectangle()
                .stroke(SystemTokens.panelBorder, lineWidth: 1)
                .frame(height: 1)
                .frame(maxHeight: .infinity, alignment: .top)
        )
        .overlay(
            HUDCornerBrackets(color: SystemTokens.bracketColor)
                .allowsHitTesting(false)
        )
    }

    private func handleSubmit() {
        guard canSubmit else { return }
        isSubmitting = true
        HapticsService.shared.success()
        StatsService.bumpCounter(.totalMissionsCompleted, delta: 1)
        XPService.award(.mission)
        AnalyticsService.shared.track(MissionsRoute.AnalyticsEvent.dailyActivityLogged, properties: [
            // MissionTemplate has no `id` field; title is the natural identifier.
            "template": template.title,
        ])
        // TODO(post-launch): port the full RN AchievementService.evaluate(...)
        // pipeline that fires after the local writes complete.
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 100_000_000)
            onLogged()
            summary = ""
            note = ""
            isSubmitting = false
        }
    }
}
