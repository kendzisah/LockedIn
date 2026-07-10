//
//  RootNavigator.swift
//  LockedIn
//
//  Conditional root mirroring `RootNavigator.tsx` from the RN app.
//
//  - While onboarding is incomplete OR not yet hydrated, present the
//    onboarding navigator.
//  - Once `OnboardingState.onboardingComplete == true` && `isHydrated == true`,
//    the app is a HARD subscription gate: an active `Inner_Circle` entitlement
//    reaches `MainNavigator`; anyone else (lapsed or legacy free) gets the
//    non-dismissable paywall on every launch.
//
//  Every feature's @Observable state object is injected as `.environment(...)`
//  from `RootView` so this navigator can stay simple.
//

import SwiftUI
import DesignKit

public struct RootNavigator: View {
    @Environment(OnboardingState.self) private var onboarding
    @Environment(AuthState.self) private var auth
    @Environment(SubscriptionState.self) private var subscription
    @Environment(ActiveSessionStore.self) private var activeSession

    public init() {}

    /// Safety net so the root never hangs on the boot spinner if RevenueCat
    /// never resolves `isLoading` (SDK stall / offline fresh install).
    @State private var subLoadTimedOut = false

    public var body: some View {
        Group {
            if !onboarding.isHydrated || auth.isLoading {
                bootScreen
            } else if onboarding.onboardingComplete {
                // Hard gate the whole app on subscription. Wait for RevenueCat
                // to resolve first (`isLoading`) so a valid subscriber never
                // flashes the paywall; offline subscribers still pass via
                // RevenueCat's cached entitlement.
                if subscription.isLoading && !subLoadTimedOut {
                    bootScreen.task {
                        // Bounded: if RevenueCat never resolves, fall through to
                        // the gate. A real subscriber re-renders into the app
                        // once `isSubscribed` resolves; otherwise the paywall
                        // shows (it has its own retry/restore).
                        try? await Task.sleep(nanoseconds: 10_000_000_000)
                        subLoadTimedOut = true
                    }
                } else if subscription.isSubscribed || activeSession.isActive {
                    // `activeSession.isActive`: never yank a user out of an
                    // in-progress Lock-In if their subscription lapses mid-app —
                    // let the session finish; the gate re-applies on the next
                    // render once it ends.
                    MainNavigator()
                } else {
                    // isSubscribed flips → this re-renders into MainNavigator,
                    // so onSubscribed can be a no-op.
                    HUDPaywallScreen(context: .relaunch, isDismissable: false, onSubscribed: {})
                }
            } else {
                OnboardingNavigator()
            }
        }
        .preferredColorScheme(.dark)
    }

    private var bootScreen: some View {
        ZStack {
            ScreenGradient()
            ProgressView()
                .tint(AppColors.textPrimary)
        }
    }
}
