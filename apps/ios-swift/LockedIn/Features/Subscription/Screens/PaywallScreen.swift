//
//  PaywallScreen.swift
//  LockedIn
//
//  Onboarding paywall — direct port of
//  `apps/mobile/src/features/onboarding/screens/PaywallScreen.tsx`.
//
//  Route: `Paywall` in the onboarding stack. Shown as the final onboarding
//  screen after `SocialProof`. On subscribe / restore / skip, dispatches
//  `COMPLETE_ONBOARDING` to the OnboardingProvider, which flips
//  RootNavigator from Onboarding → Main.
//
//  Visual: HUD glow background, centered headline + subhead, mini "OVR 1 •
//  NPC" rank card with optional scheduled-session line, 7 feature rows with
//  cyan SF Symbol icons, primary CTA with shine sweep, restore + maybe-later
//  + fine print.
//

import SwiftUI
import DesignKit

/// Onboarding-flow paywall (hard gate at the end of onboarding).
public struct PaywallScreen: View {
    @Environment(SubscriptionState.self) private var subscription
    @State private var screenOpacity: Double = 0
    @State private var advancingRef = false
    @State private var showingPaywall = false

    /// Day-zero rank (matches `RankService.rankFromStreak(0)` — NPC).
    private let startingRank: RankTier = RankTiers.byId[.npc]!

    // Wired from `OnboardingNavigator` (reads `OnboardingState.scheduledSessionTime`).
    let scheduledSessionTime: String?
    let onComplete: (_ subscribed: Bool) -> Void

    public init(
        scheduledSessionTime: String? = nil,
        onComplete: @escaping (_ subscribed: Bool) -> Void
    ) {
        self.scheduledSessionTime = scheduledSessionTime
        self.onComplete = onComplete
    }

    public var body: some View {
        ZStack {
            ScreenGradient()

            // Twin atmospheric glows: warm blue near the headline, cool cyan
            // dipping behind the CTA. Both soft, both far off-axis, both
            // intentionally below the content so they read as light, not as
            // shapes.
            GlowOrb(preset: .blue, size: 360, blurRadius: 90)
                .opacity(0.85)
                .offset(x: -40, y: -260)
            GlowOrb(preset: .cyan, size: 280, blurRadius: 80)
                .opacity(0.55)
                .offset(x: 70, y: 220)

            content
                .opacity(screenOpacity)
        }
        .preferredColorScheme(.dark)
        .paywall(
            isPresented: $showingPaywall,
            state: subscription,
            source: "onboarding"
        ) { subscribed in
            if subscribed {
                // PostHog only — AppsFlyer subscription events come from
                // RevenueCat S2S (rc_trial_started_event etc.); firing
                // af_subscribe here would double-count on Meta postbacks.
                AnalyticsService.shared.track("Subscription Started", properties: ["source": "onboarding"])
                completeAndExit(subscribed: true)
            } else {
                AnalyticsService.shared.track("Paywall Dismissed", properties: ["source": "onboarding"])
            }
        }
        .onAppear {
            AnalyticsService.shared.track("Paywall Shown", properties: ["source": "onboarding"])
            withAnimation(.easeInOut(duration: 0.5)) {
                screenOpacity = 1
            }
        }
    }

    // MARK: - Content

    private var content: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                header
                    .padding(.top, 8)

                miniCard
                    .padding(.top, 28)

                featureList
                    .padding(.top, 28)

                Spacer(minLength: 32)

