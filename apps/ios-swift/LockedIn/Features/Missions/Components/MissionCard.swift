import SwiftUI
import DesignKit

/// MissionCard — Glassmorphic mission card with tap-to-open detail sheet.
///
/// Ported 1:1 from
/// `apps/mobile/src/features/missions/components/MissionCard.tsx`. Used by
/// the alternative `MissionsPanel` layout (the primary MissionsTab layout
/// uses the slimmer `MissionLogCard` instead).
struct MissionCard: View {
    let mission: Mission
    let onComplete: (String) -> Void

    @State private var isDetailOpen: Bool = false

    private var done: Bool { mission.completed }
    private var failed: Bool { mission.failed == true }
    private var isWeekly: Bool { mission.duration == .weekly }
    private var hasProgressTarget: Bool { mission.progressTarget != nil }
    private var locked: Bool {
        !done && !failed && !isWeekly && !MissionTimeGate.isUnlocked(mission.timeGate)
    }

    private var iconInfo: (name: String, color: Color) {
        switch mission.type {
        case .focus_session:  return ("timer", AppColors.primary)
        case .no_social:      return ("iphone.slash", Color(hex: "#8B5CF6"))
        case .reflection:     return ("moon", Color(hex: "#FF6B35"))
        case .workout_check:  return ("figure.strengthtraining.traditional", AppColors.success)
        case .journal:        return ("book", Color(hex: "#FFC857"))
        case .reading:        return ("text.book.closed", AppColors.accent)
        case .planning:       return ("list.clipboard", Color(hex: "#00D68F"))
        case .discipline:     return ("shield.checkered", Color(hex: "#B0A0FF"))
        case .lifestyle:      return ("heart", Color(hex: "#FF6B81"))
        case .social:         return ("person.2", Color(hex: "#00C2FF"))
        case .custom:         return ("star", AppColors.accent)
        }
    }

    private var slotMeta: (label: String, color: Color, desc: String) {
        switch mission.slot {
        case .core:     return ("CORE",   AppColors.primary, "Universal focus mission")
        case .goal:     return ("GOAL",   AppColors.accent,  "Based on your primary goal")
        case .weakness: return ("GROWTH", Color(hex: "#B0A0FF"), "Targets your stated weakness")
        }
    }

