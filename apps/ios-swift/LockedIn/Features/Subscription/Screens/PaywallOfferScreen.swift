//
//  PaywallOfferScreen.swift
//  LockedIn
//
//  Mid-app modal paywall — presented as a fullScreenCover when a non-subscribed
//  user taps Lock In. Hard gate before a paid session can begin.
//
//  Visual: deep-dark background with twin atmospheric glow orbs (cyan above,
//  blue below), cyan headline, reclaimed-hours stat card, benefit checklist,
//  projection bars (90d / 1y / 3y / 5y), solid Discipline-Blue Lock In CTA
//  with shine, and a Maybe-later dismiss.
//
//  Port of `apps/mobile/src/features/subscription/PaywallOfferScreen.tsx`.
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
            // Solid base — guarantees the screen reads dark before the image
            // resolves and after the gradient fades to opaque at 65% down.
            AppColors.background
                .ignoresSafeArea()

            // Staircase photo — visual metaphor for compounded effort. Sized
            // `.fill` so it covers any aspect, ignores safe area so the photo
            // bleeds under the status bar. Direct port of the RN treatment
            // (`PaywallOfferScreen.tsx:155`).
            Image("staircase-bg")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
                .ignoresSafeArea()
                .accessibilityHidden(true)

            // Layered dark gradient: 30% opaque at top, deepening to fully
            // opaque background by 65%. Mirrors RN locations [0, 0.25, 0.45,
            // 0.65]. Below 0.65 the photo is completely hidden behind the
            // background color so the content area reads as flat dark.
            LinearGradient(
                stops: [
                    .init(color: AppColors.background.opacity(0.30), location: 0.00),
                    .init(color: AppColors.background.opacity(0.70), location: 0.25),
                    .init(color: AppColors.background.opacity(0.95), location: 0.45),
                    .init(color: AppColors.background,               location: 0.65),
                    .init(color: AppColors.background,               location: 1.00),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            content
                .opacity(screenOpacity)
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

    // MARK: - Content

    /// Body uses a `ScrollView` so the 4 projection rows, stat card, and
    /// benefits list always fit on small devices (SE) without clipping.
    /// Footer is anchored beneath via a sibling `VStack` so it stays at the
    /// thumb-zone regardless of content height.
    private var content: some View {
        VStack(spacing: 0) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    header
                        .padding(.top, 8)

                    statCard
                        .padding(.top, 22)

                    benefitsView
                        .padding(.top, 22)

                    projectionsView
                        .padding(.top, 22)
                        .opacity(projOpacity)

                    Spacer(minLength: 16)
                }
                .padding(.horizontal, 24)
                .padding(.top, 24)
                .padding(.bottom, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollBounceBehavior(.basedOnSize)

            footer
        }
    }

    private var header: some View {
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
        .frame(maxWidth: .infinity, alignment: .leading)
        .opacity(headlineOpacity)
        .offset(y: headlineY)
    }

    private var statCard: some View {
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
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [
                    Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.10),
                    Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.03),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.18), lineWidth: 1)
        )
        .opacity(statOpacity)
        .scaleEffect(statScale)
    }

    private var benefitsView: some View {
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
                .frame(maxWidth: .infinity, alignment: .leading)
                .opacity(benefitOpacities.indices.contains(index) ? benefitOpacities[index] : 0)
            }
        }
    }

    private var projectionsView: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(projections.enumerated()), id: \.element.period) { index, p in
                projectionRow(
                    index: index,
                    period: p.period,
                    hours: p.hours,
                    isLast: index == projections.count - 1
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func projectionRow(index: Int, period: String, hours: Int, isLast: Bool) -> some View {
        let maxH = projections.last?.hours ?? 1
        let pct = max(Double(hours) / Double(max(maxH, 1)), 0.12)
        let progress = projBarProgress.indices.contains(index) ? projBarProgress[index] : 0
        return HStack(spacing: 10) {
            Text(period)
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .foregroundColor(AppColors.textMuted)
                .frame(width: 56, alignment: .leading)

            // Bar — track + fill, sized via GeometryReader. Wrapped in an
            // explicit maxWidth: .infinity + fixed-height frame so the
            // GeometryReader's natural greedy sizing is bounded to the
            // available row width (otherwise it propagates "want infinity"
            // up through the HStack and pushes the whole screen past the
            // device edge).
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(Color.white.opacity(0.04))

                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(barFill(isLast: isLast))
                        .frame(width: max(0, geo.size.width * pct * progress))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: 18)

            Text(Self.formatHours(hours))
                .font(.custom(FontFamily.heading.rawValue, size: 15))
                .foregroundColor(isLast ? AppColors.accent : AppColors.textSecondary)
                .frame(width: 56, alignment: .trailing)
        }
        .frame(maxWidth: .infinity)
    }

    private func barFill(isLast: Bool) -> AnyShapeStyle {
        if isLast {
            return AnyShapeStyle(
                LinearGradient(
                    colors: [
                        Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.45),
                        Color(.sRGB, red: 0, green: 194/255, blue: 255/255, opacity: 0.18),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
        }
        return AnyShapeStyle(Color.white.opacity(0.10))
    }

    private var footer: some View {
        VStack(spacing: 0) {
            ctaButton

            Button {
                handleDismiss()
            } label: {
                Text("Maybe later")
                    .font(.custom(FontFamily.body.rawValue, size: 14))
                    .foregroundColor(AppColors.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            }
            .buttonStyle(PressOpacityButtonStyle())
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 16)
        .background(AppColors.background)
        .opacity(buttonOpacity)
    }

    /// Solid Discipline-Blue CTA — owns the action color so the eye lands
    /// there. Cyan accents elsewhere (stat card, projection bars) stay
    /// supporting. Shine overlays via `.shineSweep` so layout never bloats.
    private var ctaButton: some View {
        Button {
            HapticsService.shared.medium()
            AnalyticsService.shared.track("Paywall CTA Tapped", properties: ["source": "lock_in"])
            showingPaywall = true
        } label: {
            HStack(spacing: 10) {
                Text("Lock In")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 17))
                    .tracking(0.2)
                    .foregroundColor(AppColors.textPrimary)
                Image(systemName: "arrow.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AppColors.textPrimary.opacity(0.9))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(
                LinearGradient(
                    colors: [AppColors.primary, AppColors.primary.opacity(0.88)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.10), lineWidth: 1)
            )
            .shadow(color: AppColors.primary.opacity(0.45), radius: 22, x: 0, y: 10)
            .shadow(color: .black.opacity(0.25), radius: 6, x: 0, y: 2)
        }
        .buttonStyle(PressOpacityButtonStyle())
        .shineSweep(cornerRadius: 16, cycle: 4.0, translation: 1.6, peakAlpha: 0.16)
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
