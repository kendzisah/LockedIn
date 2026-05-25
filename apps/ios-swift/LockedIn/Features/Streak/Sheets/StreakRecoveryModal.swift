//
//  StreakRecoveryModal.swift
//  LockedIn — Worker W7 (Streak feature)
//
//  Port of `apps/mobile/src/features/streak/components/StreakRecoveryModal.tsx`.
//
//  Full-screen overlay asking the user to commit to a 15-minute focus session
//  to preserve a streak that's at risk of breaking. Visual contract matches
//  the RN source byte-for-byte: 85%-wide modal card, dark `surface` bg,
//  16-radius corners, 24h × 32v padding, primary CTA + ghost cancel.
//
//  Wiring: HomeState (W3) decides when this is visible and what callbacks
//  to pass. This view is presentation-only.
//

import SwiftUI
import DesignKit

/// Centered glass-style modal presented when the user's streak is at risk.
///
/// Usage:
/// ```swift
/// .fullScreenCover(isPresented: $showRecovery) {
///     StreakRecoveryModal(
///         streak: state.consecutiveStreak,
///         recoveriesRemaining: status.remaining,
///         onSavePress: { /* W11 routes to 15-min DurationPickerSheet */ },
///         onDismiss: { showRecovery = false }
///     )
/// }
/// ```
public struct StreakRecoveryModal: View {
    public let streak: Int
    public let recoveriesRemaining: Int
    public let onSavePress: () -> Void
    public let onDismiss: () -> Void

    public init(
        streak: Int,
        recoveriesRemaining: Int,
        onSavePress: @escaping () -> Void,
        onDismiss: @escaping () -> Void
    ) {
        self.streak = streak
        self.recoveriesRemaining = recoveriesRemaining
        self.onSavePress = onSavePress
        self.onDismiss = onDismiss
    }

    public var body: some View {
        ZStack {
            // Dim overlay — `rgba(0,0,0,0.6)` per RN spec.
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { onDismiss() }

            modalCard
                .padding(.horizontal, 24)
        }
        .background(Color.clear)
    }

    // MARK: - Card

    private var modalCard: some View {
        VStack(spacing: 0) {
            // Heading
            Text("Your streak is at risk!")
                .font(.custom(FontFamily.heading.rawValue, size: 24))
                .foregroundColor(AppColors.textPrimary)
                .multilineTextAlignment(.center)
                .padding(.bottom, 16)

            // Description
            Text("Complete a \(StreakRecoveryService.requiredSessionMinutes)-minute focus session to save your \(streak)-day streak")
                .font(.custom(FontFamily.body.rawValue, size: 16))
                .foregroundColor(AppColors.textSecondary)
                .lineSpacing(8)
                .multilineTextAlignment(.center)
                .padding(.bottom, 24)

            // Recoveries remaining pill
            recoveriesPill
                .padding(.bottom, 24)

            // Primary CTA — "Save My Streak"
            Button(action: onSavePress) {
                Text("Save My Streak")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                    .foregroundColor(AppColors.textPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppColors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(PressOpacityButtonStyle())
            .padding(.bottom, 12)

            // Secondary — "Let It Reset"
            Button(action: onDismiss) {
                Text("Let It Reset")
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                    .foregroundColor(AppColors.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.clear)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(AppColors.textMuted, lineWidth: 1)
                    )
            }
            .buttonStyle(PressOpacityButtonStyle())
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        // Bounded to ~85% — RN spec uses width:'85%' inside a centered View.
        // We approximate via padding(.horizontal, 24) on the outer ZStack.
    }

    // MARK: - Recoveries pill

    private var recoveriesPill: some View {
        let copy = recoveriesRemaining == 1
            ? "1 recovery remaining this week"
            : "\(recoveriesRemaining) recoveries remaining this week"
        return Text(copy)
            .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
            .foregroundColor(AppColors.textSecondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .padding(.horizontal, 16)
            .background(AppColors.backgroundSecondary)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}