    var body: some View {
        Button(action: openDetail) {
            cardContent
        }
        .buttonStyle(PressOpacityButtonStyle())
        .sheet(isPresented: $isDetailOpen) {
            MissionDetailSheet(
                mission: mission,
                onComplete: { id in
                    onComplete(id)
                    isDetailOpen = false
                },
                onClose: { isDetailOpen = false },
                locked: locked,
                slotMeta: slotMeta,
                iconInfo: iconInfo
            )
            .presentationDetents([.medium, .large])
            .presentationBackground(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.97))
        }
    }

    @ViewBuilder
    private var cardContent: some View {
        HStack(alignment: .center, spacing: 12) {
            iconBox
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(mission.title)
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                        .foregroundColor(done ? AppColors.textMuted : AppColors.textPrimary)
                        .strikethrough(done || failed)
                        .lineLimit(1)
                    slotBadge
                }
                Text(displayDescription)
                    .font(.custom(FontFamily.body.rawValue, size: 12))
                    .foregroundColor(done ? AppColors.textMuted : AppColors.textSecondary)
                    .lineLimit(isWeekly && !failed ? 2 : 1)

                if let target = mission.progressTarget, !done && !failed {
                    let pct = Double(mission.progress ?? 0) / Double(max(1, target))
                    if isWeekly || (mission.progress ?? 0) > 0 {
                        progressRow(progress: min(1, max(0, pct)))
                    }
                }

                if !done && !locked && !isWeekly && mission.completionType == .auto
                    && !(hasProgressTarget && (mission.progress ?? 0) > 0) {
                    HStack(spacing: 3) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 9))
                            .foregroundColor(AppColors.accent)
                        Text("Auto-complete")
                            .font(.custom(FontFamily.body.rawValue, size: 10))
                            .foregroundColor(AppColors.accent)
                    }
                    .padding(.top, 2)
                }

                if let stats = mission.stats, !stats.isEmpty, !failed {
                    HStack(spacing: 4) {
                        ForEach(stats, id: \.self) { s in
                            let c = StatTokens.colors[s] ?? SystemTokens.glowAccent
                            Text("+\(StatTokens.labels[s] ?? "—")")
                                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 8))
                                .tracking(0.6)
                                .foregroundColor(c)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(c.opacity(0.12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(c.opacity(0.33), lineWidth: 1)
                                )
                        }
                    }
                    .padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            xpBadge
        }
        .padding(14)
        .background(cardBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(cardBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .opacity(failed ? 0.6 : 1.0)
    }

    private var displayDescription: String {
        if failed { return "Missed this week" }
        if locked, let tg = mission.timeGate { return tg }
        return mission.description
    }

    @ViewBuilder
    private var iconBox: some View {
        ZStack {
            if done {
                Image(systemName: "checkmark")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(AppColors.success)
            } else if failed {
                Image(systemName: "xmark")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(AppColors.danger)
            } else if locked {
                Image(systemName: "lock.fill")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.textMuted)
            } else {
                Image(systemName: iconInfo.name)
                    .font(.system(size: 18))
                    .foregroundColor(iconInfo.color)
            }
        }
        .frame(width: 42, height: 42)
        .background(
            done ? Color(.sRGB, red: 0, green: 214/255, blue: 143/255, opacity: 0.1) :
            failed ? Color(.sRGB, red: 255/255, green: 71/255, blue: 87/255, opacity: 0.08) :
            iconInfo.color.opacity(0.07)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(
                    done ? Color(.sRGB, red: 0, green: 214/255, blue: 143/255, opacity: 0.15)
                         : Color.white.opacity(0.04),
                    lineWidth: 1
                )
        )
        .opacity(locked || failed ? 0.5 : 1.0)
    }

    @ViewBuilder
    private var slotBadge: some View {
        let label = failed ? "MISSED" : isWeekly ? "WEEKLY" : slotMeta.label
        let color = failed ? AppColors.danger : isWeekly ? AppColors.accent : slotMeta.color
        Text(label)
            .font(.custom(FontFamily.bodyMedium.rawValue, size: 8))
            .tracking(0.8)
            .foregroundColor(color)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(color.opacity(0.10))
            .cornerRadius(4)
    }

    @ViewBuilder
    private var xpBadge: some View {
        VStack(spacing: 1) {
            Text("+\(mission.xp)")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 13))
                .foregroundColor(done ? AppColors.textMuted : AppColors.warning)
            Text("XP")
                .font(.custom(FontFamily.body.rawValue, size: 9))
                .tracking(0.5)
                .foregroundColor(done ? AppColors.textMuted : AppColors.warning)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            done
            ? Color(.sRGB, red: 44/255, green: 52/255, blue: 64/255, opacity: 0.2)
            : Color(.sRGB, red: 255/255, green: 200/255, blue: 87/255, opacity: 0.08)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(
                    done ? Color.white.opacity(0.03)
                         : Color(.sRGB, red: 255/255, green: 200/255, blue: 87/255, opacity: 0.12),
                    lineWidth: 1
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .opacity(locked ? 0.4 : 1.0)
    }

    @ViewBuilder
    private func progressRow(progress: Double) -> some View {
        HStack(spacing: 6) {
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color(.sRGB, red: 44/255, green: 52/255, blue: 64/255, opacity: 0.5))
                    Rectangle()
                        .fill(failed ? AppColors.danger.opacity(0.55) : AppColors.accent)
                        .frame(width: proxy.size.width * progress)
                }
            }
            .frame(height: 4)
            .clipShape(RoundedRectangle(cornerRadius: 2))

            Text(progressCaption)
                .font(.custom(FontFamily.body.rawValue, size: 10))
                .foregroundColor(failed ? AppColors.danger : AppColors.textMuted)
        }
        .padding(.top, 4)
    }

    private var progressCaption: String {
        let cur = mission.progress ?? 0
        let tgt = mission.progressTarget ?? 0
        if mission.duration == .weekly {
            if mission.progressMetric == .firstOpenBefore9am {
                return "\(cur)/\(tgt) before 9am"
            }
            return "\(cur)/\(tgt) days"
        }
        return "\(cur)/\(tgt) min"
    }

    private var cardBackground: Color {
        if done {
            return Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.35)
        }
        if locked {
            return Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.3)
        }
        if failed {
            return Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.25)
        }
        return Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.6)
    }

    private var cardBorder: Color {
        if done {
            return Color(.sRGB, red: 0, green: 214/255, blue: 143/255, opacity: 0.08)
        }
        if locked {
            return Color.white.opacity(0.03)
        }
        if failed {
            return Color(.sRGB, red: 255/255, green: 71/255, blue: 87/255, opacity: 0.08)
        }
        return Color.white.opacity(0.05)
    }

    private func openDetail() {
        // Analytics — `Mission Viewed`. Forwarded via NotificationCenter so
        // the @Observable model doesn't need to be passed through the card.
        NotificationCenter.default.post(
            name: .missionsAnalyticsViewed,
            object: nil,
            userInfo: ["mission_id": mission.id, "mission_title": mission.title]
        )
        isDetailOpen = true
    }
}

