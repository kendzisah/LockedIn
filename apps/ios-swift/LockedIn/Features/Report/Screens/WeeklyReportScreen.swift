import SwiftUI
import DesignKit

/// WeeklyReportScreen — Full-screen modal that shows the user their weekly
/// discipline grade, key counters, performance bar, system stats, and a
/// recommendation for the lowest stat.
///
/// Ported 1:1 from `apps/mobile/src/features/report/screens/WeeklyReportScreen.tsx`.
///
/// **Route name:** `ReportRoute.weeklyReport` (`"WeeklyReport"`), matching
/// `MainStackParamList.WeeklyReport` from `apps/mobile/src/types/navigation.ts:62`.
/// Presentation: fade modal (see `MainNavigator.tsx:88-92`).
///
/// **Cross-feature dependencies** (the coordinator wires these in):
///   - `report`: the pre-built `WeeklyReport`. The coordinator calls
///     `WeeklyReportService.shared.generateWeeklyReport(...)` immediately
///     before pushing this screen, passing the values that come from:
///       - sessionState (W3 `HomeState` → `weekCompletedDays.count`,
///         `lifetimeExecutionMinutes` for the current week)
///       - missionsState (W4)
///       - `dailyCommitmentMinutes` (W2 onboarding)
///   - `currentStats`: the `UserStatsRow` payload used to build the
///     recommendation. Sourced from W8/W3's `StatsService` once it lands;
///     until then the screen accepts `nil` and hides the recommendation.
///   - `onDismiss`: optional override. When `nil`, the screen pops itself via
///     SwiftUI's `dismiss` environment, mirroring RN's `navigation.goBack()`.
///
/// **Analytics:** Fires `Weekly Report Viewed` once on first render with:
///   - `grade`, `streak_days`, `score` (`= totalFocusMinutes` per RN parity).
struct WeeklyReportScreen: View {
    @Environment(\.dismiss) private var dismiss

    // ── Injected from the coordinator ──
    let report: WeeklyReport
    let currentStats: UserStatsRow?
    let onDismiss: (() -> Void)?

    init(
        report: WeeklyReport = .defaultReport(),
        currentStats: UserStatsRow? = nil,
        onDismiss: (() -> Void)? = nil
    ) {
        self.report = report
        self.currentStats = currentStats
        self.onDismiss = onDismiss
    }

