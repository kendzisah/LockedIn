//
//  ScheduledSessionsPanel.swift
//  LockedIn — Scheduled Lock-In Sessions
//
//  HUD panel on the Home tab. Shows the count of scheduled sessions + the next
//  few upcoming occurrences; tapping opens the manage screen.
//

import SwiftUI
import DesignKit

struct ScheduledSessionsPanel: View {
    @Environment(ScheduledSessionsStore.self) private var store
    let onManage: () -> Void

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEE"   // Mon
        return f
    }()

    var body: some View {
        HUDPanel(
            headerLabel: "SCHEDULED",
            headerRight: store.sessions.isEmpty ? nil : "\(store.enabledCount)",
            onPress: onManage
        ) {
            VStack(alignment: .leading, spacing: 10) {
                if store.sessions.isEmpty {
                    emptyState
                } else {
                    let upcoming = store.upcomingOccurrences(limit: 3)
                    if upcoming.isEmpty {
                        Text("No upcoming sessions")
                            .font(.custom(FontFamily.body.rawValue, size: 13))
                            .foregroundColor(SystemTokens.textMuted)
                    } else {
                        ForEach(Array(upcoming.enumerated()), id: \.offset) { _, item in
                            occurrenceRow(session: item.session, date: item.date)
                        }
                    }
                    manageRow
                }
            }
        }
    }

    private var emptyState: some View {
        HStack(spacing: 8) {
            Image(systemName: "calendar.badge.plus")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(SystemTokens.cyan)
            Text("Schedule a lock-in to auto-block apps")
                .font(.custom(FontFamily.body.rawValue, size: 13))
                .foregroundColor(SystemTokens.textSecondary)
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(SystemTokens.textMuted)
        }
    }

    private func occurrenceRow(session: ScheduledSession, date: Date) -> some View {
        HStack(spacing: 10) {
            Text(Self.dayFormatter.string(from: date).uppercased())
                .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                .tracking(0.8)
                .foregroundColor(SystemTokens.cyan)
                .frame(width: 34, alignment: .leading)

            Text(session.displayLabel)
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                .foregroundColor(SystemTokens.textPrimary)
                .lineLimit(1)

            Spacer(minLength: 8)

            Text("\(session.startTimeString) · \(session.durationMinutes)m")
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 12))
                .foregroundColor(SystemTokens.textSecondary)
                .lineLimit(1)
        }
    }

    private var manageRow: some View {
        HStack {
            Spacer()
            Text("MANAGE")
                .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                .tracking(1.4)
                .foregroundColor(SystemTokens.glowAccent)
            Image(systemName: "chevron.right")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(SystemTokens.glowAccent)
        }
        .padding(.top, 2)
    }
}
