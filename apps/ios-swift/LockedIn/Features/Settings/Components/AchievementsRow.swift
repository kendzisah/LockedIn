import SwiftUI
import DesignKit

/// Horizontal-scroll achievement badge grid. Port of
/// `apps/mobile/src/features/settings/components/AchievementsRow.tsx`.
///
/// The RN version reads `ACHIEVEMENT_CATALOG` from a shared service and
/// queries `user_achievements` for the earned ids. The Swift catalog ships
/// with W4 (Missions / shared services). Until then this component renders
/// the panel chrome with the earned/total badge counts pulled from the
/// data passed by the parent.
struct AchievementsRow: View {
    let earnedCount: Int
    let totalCount: Int
    let entries: [Entry]

    public struct Entry: Identifiable, Equatable {
        public let id: String
        public let name: String
        public let earned: Bool
        public let categoryColor: Color

        public init(id: String, name: String, earned: Bool, categoryColor: Color) {
            self.id = id
            self.name = name
            self.earned = earned
            self.categoryColor = categoryColor
        }
    }

    init(earnedCount: Int = 0, totalCount: Int = 0, entries: [Entry] = []) {
        self.earnedCount = earnedCount
        self.totalCount = totalCount
        self.entries = entries
    }

    var body: some View {
        HUDPanel(
            headerLabel: "ACHIEVEMENTS",
            headerRight: "\(earnedCount)/\(totalCount)"
        ) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    if entries.isEmpty {
                        // Render 6 locked placeholders so the panel doesn't
                        // collapse when no data is wired yet.
                        ForEach(0..<6, id: \.self) { _ in
                            badgeCell(name: "—", earned: false, color: SystemTokens.textMuted)
                        }
                    } else {
                        ForEach(entries) { entry in
                            badgeCell(
                                name: entry.name,
                                earned: entry.earned,
                                color: entry.earned ? entry.categoryColor : SystemTokens.textMuted
                            )
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    @ViewBuilder
    private func badgeCell(name: String, earned: Bool, color: Color) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(earned ? color.opacity(0.1) : Color.white.opacity(0.02))
                Circle()
                    .stroke(earned ? color : Color.white.opacity(0.08), lineWidth: 1)
                Image(systemName: earned ? "trophy.fill" : "lock.fill")
                    .font(.system(size: 18))
                    .foregroundColor(color)
            }
            .frame(width: 44, height: 44)
            .shadow(color: earned ? color.opacity(0.4) : .clear, radius: 6)

            Text(name)
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 9))
                .tracking(0.4)
                .foregroundColor(earned ? SystemTokens.textPrimary : SystemTokens.textMuted)
                .lineLimit(1)
        }
        .frame(width: 64)
    }
}
