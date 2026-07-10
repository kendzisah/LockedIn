//
//  PlanOptionRow.swift
//  LockedIn
//
//  One selectable plan row inside the custom `HUDPaywallScreen`. Built on the
//  shared `HUDOptionCard` (2px accent rail + glow) so selection matches the rest
//  of the HUD. Shows a radio, plan title, computed savings / intro badges, and a
//  currency-safe per-week price.
//

import SwiftUI
import DesignKit

struct PlanOptionRow: View {
    let plan: PlanViewModel
    let isSelected: Bool
    let action: () -> Void

    private let accent = SystemTokens.glowAccent

    var body: some View {
        HUDOptionCard(isSelected: isSelected, accentColor: accent, action: action) {
            HStack(spacing: 12) {
                radio

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(plan.title)
                            .font(.custom(FontFamily.headingBold.rawValue, size: 16))
                            .foregroundColor(SystemTokens.textPrimary)

                        if plan.isBestValue {
                            badge("BEST VALUE", color: SystemTokens.cyan)
                        }
                        if let pct = plan.savingsPercent {
                            badge("SAVE \(pct)%", color: SystemTokens.green)
                        }
                    }

                    if let intro = plan.intro {
                        Text(intro.badge)
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                            .tracking(0.6)
                            .foregroundColor(SystemTokens.cyan)
                    } else {
                        Text(plan.billedTerms)
                            .font(.custom(FontFamily.body.rawValue, size: 11))
                            .foregroundColor(SystemTokens.textMuted)
                    }
                }

                Spacer(minLength: 8)

                if plan.hasPerWeek {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(plan.perWeekText)
                            .font(.custom(FontFamily.headingBold.rawValue, size: 18))
                            .foregroundColor(SystemTokens.textPrimary)
                        Text("per week")
                            .font(.custom(FontFamily.body.rawValue, size: 10))
                            .foregroundColor(SystemTokens.textMuted)
                    }
                } else {
                    // Non-recurring (e.g. lifetime): show the flat price.
                    Text(plan.perWeekText)
                        .font(.custom(FontFamily.headingBold.rawValue, size: 18))
                        .foregroundColor(SystemTokens.textPrimary)
                }
            }
        }
    }

    private var radio: some View {
        ZStack {
            Circle()
                .stroke(isSelected ? accent : SystemTokens.textMuted, lineWidth: 1.5)
                .frame(width: 20, height: 20)
            if isSelected {
                Circle()
                    .fill(accent)
                    .frame(width: 11, height: 11)
                    .shadow(color: accent.opacity(0.7), radius: 4)
            }
        }
        .animation(.easeOut(duration: 0.15), value: isSelected)
    }

    private func badge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.custom(FontFamily.headingBold.rawValue, size: 9))
            .tracking(0.8)
            .foregroundColor(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.14))
            .overlay(Rectangle().stroke(color.opacity(0.4), lineWidth: 1))
    }
}
