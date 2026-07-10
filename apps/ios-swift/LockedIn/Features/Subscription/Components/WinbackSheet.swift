//
//  WinbackSheet.swift
//  LockedIn
//
//  One-time downsell shown when the user backs out of the primary paywall's
//  purchase (a `.cancelled` outcome). Presents the discounted "winback"
//  RevenueCat offering with a strong discount hero, benefit reasons, and heavy
//  "shown only once" emphasis. A successful claim flips `isSubscribed`, which
//  the parent paywall observes to route the user into the app.
//

import SwiftUI
import DesignKit

struct WinbackSheet: View {
    let plans: [PlanViewModel]
    /// Discount vs the standard offering (winback cheapest per-week vs standard
    /// cheapest per-week) — a real comparison of two products we actually sell.
    let discountPercent: Int?
    /// Purchase a winback plan; returns true once the user is entitled.
    let onClaim: (PlanViewModel) async -> Bool
    /// Claim succeeded — the parent dismisses the sheet and routes into the app.
    let onClaimed: () -> Void
    /// User dismissed the offer without claiming — the parent dismisses.
    let onDecline: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedID: String?
    @State private var isBuying = false
    @State private var medallionScale: CGFloat = 0.72

    private var selectedPlan: PlanViewModel? { plans.first { $0.id == selectedID } }

    private static let reasons: [(String, String)] = [
        ("infinity", "Everything unlocked — unlimited focus sessions, missions, ranks & streaks."),
        ("lock.fill", "Lock in your lowest price for as long as you stay subscribed."),
        ("checkmark.shield.fill", "Cancel anytime and keep every bit of your progress."),
    ]

    var body: some View {
        SettingsSheetShell(title: "One-Time Offer") {
            VStack(spacing: 18) {
                medallion
                headline
                oneTimeBanner
                reasonsList
                planSection
                claimButton
                footer
            }
            .padding(.top, 2)
            .padding(.bottom, 8)
        }
        .onAppear {
            if selectedID == nil {
                selectedID = plans.first(where: { $0.isBestValue })?.id ?? plans.first?.id
            }
            if reduceMotion {
                medallionScale = 1
            } else {
                withAnimation(.interpolatingSpring(stiffness: 140, damping: 11).delay(0.08)) {
                    medallionScale = 1
                }
            }
        }
    }

    // MARK: - Hero

    private var medallion: some View {
        ZStack {
            GlowOrb(preset: .cyan, size: 210, blurRadius: 55)
            Circle().fill(SystemTokens.cyan.opacity(0.10))
                .frame(width: 118, height: 118)
            Circle().stroke(SystemTokens.cyan.opacity(0.45), lineWidth: 2)
                .frame(width: 118, height: 118)

            if let pct = discountPercent {
                VStack(spacing: -4) {
                    Text("SAVE")
                        .font(.custom(FontFamily.display.rawValue, size: 10)).tracking(3)
                        .foregroundColor(SystemTokens.cyan)
                    Text("\(pct)%")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 42))
                        .foregroundColor(SystemTokens.textPrimary)
                    Text("OFF")
                        .font(.custom(FontFamily.display.rawValue, size: 10)).tracking(3)
                        .foregroundColor(SystemTokens.cyan)
                }
            } else {
                Image(systemName: "gift.fill")
                    .font(.system(size: 42))
                    .foregroundColor(SystemTokens.cyan)
            }
        }
        .scaleEffect(medallionScale)
        .frame(height: 150)
    }

    private var headline: some View {
        VStack(spacing: 6) {
            Text("Wait — this is your\nbest price. Ever.")
                .font(.custom(FontFamily.headingBold.rawValue, size: 24))
                .tracking(-0.3)
                .foregroundColor(SystemTokens.textPrimary)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
            Text("Turn it down and it's gone for good.")
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .foregroundColor(SystemTokens.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    /// High-visibility urgency strip — gold so it reads as a warning, not chrome.
    private var oneTimeBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(SystemTokens.gold)
            Text("ONE-TIME OFFER · SHOWN ONCE")
                .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                .tracking(1.2)
                .foregroundColor(SystemTokens.gold)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(SystemTokens.gold.opacity(0.10))
        .overlay(Rectangle().stroke(SystemTokens.gold.opacity(0.42), lineWidth: 1))
    }

    private var reasonsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Self.reasons, id: \.1) { icon, text in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(SystemTokens.cyan)
                        .frame(width: 22, alignment: .center)
                    Text(text)
                        .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                        .foregroundColor(SystemTokens.textPrimary)
                        .lineSpacing(2)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private var planSection: some View {
        VStack(spacing: 8) {
            ForEach(plans) { plan in
                PlanOptionRow(
                    plan: plan,
                    isSelected: plan.id == selectedID,
                    action: {
                        HapticsService.shared.selectionChanged()
                        selectedID = plan.id
                    }
                )
            }
        }
    }

    private var claimButton: some View {
        Button(action: claim) {
            ZStack {
                LinearGradient(
                    colors: [SystemTokens.cyan, AppColors.primary],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                if isBuying {
                    ProgressView().tint(.white)
                } else {
                    HStack(spacing: 8) {
                        Text("CLAIM DISCOUNT")
                            .font(.custom(FontFamily.display.rawValue, size: 13))
                            .tracking(1.4)
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            // HUD: sharp corners, hairline rim, pulsing-free corner brackets.
            .overlay(Rectangle().stroke(Color.white.opacity(0.22), lineWidth: 1))
            .overlay(
                HUDCornerBrackets(length: 12, thickness: 1.5, color: Color.white.opacity(0.85), pulses: false)
                    .padding(3)
            )
            .shadow(color: SystemTokens.cyan.opacity(0.45), radius: 18, x: 0, y: 8)
        }
        .buttonStyle(PressOpacityButtonStyle())
        .disabled(isBuying || selectedPlan == nil)
        .shineSweep(cornerRadius: 0, cycle: 3.2, translation: 1.4, peakAlpha: 0.24)
    }

    private var footer: some View {
        VStack(spacing: 10) {
            if let terms = selectedPlan?.billedTerms {
                Text(terms)
                    .font(.custom(FontFamily.body.rawValue, size: 11))
                    .foregroundColor(SystemTokens.textMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
            }

            Button {
                onDecline()
            } label: {
                Text("No thanks — I'll pay full price")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                    .foregroundColor(SystemTokens.textSecondary)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(isBuying)

            Text("This offer will not be shown again.")
                .font(.custom(FontFamily.body.rawValue, size: 11))
                .foregroundColor(SystemTokens.textMuted)
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    private func claim() {
        guard let plan = selectedPlan, !isBuying else { return }
        HapticsService.shared.medium()
        isBuying = true
        Task {
            let ok = await onClaim(plan)
            isBuying = false
            if ok { onClaimed() }  // parent dismisses + routes into the app
        }
    }
}
