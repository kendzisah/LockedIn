import SwiftUI
import DesignKit

/// WakeUpCallScreen — Step 3: shock stat showing "years of life lost".
///
/// Mirrors Opal's Focus Report layout: red TIME LOST panel with count-up
/// + animated bar, then green TIME RECLAIMED panel.
///
/// Port of `screens/WakeUpCallScreen.tsx`.
struct WakeUpCallScreen: View {
    @Environment(OnboardingState.self) private var state
    let onContinue: () -> Void

    @State private var tracker = OnboardingScreenTracker(.wakeUpCall)
    @State private var screenOpacity: Double = 0
    @State private var barFill: Double = 0
    @State private var pulse: Double = 1
    @State private var isAdvancing = false

    private var hours: Double { OnboardingEngine.parseHours(from: state.phoneUsageHours) }
    private var yearsExact: Double { OnboardingEngine.calcYearsLost(hours: hours, age: state.userAge) }
    private var yearsRounded: Int { Int(yearsExact.rounded()) }
    private var days: Int { Int((yearsExact * 365).rounded()) }
    private var hoursReclaimed: Double { OnboardingEngine.reclaimedHours(hours) }
    private var hoursRemaining: Double { OnboardingEngine.remainingHours(hours) }
    private var reclaimDaysPerYear: Int { OnboardingEngine.reclaimDaysPerYear(reclaimedHours: hoursReclaimed) }
    private var phoneFraction: Double { min(0.95, hours / 10.0) }

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(spacing: 0) {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        HUDSectionLabel("SYSTEM ALERT", accentColor: SystemTokens.red)

                        Text("HERE'S WHAT THAT COSTS YOU")
                            .font(.custom(FontFamily.heading.rawValue, size: 24))
                            .tracking(-0.3)
                            .foregroundColor(SystemTokens.red)
                            .shadow(color: SystemTokens.red, radius: 12)
                            .padding(.bottom, 18)

                        timeLostPanel
                            .padding(.bottom, 16)

                        Text("BUT HERE'S THE FLIP")
                            .font(.custom(FontFamily.display.rawValue, size: 9))
                            .tracking(1.8)
                            .foregroundColor(SystemTokens.green)
                            .padding(.top, 12)

                        Text("You can reclaim 80%.")
                            .font(.custom(FontFamily.heading.rawValue, size: 24))
                            .tracking(-0.3)
                            .foregroundColor(SystemTokens.green)
                            .shadow(color: SystemTokens.green, radius: 12)
                            .padding(.top, 6)
                            .padding(.bottom, 14)

                        timeReclaimedPanel
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 24)
                    .padding(.bottom, 32)
                }

                VStack {
                    PrimaryButton("> I'M READY TO CHANGE", action: handleContinue)
                        .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 40)
                .background(AppColors.background)
            }
            .opacity(screenOpacity)
        }
        .onAppear {
            tracker.didAppear()
            withAnimation(.easeOut(duration: 0.5)) { screenOpacity = 1 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                withAnimation(.easeOut(duration: 1.6)) { barFill = phoneFraction }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                    pulse = 0.7
                }
            }
        }
        .onDisappear { tracker.didDisappear() }
    }

    private var timeLostPanel: some View {
        OnboardingHUDPanel(headerLabel: "TIME LOST", accentColor: SystemTokens.red) {
            VStack(spacing: 0) {
                VStack(spacing: 0) {
                    CountUpNumber(value: yearsRounded, duration: 1.4, startDelay: 0.2)
                        .font(.custom(FontFamily.heading.rawValue, size: 64))
                        .tracking(-1)
                        .foregroundColor(SystemTokens.red)
                        .shadow(color: SystemTokens.red, radius: 16)
                    Text("YEARS")
                        .font(.custom(FontFamily.heading.rawValue, size: 14))
                        .tracking(4)
                        .foregroundColor(SystemTokens.red)
                        .padding(.top, -4)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)

                Text("of your life will be spent staring at your phone")
                    .font(.custom(FontFamily.body.rawValue, size: 14))
                    .foregroundColor(SystemTokens.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.top, 14)

                HStack(spacing: 4) {
                    Text("That's")
                    Text("\(days.formatted())")
                        .foregroundColor(SystemTokens.red)
                        .font(.custom(FontFamily.heading.rawValue, size: 15))
                    Text("full days. Gone. On nothing.")
                }
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 15))
                .foregroundColor(AppColors.textPrimary)
                .padding(.top, 12)
                .multilineTextAlignment(.center)

                // Animated life bar
                VStack(spacing: 10) {
                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            Rectangle().fill(Color.white.opacity(0.08))
                            Rectangle()
                                .fill(SystemTokens.red)
                                .frame(width: proxy.size.width * barFill)
                                .shadow(color: SystemTokens.red.opacity(0.6), radius: 10)
                                .opacity(pulse)
                            Rectangle()
                                .fill(Color.white)
                                .frame(width: 3)
                                .shadow(color: SystemTokens.red.opacity(0.9), radius: 8)
                                .offset(x: proxy.size.width * barFill - 3)
                                .opacity(pulse)
                        }
                    }
                    .frame(height: 18)

                    HStack {
                        Text("PHONE")
                            .font(.custom(FontFamily.display.rawValue, size: 8))
                            .tracking(1.6)
                            .foregroundColor(SystemTokens.red)
                        Spacer()
                        Text("EVERYTHING ELSE")
                            .font(.custom(FontFamily.display.rawValue, size: 8))
                            .tracking(1.6)
                            .foregroundColor(SystemTokens.textMuted)
                    }
                }
                .padding(.top, 22)
            }
        }
    }

    private var timeReclaimedPanel: some View {
        OnboardingHUDPanel(headerLabel: "TIME RECLAIMED", accentColor: SystemTokens.green) {
            VStack(spacing: 0) {
                VStack(spacing: 0) {
                    HStack(alignment: .lastTextBaseline, spacing: 4) {
                        Text(String(format: "%.1f", hoursReclaimed))
                            .font(.custom(FontFamily.heading.rawValue, size: 44))
                        Text("hrs/day")
                            .font(.custom(FontFamily.heading.rawValue, size: 18))
                    }
                    .foregroundColor(SystemTokens.green)
                    .shadow(color: SystemTokens.green, radius: 14)
                    Text("back in your hands")
                        .font(.custom(FontFamily.body.rawValue, size: 13))
                        .foregroundColor(SystemTokens.textMuted)
                        .padding(.top, 4)
                }
                .frame(maxWidth: .infinity)

                // Chrome label so the WITHOUT / WITH columns are unambiguous.
                Text("DAILY SCREEN TIME")
                    .font(.custom(FontFamily.display.rawValue, size: 9))
                    .tracking(1.8)
                    .foregroundColor(SystemTokens.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 22)

                HStack(spacing: 24) {
                    compareCol(value: "\(Int(hours)) hrs", label: "WITHOUT", color: SystemTokens.red, isFull: true)
                    compareCol(value: "\(String(format: "%.1f", hoursRemaining)) hrs", label: "WITH", color: SystemTokens.green, isFull: false)
                }
                .padding(.top, 10)

                Text("That's about \(reclaimDaysPerYear) extra days a year — back on what actually moves you forward.")
                    .font(.custom(FontFamily.body.rawValue, size: 13))
                    .lineSpacing(5)
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 16)
                    .padding(.horizontal, 4)
            }
        }
    }

    private func compareCol(value: String, label: String, color: Color, isFull: Bool) -> some View {
        let pct: CGFloat = isFull ? 1.0 : CGFloat(hoursRemaining / max(hours, 1))
        return VStack(spacing: 6) {
            Text(value)
                .font(.custom(FontFamily.heading.rawValue, size: 18))
                .foregroundColor(color)
            ZStack(alignment: .bottom) {
                Rectangle().fill(Color.white.opacity(0.04))
                Rectangle().fill(color.opacity(0.85))
                    .frame(height: 80 * pct)
            }
            .frame(width: 28, height: 80)
            Text(label)
                .font(.custom(FontFamily.display.rawValue, size: 8))
                .tracking(1.6)
                .foregroundColor(color == SystemTokens.green ? SystemTokens.green : SystemTokens.textMuted)
        }
        .frame(maxWidth: .infinity)
    }

    private func handleContinue() {
        guard !isAdvancing else { return }
        isAdvancing = true
        HapticsService.shared.heavy()
        withAnimation(.easeOut(duration: 0.4)) { screenOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onContinue() }
    }
}
