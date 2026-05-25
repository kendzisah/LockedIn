//
//  PaywallPresenter.swift
//  LockedIn
//
//  View modifier that presents the RevenueCat paywall via `RevenueCatUI`.
//  Mirrors the RN `RevenueCatUI.presentPaywall()` call from
//  `SubscriptionProvider.tsx:138`.
//
//  Usage:
//      .paywall(isPresented: $showing,
//               state: subscriptionState,
//               source: "lock_in")
//

import SwiftUI
import RevenueCat
import RevenueCatUI

public struct PaywallPresenter: ViewModifier {
    @Binding var isPresented: Bool
    let state: SubscriptionState
    /// Analytics source label (`"lock_in"` or `"onboarding"`).
    let source: String
    /// Optional callback fired after paywall dismissal with the resulting
    /// entitlement state.
    let onDismiss: ((Bool) -> Void)?

    public func body(content: Content) -> some View {
        content
            .sheet(isPresented: $isPresented) {
                Task {
                    let subscribed = await state.refreshAfterPaywall()
                    onDismiss?(subscribed)
                }
            } content: {
                PaywallView(displayCloseButton: true)
                    .preferredColorScheme(.dark)
            }
    }
}

public extension View {
    /// Present the RevenueCat-managed paywall sheet. After dismissal, the
    /// `SubscriptionState` is refreshed and the optional `onDismiss` callback
    /// is invoked with the resulting entitlement state.
    func paywall(
        isPresented: Binding<Bool>,
        state: SubscriptionState,
        source: String,
        onDismiss: ((Bool) -> Void)? = nil
    ) -> some View {
        modifier(PaywallPresenter(
            isPresented: isPresented,
            state: state,
            source: source,
            onDismiss: onDismiss
        ))
    }
}