                footer
            }
            .padding(.horizontal, 24)
            .padding(.top, 24)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    private var header: some View {
        VStack(spacing: 10) {
            // Hero headline. Tight tracking + heading weight = premium feel.
            Text("Unlock the Full System")
                .font(.custom(FontFamily.headingBold.rawValue, size: 30))
                .tracking(-0.5)
                .lineSpacing(4)
                .foregroundColor(AppColors.textPrimary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Text("Your character is created. Your stats are set.\nStart the game.")
                .font(.custom(FontFamily.body.rawValue, size: 15))
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// "OVR 1 • NPC" rank card. Restyled with the canonical HUD glass treatment:
    /// translucent panel bg, subtle blue border (the rank tint at low alpha so
    /// the chrome agrees with the content), 12-pt vertical padding.
    private var miniCard: some View {
        VStack(spacing: 4) {
            HStack(spacing: 8) {
                Circle()
                    .fill(startingRank.color)
                    .frame(width: 6, height: 6)
                Text("OVR 1 • \(startingRank.name)")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                    .tracking(1.4)
                    .foregroundColor(startingRank.color)
            }

            Text("Ready to evolve")
                .font(.custom(FontFamily.body.rawValue, size: 13))
                .foregroundColor(AppColors.textMuted)

            if let scheduled = scheduledSessionTime {
                Text("First session · \(formatScheduledTime(scheduled)) tomorrow")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 12))
                    .tracking(0.2)
                    .foregroundColor(AppColors.accent)
                    .padding(.top, 4)
            }
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.sRGB, red: 21/255, green: 26/255, blue: 33/255, opacity: 0.55))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(startingRank.color.opacity(0.18), lineWidth: 1)
        )
    }

    /// Feature list — pill-row layout with a tinted icon chip, primary body
    /// text, and consistent rhythm. The chip gives the icon a contained
    /// visual weight; without it the icon floats off the row.
    private var featureList: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Self.features, id: \.label) { feat in
                HStack(spacing: 14) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(AppColors.accent.opacity(0.12))
                        Image(systemName: feat.systemImage)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(AppColors.accent)
                    }
                    .frame(width: 28, height: 28)

                    Text(feat.label)
                        .font(.custom(FontFamily.bodyMedium.rawValue, size: 15))
                        .foregroundColor(AppColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)

                    Spacer(minLength: 0)
                }
            }
        }
    }

    private var footer: some View {
        VStack(spacing: 0) {
            ctaButton

            HStack(spacing: 24) {
                tertiaryButton("Restore") {
                    HapticsService.shared.selectionChanged()
                    AnalyticsService.shared.track("Paywall Restore Tapped", properties: ["source": "onboarding"])
                    Task {
                        let restored = await subscription.restorePurchases()
                        if restored { completeAndExit(subscribed: true) }
                    }
                }

                Circle()
                    .fill(AppColors.textMuted.opacity(0.35))
                    .frame(width: 3, height: 3)

                tertiaryButton("Maybe later") {
                    HapticsService.shared.selectionChanged()
                    AnalyticsService.shared.track("Paywall Skipped", properties: ["source": "onboarding"])
                    completeAndExit(subscribed: false)
                }
            }
            .padding(.top, 16)

            Text("Cancel anytime. Payment charged after a 3-day free trial.")
                .font(.custom(FontFamily.body.rawValue, size: 11))
                .foregroundColor(AppColors.textMuted)
                .multilineTextAlignment(.center)
                .padding(.top, 14)
        }
    }

    /// Premium primary CTA. Solid Discipline Blue with a deep, low-alpha
    /// shadow for "elevated surface" feel; capsule shape (height-derived
    /// corner radius) so it reads as a single touch target at any size;
    /// shine overlaid via `.shineSweep()` so it never expands the layout.
    private var ctaButton: some View {
        Button {
            HapticsService.shared.medium()
            AnalyticsService.shared.track("Paywall CTA Tapped", properties: ["source": "onboarding"])
            showingPaywall = true
        } label: {
            Text("Start My Evolution")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 17))
                .tracking(0.1)
                .foregroundColor(AppColors.textPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(
                    LinearGradient(
                        colors: [
                            AppColors.primary,
                            AppColors.primary.opacity(0.88),
                        ],
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

    private func tertiaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                .foregroundColor(AppColors.textSecondary)
        }
        .buttonStyle(PressOpacityButtonStyle())
    }

    // MARK: - Helpers

    private func completeAndExit(subscribed: Bool) {
        guard !advancingRef else { return }
        advancingRef = true
        AnalyticsService.shared.track("Onboarding Completed", properties: [
            "screen": "Paywall",
            "subscribed": subscribed,
        ])
        withAnimation(.easeInOut(duration: 0.5)) {
            screenOpacity = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            onComplete(subscribed)
        }
    }

    /// Convert "HH:MM" 24h to "h:MM AM/PM". Falls back to the raw input.
    private func formatScheduledTime(_ value: String) -> String {
        let parts = value.split(separator: ":")
        guard parts.count == 2,
              let h24 = Int(parts[0]),
              parts[1].count == 2
        else { return value }
        let minutes = String(parts[1])
        let ampm = h24 < 12 ? "AM" : "PM"
        let h12 = h24 == 0 ? 12 : (h24 > 12 ? h24 - 12 : h24)
        return "\(h12):\(minutes) \(ampm)"
    }

    // MARK: - Static data

    /// Feature list — port of the RN `FEATURES` const. SF Symbol mappings
    /// approximate the Ionicons used in RN:
    ///   lock-closed-outline    → lock
    ///   flash-outline          → bolt
    ///   stats-chart-outline    → chart.bar
    ///   trophy-outline         → trophy
    ///   people-outline         → person.2
    ///   document-text-outline  → doc.text
    ///   shield-outline         → shield
    private static let features: [Feature] = [
        Feature(systemImage: "lock",       label: "Unlimited focus sessions"),
        Feature(systemImage: "bolt",       label: "Daily personalized missions"),
        Feature(systemImage: "chart.bar",  label: "Full OVR & stat tracking"),
        Feature(systemImage: "trophy",     label: "Rank progression system"),
        Feature(systemImage: "person.2",   label: "Guild leaderboards"),
        Feature(systemImage: "doc.text",   label: "Weekly system reports"),
        Feature(systemImage: "shield",     label: "Streak recovery (1x/week)"),
    ]

    private struct Feature {
        let systemImage: String
        let label: String
    }
}
