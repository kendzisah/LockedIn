import SwiftUI
import DesignKit

/// DailyActivityCard — Goal-specific daily check-in card.
///
/// Ported 1:1 from
/// `apps/mobile/src/features/missions/components/DailyActivityCard.tsx`.
/// Persists per-day completion under `@lockedin/daily_activity_done_<date>`
/// so the card flips to a completed state for the rest of the day.
struct DailyActivityCard: View {
    /// User's primary goal from onboarding state (Phase-2 coordinator wires this).
    let goal: String

    /// Called when the user taps "Log Activity" and the sheet completes a log.
    var onLogged: ((MissionTemplate) -> Void)?

    @State private var isDone: Bool = false
    @State private var isSheetOpen: Bool = false

    private var template: MissionTemplate? {
        MissionData.getDailyActivityForGoal(goal)
    }

    var body: some View {
        if let template {
            HUDPanel(headerLabel: "DAILY ACTIVITY") {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .top, spacing: 12) {
                        iconWrap
                        VStack(alignment: .leading, spacing: 4) {
                            Text(template.title)
                                .font(.custom(FontFamily.headingBold.rawValue, size: 16))
                                .tracking(-0.1)
                                .foregroundColor(isDone ? SystemTokens.textMuted : SystemTokens.textPrimary)
                                .lineLimit(2)
                            Text(template.description)
                                .font(.custom(FontFamily.body.rawValue, size: 12))
                                .foregroundColor(SystemTokens.textMuted)
                                .lineLimit(3)
                                .lineSpacing(17 - 12)

                            HStack(spacing: 10) {
                                Text("+\(template.xp.medium) XP")
                                    .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                                    .tracking(0.6)
                                    .foregroundColor(SystemTokens.cyan)
                                if isDone {
                                    Text("LOGGED TODAY")
                                        .font(.custom(FontFamily.headingBold.rawValue, size: 9))
                                        .tracking(1.2)
                                        .foregroundColor(SystemTokens.green)
                                }
                            }
                            .padding(.top, 2)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.vertical, 4)

                    Button(action: {
                        if !isDone { isSheetOpen = true }
                    }) {
                        Text(isDone ? "✓  ACTIVITY LOGGED" : "⟐  LOG ACTIVITY")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 12))
                            .tracking(1.8)
                            .foregroundColor(isDone ? SystemTokens.green : SystemTokens.glowAccent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(
                                isDone
                                ? Color(.sRGB, red: 0, green: 214/255, blue: 143/255, opacity: 0.08)
                                : Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.12)
                            )
                            .overlay(
                                Rectangle()
                                    .stroke(
                                        isDone
                                        ? Color(.sRGB, red: 0, green: 214/255, blue: 143/255, opacity: 0.3)
                                        : Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.35),
                                        lineWidth: 1
                                    )
                            )
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                    .disabled(isDone)
                    .padding(.top, 14)
                }
            }
            .onAppear { hydrateDoneFlag() }
            .sheet(isPresented: $isSheetOpen) {
                ActivityLogSheet(
                    template: template,
                    onLogged: {
                        markDone()
                        isSheetOpen = false
                        onLogged?(template)
                    },
                    onClose: { isSheetOpen = false }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.hidden)
                .presentationBackground(SystemTokens.panelBg)
            }
        }
    }

    @ViewBuilder
    private var iconWrap: some View {
        ZStack {
            Image(systemName: isDone ? "checkmark.circle.fill" : "bolt.fill")
                .font(.system(size: 22))
                .foregroundColor(isDone ? SystemTokens.green : SystemTokens.glowAccent)
        }
        .frame(width: 44, height: 44)
        .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.08))
        .overlay(
            Rectangle()
                .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.25), lineWidth: 1)
        )
    }

    private func hydrateDoneFlag() {
        let key = MissionsStorageKeys.dailyActivityDone(forDateKey: MissionsState.localDateKey())
        isDone = Defaults.string(key) == "true"
    }

    private func markDone() {
        let key = MissionsStorageKeys.dailyActivityDone(forDateKey: MissionsState.localDateKey())
        Defaults.setString("true", key)
        isDone = true
    }
}
