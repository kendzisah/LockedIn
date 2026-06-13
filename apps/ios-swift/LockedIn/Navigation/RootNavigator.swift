//
//  RootNavigator.swift
//  LockedIn
//
//  Conditional root mirroring `RootNavigator.tsx` from the RN app.
//
//  - While onboarding is incomplete OR not yet hydrated, present the
//    onboarding navigator.
//  - Once `OnboardingState.onboardingComplete == true` && `isHydrated == true`,
//    present `MainNavigator`.
//
//  Every feature's @Observable state object is injected as `.environment(...)`
//  from `RootView` so this navigator can stay simple.
//

import SwiftUI
import DesignKit

public struct RootNavigator: View {
    @Environment(OnboardingState.self) private var onboarding
    @Environment(AuthState.self) private var auth

    public init() {}

    public var body: some View {
        Group {
            if !onboarding.isHydrated || auth.isLoading {
                bootScreen
            } else if onboarding.onboardingComplete {
                MainNavigator()
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
