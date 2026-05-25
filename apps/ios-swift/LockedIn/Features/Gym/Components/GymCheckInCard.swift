import SwiftUI
import DesignKit

/// GymCheckInCard — Glassmorphic gym check-in card with weekly dots, streak,
/// and a toggle-able "I Trained Today" button.
///
/// Ported 1:1 from `apps/mobile/src/features/gym/components/GymCheckInCard.tsx`:
/// - Surface: `rgba(21,26,33,0.6)`, 16 radius, white 0.05 border, 18 padding.
/// - Icon box: 40×40 / 12 radius / `rgba(0,214,143,0.1)` bg w/ `0.12` border.
/// - Streak badge: green flame + "{n}d" pill.
/// - Check-in CTA: 12 radius pill, "I Trained Today" → "Checked In!" with
///   filled success bg when active.
/// - Week row: 7 dots (24×24 / radius 12) Mon..Sun with M/T/W/T/F/S/S labels.
/// - Counter: "{count}/7 this week" at the bottom, separated by a divider.
///
/// Haptics: medium impact on tap, plus `.success` notification when toggling on.
public struct GymCheckInCard: View {
    public let showGym: Bool
    /// Notifies the parent of check-in state changes.
    public let onCheckInChange: ((Bool) -> Void)?

    @State private var isCheckedIn: Bool = false
    @State private var weeklyCount: Int = 0
    @State private var streak: Int = 0
    @State private var weekCheckins: [Bool] = []
    @State private var loaded: Bool = false

    private static let dayLabels = ["M", "T", "W", "T", "F", "S", "S"]

    public init(showGym: Bool, onCheckInChange: ((Bool) -> Void)? = nil) {
        self.showGym = showGym
        self.onCheckInChange = onCheckInChange
    }

    public var body: some View {
        if !showGym || !loaded {
            Color.clear
                .frame(width: 0, height: 0)
                .onAppear { if !loaded { loadData() } }
        } else {
            content
                .onAppear { if !loaded { loadData() } }
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(spacing: 0) {
            header
                .padding(.bottom, 16)

            checkInButton
                .padding(.bottom, 18)

            weekRow
                .padding(.bottom, 14)

            counterRow
                .padding(.top, 12)
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(Color.white.opacity(0.04))
                        .frame(height: 1)
                }
        }
        .padding(18)
        .background(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.6))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.05), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Header

    @ViewBuilder
    private var header: some View {
        HStack(alignment: .center, spacing: 0) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color(.sRGB, red: 0/255, green: 214/255, blue: 143/255, opacity: 0.10))
                        .frame(width: 40, height: 40)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(Color(.sRGB, red: 0/255, green: 214/255, blue: 143/255, opacity: 0.12), lineWidth: 1)
                        )
                    Image(systemName: "dumbbell")
                        .font(.system(size: 18))
                        .foregroundColor(AppColors.success)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text("Gym Check-In")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 15))
                        .foregroundColor(AppColors.textPrimary)
                    Text("Did you train today?")
                        .font(.custom(FontFamily.body.rawValue, size: 12))
                        .foregroundColor(AppColors.textMuted)
                }
            }

            Spacer(minLength: 8)

            if streak > 0 {
                streakBadge
            }
        }
    }

    @ViewBuilder
    private var streakBadge: some View {
        HStack(spacing: 3) {
            Image(systemName: "flame.fill")
                .font(.system(size: 12))
                .foregroundColor(AppColors.success)
            Text("\(streak)d")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 12))
                .foregroundColor(AppColors.success)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(.sRGB, red: 0/255, green: 214/255, blue: 143/255, opacity: 0.10))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color(.sRGB, red: 0/255, green: 214/255, blue: 143/255, opacity: 0.12), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    // MARK: - Check-in button

    @ViewBuilder
    private var checkInButton: some View {
        Button(action: handleCheckIn) {
            HStack(spacing: 8) {
                Image(systemName: isCheckedIn ? "checkmark.circle.fill" : "figure.strengthtraining.traditional")
                    .font(.system(size: 18))
                    .foregroundColor(isCheckedIn ? .white : AppColors.success)
                Text(isCheckedIn ? "Checked In!" : "I Trained Today")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                    .foregroundColor(isCheckedIn ? .white : AppColors.success)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(checkInButtonBg)
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(checkInButtonBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(PressOpacityButtonStyle())
    }

    private var checkInButtonBg: Color {
        isCheckedIn
            ? AppColors.success
            : Color(.sRGB, red: 0/255, green: 214/255, blue: 143/255, opacity: 0.08)
    }

    private var checkInButtonBorder: Color {
        isCheckedIn
            ? AppColors.success
            : Color(.sRGB, red: 0/255, green: 214/255, blue: 143/255, opacity: 0.15)
    }

    // MARK: - Week row

    @ViewBuilder
    private var weekRow: some View {
        HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { i in
                let checked = i < weekCheckins.count ? weekCheckins[i] : false
                VStack(spacing: 5) {
                    ZStack {
                        Circle()
                            .fill(checked
                                  ? AppColors.success
                                  : Color(.sRGB, red: 44/255, green: 52/255, blue: 64/255, opacity: 0.5))
                            .frame(width: 24, height: 24)
                            .overlay(
                                Circle()
                                    .stroke(checked ? AppColors.success : Color.white.opacity(0.04), lineWidth: 1)
                            )
                        if checked {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                    Text(Self.dayLabels[i])
                        .font(.custom(FontFamily.body.rawValue, size: 10))
                        .foregroundColor(checked ? AppColors.success : AppColors.textMuted)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 4)
    }

    // MARK: - Counter

    @ViewBuilder
    private var counterRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text("\(weeklyCount)")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 18))
                .foregroundColor(AppColors.textPrimary)
            Text("/7 this week")
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .foregroundColor(AppColors.textMuted)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Data

    private func loadData() {
        let service = GymCheckInService.shared
        self.isCheckedIn = service.isCheckedInToday()
        self.weeklyCount = service.getWeeklyCount()
        self.streak = service.getStreak()
        self.weekCheckins = service.getWeekCheckIns()
        self.loaded = true
    }

    private func handleCheckIn() {
        HapticsService.shared.medium()

        let service = GymCheckInService.shared
        _ = service.checkIn()

        let newIsCheckedIn = !isCheckedIn
        self.isCheckedIn = newIsCheckedIn
        self.weeklyCount = newIsCheckedIn
            ? weeklyCount + 1
            : max(0, weeklyCount - 1)
        self.weekCheckins = service.getWeekCheckIns()
        self.streak = service.getStreak()
        onCheckInChange?(newIsCheckedIn)

        if newIsCheckedIn {
            HapticsService.shared.success()
        }
    }
}

#if DEBUG
#Preview("Gym — not checked in") {
    ZStack {
        ScreenGradient()
        GymCheckInCard(showGym: true)
            .padding(.horizontal, 16)
    }
}
#endif
