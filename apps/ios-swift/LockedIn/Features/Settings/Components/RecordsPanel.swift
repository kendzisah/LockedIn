import SwiftUI
import DesignKit

/// Lifetime stats panel. Port of
/// `apps/mobile/src/features/settings/components/RecordsPanel.tsx`.
///
/// Subscribes to (the eventual) `StatsService` for live updates. Until W3
/// wires it, this binds to the `UserStatsLite` passed by the screen owner.
struct RecordsPanel: View {
    let stats: UserStatsLite?

    private struct Row: Identifiable {
        let id = UUID()
        let label: String
        let value: String
    }

    private var rows: [Row] {
        [
            Row(label: "Longest streak",
                value: "\(stats?.longestStreakDays ?? 0) days"),
            Row(label: "Total sessions",
                value: "\(stats?.totalCompletedSessions ?? 0)"),
            Row(label: "Focus minutes",
                value: "\(stats?.totalFocusMinutes ?? 0)"),
            Row(label: "Missions done",
                value: "\(stats?.totalMissionsCompleted ?? 0)"),
            Row(label: "Perfect days",
                value: "\(stats?.totalPerfectDays ?? 0)")
        ]
    }

    var body: some View {
        HUDPanel(headerLabel: "RECORDS") {
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { idx, row in
                    HStack {
                        Text(row.label)
                            .font(.custom(FontFamily.body.rawValue, size: 14))
                            .foregroundColor(SystemTokens.textMuted)
                        Spacer()
                        Text(row.value)
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                            .tracking(-0.2)
                            .foregroundColor(SystemTokens.textPrimary)
                    }
                    .padding(.vertical, 10)
                    if idx < rows.count - 1 {
                        Rectangle()
                            .fill(SystemTokens.divider)
                            .frame(height: 1)
                    }
                }
            }
        }
    }
}
