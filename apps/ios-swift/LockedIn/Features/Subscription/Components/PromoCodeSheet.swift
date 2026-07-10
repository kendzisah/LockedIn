//
//  PromoCodeSheet.swift
//  LockedIn
//
//  HUD-themed promo-code dialog. On iOS, subscription "promo codes" are App
//  Store **offer codes**, which can only be redeemed through Apple's own
//  redemption sheet — there is no public API to validate a typed code in-app.
//  So this dialog is the themed entry point that hands off to Apple's sheet via
//  `SubscriptionState.presentOfferCodeRedemption()`. A redeemed entitlement
//  flows back through the customer-info listener and dismisses the paywall.
//

import SwiftUI
import DesignKit

struct PromoCodeSheet: View {
    /// Launches Apple's native offer-code redemption sheet.
    let onRedeem: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        SettingsSheetShell(title: "Promo Code") {
            VStack(alignment: .leading, spacing: 18) {
                Text("Have an offer code? Redeem it securely on the App Store — your subscription unlocks automatically once it's applied.")
                    .font(.custom(FontFamily.body.rawValue, size: 14))
                    .foregroundColor(SystemTokens.textSecondary)
                    .lineSpacing(5)
                    .frame(maxWidth: .infinity, alignment: .leading)

                PrimaryButton("Redeem Code") {
                    dismiss()
                    onRedeem()
                }
                .frame(maxWidth: .infinity)

                Text("Codes are entered and validated by Apple.")
                    .font(.custom(FontFamily.body.rawValue, size: 11))
                    .foregroundColor(SystemTokens.textMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .padding(.top, 4)
        }
    }
}