// MARK: - Detail sheet

private struct MissionDetailSheet: View {
    let mission: Mission
    let onComplete: (String) -> Void
    let onClose: () -> Void
    let locked: Bool
    let slotMeta: (label: String, color: Color, desc: String)
    let iconInfo: (name: String, color: Color)

    private var done: Bool { mission.completed }
    private var failed: Bool { mission.failed == true }
    private var isWeekly: Bool { mission.duration == .weekly }

    var body: some View {
        VStack(alignment: .center, spacing: 0) {
            // Hero icon
            ZStack {
                Image(systemName: done ? "checkmark.circle.fill" : iconInfo.name)
                    .font(.system(size: 32))
                    .foregroundColor(done ? AppColors.success : iconInfo.color)
            }
            .frame(width: 64, height: 64)
            .background(iconInfo.color.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .padding(.bottom, 18)

            HStack(spacing: 8) {
                Text(mission.title)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 20))
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)
                Text(slotMeta.label)
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 9))
                    .tracking(0.8)
                    .foregroundColor(slotMeta.color)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(slotMeta.color.opacity(0.10))
                    .cornerRadius(5)
            }
            .padding(.bottom, 4)

            Text(slotMeta.desc)
                .font(.custom(FontFamily.body.rawValue, size: 11))
                .foregroundColor(AppColors.textMuted)
                .padding(.bottom, 16)

            Text(mission.description)
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(20 - 14)
                .padding(.horizontal, 8)
                .padding(.bottom, 18)

            // Actions
            HStack(spacing: 10) {
                Button(action: onClose) {
                    Text("Close")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                        .foregroundColor(AppColors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color(.sRGB, red: 44/255, green: 52/255, blue: 64/255, opacity: 0.4))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.05), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(PressOpacityButtonStyle())

                if !done && !isWeekly {
                    Button(action: {
                        if !locked {
                            HapticsService.shared.success()
                            onComplete(mission.id)
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(locked ? AppColors.textMuted : .white)
                            Text(locked ? "Locked" : "Complete")
                                .foregroundColor(locked ? AppColors.textMuted : .white)
                        }
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(locked
                            ? Color(.sRGB, red: 44/255, green: 52/255, blue: 64/255, opacity: 0.4)
                            : AppColors.primary
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                    .disabled(locked)
                }
            }
            .padding(.top, 8)
        }
        .padding(24)
    }
}

// MARK: - Analytics notification

public extension Notification.Name {
    /// Posted by MissionCard when the detail modal opens. Coordinator wires
    /// this to PostHog — payload: `["mission_id": String, "mission_title": String]`.
    static let missionsAnalyticsViewed = Notification.Name("LockedIn.MissionsAnalytics.MissionViewed")
}
