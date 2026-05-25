import SwiftUI
import DesignKit

/// TrialChallengeCard — Day-by-day progress card for the 3-Day Discipline
/// Challenge.
///
/// Ported 1:1 from `apps/mobile/src/features/trial/components/TrialChallengeCard.tsx`:
/// - Header: "3-Day Discipline Challenge" in `Colors.accent` (electric cyan).
/// - Three day circles (56×56, radius 28) with status:
///   * completed: filled accent, checkmark glyph
///   * current: transparent w/ 2px accent border, pulses 1.0 ↔ 1.1 over 1500ms
///   * future: transparent w/ 2px textMuted border
/// - Tasks list (today only) with 20×20 checkbox; checked rows show line-through.
/// - Footer "Trial ends in {h}h {m}m" in muted text.
///
/// Surface uses `AppColors.surface` (`#2C3440`) per the RN source — this is one
/// of the few RN screens that uses a flat surface rather than the glassmorphic
/// panel chrome. Preserved verbatim to avoid visual drift.
public struct TrialChallengeCard: View {
    public let isActive: Bool
    public let currentDay: Int       // 1, 2, or 3
    public let day1Complete: Bool
    public let day2FocusComplete: Bool
    public let day2MissionsComplete: Bool
    public let day3Complete: Bool
    public let hoursRemaining: Int
    public let minutesRemaining: Int

    @State private var pulseScale: CGFloat = 1.0

    public init(
        isActive: Bool,
        currentDay: Int,
        day1Complete: Bool,
        day2FocusComplete: Bool,
        day2MissionsComplete: Bool,
        day3Complete: Bool,
        hoursRemaining: Int,
        minutesRemaining: Int
    ) {
        self.isActive = isActive
        self.currentDay = currentDay
        self.day1Complete = day1Complete
        self.day2FocusComplete = day2FocusComplete
        self.day2MissionsComplete = day2MissionsComplete
        self.day3Complete = day3Complete
        self.hoursRemaining = hoursRemaining
        self.minutesRemaining = minutesRemaining
    }

    public var body: some View {
        if !isActive {
            EmptyView()
        } else {
            VStack(spacing: 0) {
                // Header
                Text("3-Day Discipline Challenge")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 18))
                    .foregroundColor(AppColors.accent)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 20)

                // Day circles
                HStack(alignment: .top, spacing: 0) {
                    ForEach([1, 2, 3], id: \.self) { day in
                        dayColumn(day)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.bottom, 24)

                // Today's tasks
                tasksContainer
                    .padding(.bottom, 16)

                // Trial expiry
                Text("Trial ends in \(hoursRemaining)h \(minutesRemaining)m")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 12))
                    .foregroundColor(AppColors.textMuted)
            }
            .padding(.vertical, 20)
            .padding(.horizontal, 16)
            .background(AppColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .onAppear {
                withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                    pulseScale = 1.1
                }
            }
        }
    }

    // MARK: - Day column

    @ViewBuilder
    private func dayColumn(_ day: Int) -> some View {
        let isCompleted = isDayCompleted(day)
        let isCurrent = day == currentDay

        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(circleFill(isCompleted: isCompleted, isCurrent: isCurrent))
                    .frame(width: 56, height: 56)
                    .overlay(
                        Circle()
                            .stroke(circleBorder(isCompleted: isCompleted, isCurrent: isCurrent),
                                    lineWidth: borderWidth(isCompleted: isCompleted, isCurrent: isCurrent))
                    )

                if isCompleted {
                    Text("✓")
                        .font(.system(size: 24))
                        .foregroundColor(AppColors.background)
                } else {
                    Text("\(day)")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 20))
                        .foregroundColor(dayTextColor(isCompleted: isCompleted, isCurrent: isCurrent))
                }
            }
            .scaleEffect(isCurrent ? pulseScale : 1.0)

            Text("Day \(day)")
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private func isDayCompleted(_ day: Int) -> Bool {
        switch day {
        case 1: return day1Complete
        case 2: return day2FocusComplete && day2MissionsComplete
        case 3: return day3Complete
        default: return false
        }
    }

    private func circleFill(isCompleted: Bool, isCurrent: Bool) -> Color {
        if isCompleted { return AppColors.accent }
        return Color.clear
    }

    private func circleBorder(isCompleted: Bool, isCurrent: Bool) -> Color {
        if isCompleted { return AppColors.accent }
        if isCurrent   { return AppColors.accent }
        return AppColors.textMuted
    }

    private func borderWidth(isCompleted: Bool, isCurrent: Bool) -> CGFloat {
        isCompleted ? 0 : 2
    }

    private func dayTextColor(isCompleted: Bool, isCurrent: Bool) -> Color {
        if isCompleted { return AppColors.background }
        if isCurrent   { return AppColors.accent }
        return AppColors.textMuted
    }

    // MARK: - Tasks

    @ViewBuilder
    private var tasksContainer: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(todaysTasks.enumerated()), id: \.offset) { _, task in
                taskRow(label: task.label, done: task.done)
            }
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColors.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    @ViewBuilder
    private func taskRow(label: String, done: Bool) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(done ? AppColors.accent : Color.clear)
                    .frame(width: 20, height: 20)
                    .overlay(
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .stroke(done ? AppColors.accent : AppColors.textMuted, lineWidth: 2)
                    )
                if done {
                    Text("✓")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 12))
                        .foregroundColor(AppColors.background)
                }
            }

            Text(label)
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .foregroundColor(done ? AppColors.textMuted : AppColors.textSecondary)
                .strikethrough(done, color: AppColors.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var todaysTasks: [(label: String, done: Bool)] {
        switch currentDay {
        case 1:
            return [("Complete your first Lock In session", day1Complete)]
        case 2:
            return [
                ("Beat yesterday's focus time", day2FocusComplete),
                ("Complete 2 missions", day2MissionsComplete)
            ]
        case 3:
            return [("See your first Discipline Report", day3Complete)]
        default:
            return []
        }
    }
}

#if DEBUG
#Preview("Trial — Day 1") {
    ZStack {
        ScreenGradient()
        TrialChallengeCard(
            isActive: true,
            currentDay: 1,
            day1Complete: false,
            day2FocusComplete: false,
            day2MissionsComplete: false,
            day3Complete: false,
            hoursRemaining: 71,
            minutesRemaining: 23
        )
    }
}

#Preview("Trial — Day 2, partial") {
    ZStack {
        ScreenGradient()
        TrialChallengeCard(
            isActive: true,
            currentDay: 2,
            day1Complete: true,
            day2FocusComplete: true,
            day2MissionsComplete: false,
            day3Complete: false,
            hoursRemaining: 47,
            minutesRemaining: 5
        )
    }
}
#endif