    var body: some View {
        ZStack {
            // Solid background — RN uses `Colors.background` flat. We layer
            // the standard screen gradient for HUD continuity with the rest
            // of the app while preserving the same perceptual value.
            ScreenGradient()

            // One ambient blue glow orb behind the grade card for depth
            // (Design Fidelity §3 — every screen carries 1-2 glow orbs).
            GlowOrb(preset: .blue, size: 240, blurRadius: 70)
                .offset(x: 100, y: -200)

            ScrollView {
                VStack(spacing: 0) {
                    // ── Close button (top-right) ──
                    HStack {
                        Spacer()
                        Button(action: handleDismiss) {
                            Image(systemName: "xmark")
                                .font(.system(size: 22, weight: .medium))
                                .foregroundColor(AppColors.textSecondary)
                                .padding(8)
                        }
                        .buttonStyle(PressOpacityButtonStyle())
                        .accessibilityLabel("Close")
                    }
                    .padding(.bottom, 4)

                    // ── Title ──
                    Text("Your Discipline Report")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 32))
                        .foregroundColor(AppColors.textPrimary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, 28)

                    // ── Grade card ──
                    GradeCard(grade: report.grade)
                        .padding(.bottom, 20)

                    // ── Grade message ──
                    Text(gradeMessage)
                        .font(.custom(FontFamily.bodyMedium.rawValue, size: 16))
                        .foregroundColor(AppColors.textPrimary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(6)
                        .padding(.bottom, 32)

                    // ── 2×2 stat grid ──
                    statGrid
                        .padding(.bottom, 32)

                    // ── Performance bar ──
                    PerformanceBar(percentile: report.percentile)
                        .padding(.bottom, 32)

                    // ── System stats card (when available) ──
                    // TODO(post-launch): wire in `SystemStatsCard` once W8
                    // exposes a public, reusable Swift view. The RN screen
                    // reads the same StatsService subscription that drives
                    // the Profile tab. Skipping the section is harmless —
                    // the recommendation block below is self-sufficient.

                    // ── System recommendation (lowest stat) ──
                    if let recommendation {
                        recommendationCard(recommendation)
                            .padding(.bottom, 20)
                    }

                    // ── CTA ──
                    Button(action: handleDismiss) {
                        HStack(spacing: 8) {
                            Text("Keep Going")
                                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                                .foregroundColor(AppColors.textPrimary)

                            Image(systemName: "arrow.right")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(AppColors.textPrimary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .padding(.horizontal, 20)
                        .background(AppColors.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                    .padding(.bottom, 40)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
            }
            .scrollIndicators(.hidden)
        }
        .onAppear {
            ReportAnalytics.log(
                ReportAnalyticsEvent.weeklyReportViewed,
                properties: [
                    "grade": report.grade.rawValue,
                    "streak_days": report.streakDays,
                    "score": report.totalFocusMinutes,
                ]
            )
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var statGrid: some View {
        // 2 columns × 2 rows, 12pt gap — matches `styles.statsGrid` (gap: 12).
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                ReportStatBox(
                    value: "\(report.daysLockedIn)/7",
                    label: "Days Locked In"
                )
                ReportStatBox(
                    value: "\(report.totalFocusMinutes)",
                    label: "Focus Minutes"
                )
            }
            HStack(spacing: 12) {
                ReportStatBox(
                    value: "\(report.missionsCompleted)/\(report.totalMissions)",
                    label: "Missions"
                )
                ReportStatBox(
                    value: "\(report.streakDays)",
                    label: "Day Streak"
                )
            }
        }
    }

    @ViewBuilder
    private func recommendationCard(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SYSTEM RECOMMENDATION")
                .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                .tracking(1.4)
                .foregroundColor(AppColors.accent)

            Text(text)
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .foregroundColor(AppColors.textPrimary)
                .lineSpacing(6)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(Color(.sRGB, red: 0/255, green: 194/255, blue: 255/255, opacity: 0.06))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color(.sRGB, red: 0/255, green: 194/255, blue: 255/255, opacity: 0.22), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.bottom, 8)
    }

    // MARK: - Logic

    /// Build the recommendation string for the user's lowest stat. Mirrors
    /// `buildRecommendation()` in `WeeklyReportScreen.tsx:56-67`.
    private var recommendation: String? {
        guard let stats = currentStats else { return nil }
        let entries: [(Stat, Int)] = [
            (.discipline,  stats.discipline),
            (.focus,       stats.focus),
            (.execution,   stats.execution),
            (.consistency, stats.consistency),
            (.social,      stats.social),
        ]
        let lowest = entries.min { $0.1 < $1.1 }?.0
        return lowest.flatMap { Self.statAdvice[$0] }
    }

    /// Per-stat advice copy. 1:1 from `STAT_ADVICE` (`WeeklyReportScreen.tsx:43-54`).
    private static let statAdvice: [Stat: String] = [
        .discipline:
            "Your Discipline is lagging. Try blocking distractions during your weakest window — every resisted attempt builds it.",
        .focus:
            "Your Focus stat needs work. Ship one extra 30+ min session this week — that single block moves the needle.",
        .execution:
            "Execution is your weak spot. Hit all 3 daily missions for the next 3 days — perfect-day bonuses compound fast.",
        .consistency:
            "Consistency is the gap. Don't miss a single day this week. Even a 5-min session keeps the streak alive.",
        .social:
            "Social is your lowest stat. Invite a friend or check in with your guild — accountability multiplies discipline.",
    ]

    /// Build the "You went from X to Y" line. Mirrors `getGradeMessage()`
    /// from `WeeklyReportScreen.tsx:119-139`.
    private var gradeMessage: String {
        guard let prev = report.previousGrade else {
            return "You got an \(report.grade.rawValue)!"
        }
        let curr = report.grade.order
        let prevOrder = prev.order
        if curr < prevOrder {
            return "You went from \(prev.rawValue) to \(report.grade.rawValue)! Great progress!"
        }
        if curr > prevOrder {
            return "You went from \(prev.rawValue) to \(report.grade.rawValue). Let's bounce back!"
        }
        return "You held steady at \(report.grade.rawValue)!"
    }

    /// Dismiss handler — fires success haptic, marks the week as shown so
    /// the gate stays closed for the rest of the week, then exits.
    private func handleDismiss() {
        HapticsService.shared.success()
        WeeklyReportService.shared.markReportAsShown()
        if let onDismiss {
            onDismiss()
        } else {
            dismiss()
        }
    }
}

// MARK: - UserStatsRow shim

/// Minimal stat-row payload consumed by the recommendation block.
///
/// **Cross-feature dependency:** this mirrors `UserStatsRow` from
/// `@lockedin/shared-types` (RN). W8 (Settings) and a future shared Models
/// module will replace this with the canonical type. Until then the Report
/// feature defines a private shape so it can compile + be screen-previewed
/// independently of the rest of the fleet.
public struct UserStatsRow: Equatable, Sendable {
    public let discipline: Int
    public let focus: Int
    public let execution: Int
    public let consistency: Int
    public let social: Int
    public let ovr: Int
    public let totalXp: Int
    public let currentStreakDays: Int

    public init(
        discipline: Int,
        focus: Int,
        execution: Int,
        consistency: Int,
        social: Int,
        ovr: Int = 1,
        totalXp: Int = 0,
        currentStreakDays: Int = 0
    ) {
        self.discipline = discipline
        self.focus = focus
        self.execution = execution
        self.consistency = consistency
        self.social = social
        self.ovr = ovr
        self.totalXp = totalXp
        self.currentStreakDays = currentStreakDays
    }
}

// MARK: - Previews

#Preview("Default — F grade") {
    WeeklyReportScreen()
}

#Preview("A+ improved from B") {
    WeeklyReportScreen(
        report: WeeklyReport(
            weekStartDate: "2025-05-11T00:00:00.000Z",
            daysLockedIn: 7,
            totalFocusMinutes: 480,
            missionsCompleted: 19,
            totalMissions: 21,
            streakDays: 14,
            grade: .aPlus,
            previousGrade: .b,
            percentile: 97
        ),
        currentStats: UserStatsRow(
            discipline: 42, focus: 51, execution: 38, consistency: 60, social: 12
        )
    )
}

#Preview("D with social recommendation") {
    WeeklyReportScreen(
        report: WeeklyReport(
            weekStartDate: "2025-05-11T00:00:00.000Z",
            daysLockedIn: 2,
            totalFocusMinutes: 60,
            missionsCompleted: 4,
            totalMissions: 21,
            streakDays: 0,
            grade: .d,
            previousGrade: .c,
            percentile: 32
        ),
        currentStats: UserStatsRow(
            discipline: 25, focus: 30, execution: 22, consistency: 18, social: 8
        )
    )
}
