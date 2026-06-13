//
//  PaywallOfferScreen.swift
//  LockedIn
//
//  Mid-app modal paywall — presented as a fullScreenCover when a non-subscribed
//  user taps Lock In. Hard gate before a paid session can begin.
//
//  Fourth-iteration layout. Prior attempts (sibling VStack around ScrollView,
//  modifier-order swap, then safeAreaInset) all reproduced the same bug on
//  iPhone 17 Pro hardware: the column shifted off the leading edge so the
//  "What" of the headline and the leading digits of the projection labels
//  got clipped, while the footer rendered correctly. The common factor was
//  unbounded width proposals propagating upstream through chains of
//  `.frame(maxWidth: .infinity)` and `.scaledToFill()` on the staircase
//  image's `Image.resizable()` background — both of which broadcast
//  "I want infinity" through the parent ZStack and inflated the apparent
//  width of the column the inner content was leading-aligned within.
//
//  This rewrite:
//   - Wraps the entire body in a `GeometryReader` and pins **every layer**
//     to `width: w` from the proxy — no `.frame(maxWidth: .infinity)`
//     anywhere. Layout is fully deterministic.
//   - Drops the staircase image. The deep gradient + glow orbs carry the
//     "compounded effort" mood without the bounded-image risk surface.
//   - Replaces the CTA with a genuinely glassy button: `.ultraThinMaterial`
//     substrate, **cyan** glaze (matching the stat card / projection bar
//     accent so it actually fits the screen palette), bevelled top rim,
//     dual cyan glow shadows, and the preserved shineSweep.
//

import SwiftUI
import DesignKit

/// Mid-app paywall (presented modally from MainNavigator's `PaywallOffer`).
public struct PaywallOfferScreen: View {
    @Environment(SubscriptionState.self) private var subscription
    @Environment(\.dismiss) private var dismiss

    // MARK: - Animation state

    @State private var screenOpacity: Double = 1
    @State private var headlineOpacity: Double = 0
    @State private var headlineY: CGFloat = 16
    @State private var statOpacity: Double = 0
    @State private var statScale: CGFloat = 0.94
    @State private var benefitOpacities: [Double] = Array(repeating: 0, count: 4)
    @State private var projOpacity: Double = 0
    @State private var projBarProgress: [Double] = [0, 0, 0, 0]
    @State private var buttonOpacity: Double = 0
    @State private var showingPaywall = false

    // MARK: - Inputs

    /// Daily focus minutes (from onboarding). Defaults to 60 if unknown.
    private let dailyMinutes: Int?

    public init(dailyMinutes: Int? = nil) {
        self.dailyMinutes = dailyMinutes
    }

    // MARK: - Derived

    private var projections: [Projection] {
        [
            Projection(period: "90 Days", hours: Self.reclaimedHours(dailyMinutes: dailyMinutes, days: 90)),
            Projection(period: "1 Year",  hours: Self.reclaimedHours(dailyMinutes: dailyMinutes, days: 365)),
            Projection(period: "3 Years", hours: Self.reclaimedHours(dailyMinutes: dailyMinutes, days: 365 * 3)),
            Projection(period: "5 Years", hours: Self.reclaimedHours(dailyMinutes: dailyMinutes, days: 365 * 5)),
        ]
    }

