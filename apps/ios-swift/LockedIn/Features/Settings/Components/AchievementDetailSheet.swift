//
//  AchievementDetailSheet.swift
//  LockedIn
//
//  HUD-styled detail view for a single achievement. Presented when the user
//  taps any badge in `AchievementsRow` — works for both locked and unlocked
//  states. Mirrors the visual idiom of `DurationPickerSheet` /
//  `MoreOptionsHUDSheet`:
//
//   - SystemTokens.panelBg surface with corner brackets
//   - `// ACHIEVEMENT` Michroma eyebrow + Discipline-Blue gradient rule
//   - Big trophy icon tinted by the category color (muted when locked)
//   - Achievement name (category color) + description (`how to unlock`)
//   - Status pill — `UNLOCKED` (green) or `LOCKED` (muted) — plus an
//     unlock-date line for earned entries
//

import SwiftUI
import DesignKit

struct AchievementDetailSheet: View {
    let definition: AchievementDefinition
    let earned: Bool
    let onClose: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.75)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { onClose() }

            card
                .padding(.horizontal, 24)
        }
    }

    private var card: some View {
        ZStack {
            Rectangle()
                .fill(SystemTokens.panelBg)
                .overlay(Rectangle().stroke(SystemTokens.panelBorder, lineWidth: 1))

            VStack(alignment: .leading, spacing: 0) {
                header
                trophy
                    .padding(.top, 18)
                nameBlock
                    .padding(.top, 14)
                statusPill
                    .padding(.top, 14)
                howToUnlock
                    .padding(.top, 14)
                closeButton
                    .padding(.top, 16)
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .padding(.bottom, 16)

            HUDCornerBrackets(color: accent, pulses: false)
                .allowsHitTesting(false)
        }
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Subviews

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("// ACHIEVEMENT")
                .sectionLabel()
            LinearGradient(
                colors: [accent, .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 1)
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
            Text(definition.category.rawValue.uppercased())
                .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                .tracking(1.6)
                .foregroundColor(SystemTokens.textMuted)
                .padding(.top, 2)
        }
    }

    private var trophy: some View {
        ZStack {
            Circle()
                .fill(accent.opacity(earned ? 0.18 : 0.06))
            Circle()
                .stroke(accent.opacity(earned ? 1.0 : 0.4), lineWidth: 1.5)
            Image(systemName: earned ? "trophy.fill" : "lock.fill")
                .font(.system(size: 38, weight: .bold))
                .foregroundColor(accent)
        }
        .frame(width: 84, height: 84)
        .shadow(color: earned ? accent.opacity(0.5) : .clear, radius: 14)
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private var nameBlock: some View {
        VStack(spacing: 6) {
            Text(definition.name)
                .font(.custom(FontFamily.headingBold.rawValue, size: 22))
                .tracking(1.6)
                .foregroundColor(accent)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity)
        }
    }

    private var statusPill: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(earned ? AppColors.success : SystemTokens.textMuted)
                .frame(width: 6, height: 6)
            Text(earned ? "UNLOCKED" : "LOCKED")
                .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                .tracking(1.6)
                .foregroundColor(earned ? AppColors.success : SystemTokens.textMuted)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            (earned ? AppColors.success : SystemTokens.textMuted).opacity(0.08)
        )
        .overlay(
            Rectangle()
                .stroke(
                    (earned ? AppColors.success : SystemTokens.textMuted).opacity(0.4),
                    lineWidth: 1
                )
        )
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private var howToUnlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("// HOW TO UNLOCK")
                .sectionLabel()
            Text(definition.description)
                .font(.custom(FontFamily.body.rawValue, size: 14))
                .foregroundColor(AppColors.textSecondary)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var closeButton: some View {
        Button(action: onClose) {
            Text("Close")
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                .foregroundColor(SystemTokens.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressOpacityButtonStyle())
    }

    // MARK: - Tokens

    /// Accent color used for the trophy, name, brackets, and rule. Muted
    /// when locked so the sheet visually communicates state at a glance.
    private var accent: Color {
        earned ? definition.category.color : SystemTokens.textMuted
    }
}