    public var body: some View {
        ZStack {
            // Background extends edge-to-edge under the Dynamic Island and
            // home indicator. Pinned via GeometryReader inside the helper
            // so it can't propose an over-wide frame.
            backgroundFullBleed
                .ignoresSafeArea()

            // Content respects the safe area — no more headline sliding
            // under the Dynamic Island.
            GeometryReader { proxy in
                let w = proxy.size.width
                let h = proxy.size.height
                let innerW = max(0, w - 48) // 24pt horizontal padding each side

                VStack(spacing: 0) {
                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 24) {
                            header(width: innerW)
                            statCard(width: innerW)
                            benefitsList(width: innerW)
                            projectionsView(width: innerW)
                                .opacity(projOpacity)
                            // Bottom breathing room so the last row clears
                            // the CTA footer with comfortable padding.
                            Color.clear.frame(width: innerW, height: 120)
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 24)
                        .frame(width: w, alignment: .leading)
                    }
                    .frame(width: w)
                    .scrollBounceBehavior(.basedOnSize)
                    .scrollIndicators(.hidden)
                    .opacity(screenOpacity)

                    footer(width: w)
                }
                .frame(width: w, height: h)
            }
        }
        .preferredColorScheme(.dark)
        .paywall(
            isPresented: $showingPaywall,
            state: subscription,
            source: "lock_in"
        ) { subscribed in
            if subscribed {
                AnalyticsService.shared.track("Subscription Started", properties: ["source": "lock_in"])
                fadeOutAndDismiss()
            } else {
                AnalyticsService.shared.track("Paywall Dismissed", properties: [
                    "source": "lock_in",
                    "reason": "cancelled",
                ])
                dismiss()
            }
        }
        .onAppear(perform: runEntryAnimations)
    }

    // MARK: - Background

    /// Edge-to-edge background. Wrapped in its own `GeometryReader` so
    /// glow-orb offsets can be expressed relative to the full bleed area
    /// (status bar + home indicator included) without inheriting the
    /// safe-area-respecting frame of the content GeometryReader.
    private var backgroundFullBleed: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = proxy.size.height
            ZStack {
                AppColors.background
                    .frame(width: w, height: h)

                // Cyan accent glow, top-left — echoes the stat card tint.
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.30),
                                Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.00),
                            ],
                            center: .center,
                            startRadius: 0,
                            endRadius: 240
                        )
                    )
                    .frame(width: 480, height: 480)
                    .offset(x: -160, y: -200)
                    .blur(radius: 40)

                // Discipline-Blue glow, bottom-right — anchors the CTA region.
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                AppColors.primary.opacity(0.32),
                                AppColors.primary.opacity(0.00),
                            ],
                            center: .center,
                            startRadius: 0,
                            endRadius: 260
                        )
                    )
                    .frame(width: 520, height: 520)
                    .offset(x: w - 200, y: h - 220)
                    .blur(radius: 60)
            }
            .frame(width: w, height: h)
            .clipped()
        }
    }

    // MARK: - Header

    private func header(width: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("What you stand\nto gain")
                .font(.custom(FontFamily.heading.rawValue, size: 30))
                .tracking(-0.6)
                .lineSpacing(4)
                .foregroundColor(AppColors.accent)
                .fixedSize(horizontal: false, vertical: true)

            Text("Project what compounded focus actually buys you.")
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .foregroundColor(AppColors.textSecondary)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(width: width, alignment: .leading)
        .opacity(headlineOpacity)
        .offset(y: headlineY)
    }

    // MARK: - Stat card

    private func statCard(width: CGFloat) -> some View {
        VStack(spacing: 6) {
            Text(Self.formatHours(projections.last?.hours ?? 0))
                .font(.custom(FontFamily.heading.rawValue, size: 44))
                .tracking(-1)
                .foregroundColor(AppColors.textPrimary)
            Text("hours of focus reclaimed over 5 years")
                .font(.custom(FontFamily.body.rawValue, size: 13))
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 22)
        .padding(.horizontal, 20)
        .frame(width: width)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.10),
                            Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.03),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.18), lineWidth: 1)
        )
        .opacity(statOpacity)
        .scaleEffect(statScale)
    }

    // MARK: - Benefits list

    private func benefitsList(width: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(Self.benefits.enumerated()), id: \.element) { index, benefit in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppColors.accent)
                        .symbolRenderingMode(.hierarchical)
                    Text(benefit)
                        .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                        .foregroundColor(AppColors.textPrimary.opacity(0.92))
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .frame(width: width, alignment: .leading)
                .opacity(benefitOpacities.indices.contains(index) ? benefitOpacities[index] : 0)
            }
        }
        .frame(width: width, alignment: .leading)
    }

    // MARK: - Projections

    private func projectionsView(width: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(projections.enumerated()), id: \.element.period) { index, p in
                projectionRow(
                    index: index,
                    period: p.period,
                    hours: p.hours,
                    isLast: index == projections.count - 1,
                    width: width
                )
            }
        }
        .frame(width: width, alignment: .leading)
    }

    private func projectionRow(
        index: Int,
        period: String,
        hours: Int,
        isLast: Bool,
        width: CGFloat
    ) -> some View {
        let maxH = projections.last?.hours ?? 1
        let pct = max(Double(hours) / Double(max(maxH, 1)), 0.12)
        let progress = projBarProgress.indices.contains(index) ? projBarProgress[index] : 0
        let fillFraction = max(0, min(1, pct * progress))
        // Bar width = row width − label widths (56+56) − spacings (10+10).
        let barWidth = max(0, width - 56 - 56 - 20)
        return HStack(spacing: 10) {
            Text(period)
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .foregroundColor(AppColors.textMuted)
                .lineLimit(1)
                .frame(width: 56, alignment: .leading)

            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(Color.white.opacity(0.04))
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(barFill(isLast: isLast))
                    .scaleEffect(x: fillFraction, y: 1, anchor: .leading)
            }
            .frame(width: barWidth, height: 18)

            Text(Self.formatHours(hours))
                .font(.custom(FontFamily.heading.rawValue, size: 15))
                .foregroundColor(isLast ? AppColors.accent : AppColors.textSecondary)
                .lineLimit(1)
                .frame(width: 56, alignment: .trailing)
        }
        .frame(width: width, alignment: .leading)
    }

    private func barFill(isLast: Bool) -> AnyShapeStyle {
        if isLast {
            return AnyShapeStyle(
                LinearGradient(
                    colors: [
                        Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.65),
                        Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.25),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
        }
        return AnyShapeStyle(Color.white.opacity(0.12))
    }

    // MARK: - Footer

    private func footer(width: CGFloat) -> some View {
        VStack(spacing: 0) {
            ctaButton(width: width - 48) // mirror horizontal padding

            Button {
                handleDismiss()
            } label: {
                Text("Maybe later")
                    .font(.custom(FontFamily.body.rawValue, size: 14))
                    .foregroundColor(AppColors.textMuted)
                    .padding(.vertical, 14)
                    .contentShape(Rectangle())
            }
            .buttonStyle(PressOpacityButtonStyle())
        }
        .frame(width: width)
        .padding(.bottom, 8)
        .background(
            LinearGradient(
                colors: [
                    AppColors.background.opacity(0),
                    AppColors.background.opacity(0.85),
                    AppColors.background,
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(width: width)
            .allowsHitTesting(false)
        )
        .opacity(buttonOpacity)
    }

    /// Glassmorphic cyan-tinted CTA. Tuned to actually fit the paywall's
    /// cyan/blue palette (the prior version's solid Discipline-Blue
    /// pill clashed with the stat card and projection-bar cyan accents).
    ///
    /// Layer stack (back → front):
    ///   1. Cyan-to-blue diagonal gradient — the visible "color".
    ///   2. `.ultraThinMaterial` over the gradient — true glassy refraction
    ///      that softens the gradient and reads as polished glass.
    ///   3. Top-leading → bottom-trailing white gradient stroke — premium bevel.
    ///   4. Inner 0.5pt highlight stroke — refracted-light rim.
    ///   5. Cyan glow + black drop shadow.
    ///   6. `.shineSweep` overlay — kept as requested for the moving glare.
    private func ctaButton(width: CGFloat) -> some View {
        Button {
            HapticsService.shared.medium()
            AnalyticsService.shared.track("Paywall CTA Tapped", properties: ["source": "lock_in"])
            showingPaywall = true
        } label: {
            HStack(spacing: 12) {
                Text("Lock In")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 17))
                    .tracking(0.6)
                    .foregroundColor(.white)
                Image(systemName: "arrow.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.95))
            }
            .frame(width: width, height: 58)
            .background(
                // L1 — cyan-to-blue color floor.
                LinearGradient(
                    colors: [
                        Color(.sRGB, red: 0,  green: 194/255, blue: 255/255, opacity: 0.55),
                        Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.40),
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .background(
                // L2 — actual glass material. Sits over the color so the
                // tint reads through softened.
                Rectangle().fill(.ultraThinMaterial)
            )
            .overlay(
                // L3 — bevel rim.
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.55),
                                Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.25),
                                Color.white.opacity(0.10),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .overlay(
                // L4 — inner refracted highlight (very subtle).
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .inset(by: 1)
                    .stroke(Color.white.opacity(0.18), lineWidth: 0.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(
                color: Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.45),
                radius: 22, x: 0, y: 10
            )
            .shadow(color: AppColors.primary.opacity(0.30), radius: 14, x: 0, y: 6)
            .shadow(color: .black.opacity(0.30), radius: 6, x: 0, y: 2)
        }
        .buttonStyle(PressOpacityButtonStyle())
        .shineSweep(cornerRadius: 18, cycle: 3.4, translation: 1.4, peakAlpha: 0.30)
    }

    // MARK: - Actions

    private func handleDismiss() {
        AnalyticsService.shared.track("Paywall Dismissed", properties: ["source": "lock_in"])
        fadeOutAndDismiss(duration: 0.3)
    }

    private func fadeOutAndDismiss(duration: Double = 0.4) {
        withAnimation(.easeInOut(duration: duration)) {
            screenOpacity = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            dismiss()
        }
    }

    // MARK: - Entry animations

    private func runEntryAnimations() {
        AnalyticsService.shared.track("Paywall Shown", properties: ["source": "lock_in"])
        AnalyticsService.shared.trackAppsFlyer("af_content_view", values: [
            "af_content_type": "paywall",
            "af_content_id": "paywall_lock_in",
            "source": "home",
        ])
        AnalyticsService.shared.timeEvent("Paywall Dismissed")

        withAnimation(.easeOut(duration: 0.6)) {
            headlineOpacity = 1
            headlineY = 0
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            withAnimation(.easeOut(duration: 0.45)) {
                statOpacity = 1
            }
            withAnimation(.interpolatingSpring(stiffness: 90, damping: 11)) {
                statScale = 1
            }
            HapticsService.shared.light()
        }

        for i in 0..<Self.benefits.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.85 + Double(i) * 0.09) {
                withAnimation(.easeOut(duration: 0.32)) {
                    if benefitOpacities.indices.contains(i) { benefitOpacities[i] = 1 }
                }
            }
        }

        let projStart = 0.85 + Double(Self.benefits.count) * 0.09 + 0.18
        DispatchQueue.main.asyncAfter(deadline: .now() + projStart) {
            withAnimation(.easeOut(duration: 0.45)) {
                projOpacity = 1
            }
            for i in 0..<projections.count {
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.12) {
                    withAnimation(.interpolatingSpring(stiffness: 110, damping: 11)) {
                        if projBarProgress.indices.contains(i) { projBarProgress[i] = 1 }
                    }
                }
            }
        }

        let btnStart = projStart + Double(projections.count) * 0.12 + 0.25
        DispatchQueue.main.asyncAfter(deadline: .now() + btnStart) {
            withAnimation(.easeOut(duration: 0.45)) {
                buttonOpacity = 1
            }
        }
    }

    // MARK: - Helpers

    private static func reclaimedHours(dailyMinutes: Int?, days: Int) -> Int {
        let mins = dailyMinutes ?? 60
        return Int((Double(mins) * Double(days) / 60.0).rounded())
    }

    private static func formatHours(_ h: Int) -> String {
        if h >= 1000 {
            return "\(Int((Double(h) / 100.0).rounded()) * 100)h"
        }
        return "\(h)h"
    }

    // MARK: - Static data

    private static let benefits: [String] = [
        "Sharper focus under pressure",
        "Fewer hours lost to distraction",
        "Stronger daily discipline habits",
        "Compounding clarity over 90 days",
    ]

    private struct Projection: Hashable {
        let period: String
        let hours: Int
    }
}
