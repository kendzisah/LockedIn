//
//  LockInSetupSheet.swift
//  LockedIn — Session / Lock-In feature
//
//  Pre-start gate UI (Fix 5): presented by `MainNavigator` when
//  `LockInCoordinator.checkReadiness()` says a Lock-In can't actually block
//  anything yet — Family Controls auth is missing, or the allowlist is empty
//  (an empty allowlist deliberately applies NO shield; see
//  `SharedShieldApplier.apply`). Without this gate, "Lock In" silently starts
//  a session that blocks nothing and the user only finds out when the
//  distraction apps keep opening.
//
//  Two states, one sheet (the parent swaps the payload in place — the modal
//  identity is payload-independent so the cover doesn't dismiss/re-present):
//   - `.needsScreenTimeAuth`: ENABLE SCREEN TIME → `requestAuthorization()`.
//     A permanent denial (iOS shows no prompt once denied) flips the CTA to
//     OPEN SETTINGS via `UIApplication.openSettingsURLString`; returning from
//     Settings re-checks automatically via `scenePhase`.
//   - `.needsAppSelection`: CHOOSE ALLOWED APPS → the FamilyActivityPicker.
//
//  On any resolution the sheet calls `onResolved()` and the parent re-runs
//  `checkReadiness()` — advancing to the duration picker or swapping to the
//  next unmet requirement. "Not now" dismisses without starting a session.
//
//  Visual language mirrors `DurationPickerSheet` (HUD panel card, corner
//  brackets, `// LOCK IN` section label, InterTight headings) so the gate
//  reads as part of the same start flow, not an OS-style error dialog.
//

import SwiftUI
import UIKit
import DesignKit

public struct LockInSetupSheet: View {
    let readiness: LockInCoordinator.LockInReadiness
    /// The blocking requirement was (or may have been) resolved — parent
    /// re-checks readiness and routes.
    let onResolved: () -> Void
    /// "Not now" — back out without starting a session.
    let onDismiss: () -> Void

    /// Single-flight guard for the async auth / picker requests.
    @State private var isRequesting = false
    /// Family Controls was denied and iOS won't re-prompt in-app — the only
    /// path left is the Settings toggle. Seeded in `onAppear` (a pre-existing
    /// denial should show OPEN SETTINGS immediately) and set after an in-app
    /// request resolves to denied.
    @State private var permanentlyDenied = false

    @Environment(\.scenePhase) private var scenePhase

    public init(
        readiness: LockInCoordinator.LockInReadiness,
        onResolved: @escaping () -> Void,
        onDismiss: @escaping () -> Void
    ) {
        self.readiness = readiness
        self.onResolved = onResolved
        self.onDismiss = onDismiss
    }

    public var body: some View {
        ZStack {
            // Black 0.75 backdrop — same as DurationPickerSheet. Tap-through
            // dismissal is deliberately NOT offered: the gate should be
            // resolved or explicitly declined via "Not now".
            Color.black.opacity(0.75)
                .ignoresSafeArea()

            card
                .padding(.horizontal, 20)
        }
        .transition(.opacity)
        .onAppear {
            permanentlyDenied =
                LockModeService.shared.currentAuthorizationStatus == .denied
        }
        .onChange(of: scenePhase) { _, newPhase in
            // Returning from the Settings app (or the OS auth sheet resolving
            // out-of-band): if the blocking condition changed, advance without
            // requiring another tap.
            guard newPhase == .active else { return }
            permanentlyDenied =
                LockModeService.shared.currentAuthorizationStatus == .denied
            if LockInCoordinator.checkReadiness() != readiness {
                onResolved()
            }
        }
    }

    // MARK: - HUD card

    private var card: some View {
        ZStack {
            Rectangle()
                .fill(SystemTokens.panelBg)
                .overlay(
                    Rectangle()
                        .stroke(SystemTokens.panelBorder, lineWidth: 1)
                )

            VStack(alignment: .leading, spacing: 0) {
                header

                content
                    .padding(.top, 18)

                notNowButton
                    .padding(.top, 6)
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .padding(.bottom, 16)

            HUDCornerBrackets(color: SystemTokens.bracketColor, pulses: false)
                .allowsHitTesting(false)
        }
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Header strip (mirrors DurationPickerSheet)

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("// LOCK IN")
                .sectionLabel()
            LinearGradient(
                colors: [SystemTokens.bracketColor, .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 1)
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
            Text("SETUP REQUIRED")
                .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                .tracking(1.6)
                .foregroundColor(SystemTokens.textMuted)
                .padding(.top, 2)
        }
    }

    // MARK: - State content

    @ViewBuilder
    private var content: some View {
        switch readiness {
        case .needsScreenTimeAuth:
            authContent
        case .needsAppSelection:
            appSelectionContent
        case .ready:
            // Defensive: the parent never presents this sheet when ready —
            // if it happens anyway, resolve immediately on tap.
            appSelectionContent
        }
    }

    private var authContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            stateHeadline(
                icon: "hourglass",
                title: "Screen Time access needed"
            )
            Text("LockedIn blocks distracting apps with Apple's Screen Time. Without permission, a session can't block anything — it would just be a timer.")
                .font(.custom(FontFamily.body.rawValue, size: 13))
                .foregroundColor(SystemTokens.textSecondary)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            if permanentlyDenied {
                Text("Screen Time access was declined, so iOS won't show the prompt again here. Enable it in Settings, then come back — we'll pick up where you left off.")
                    .font(.custom(FontFamily.body.rawValue, size: 12))
                    .foregroundColor(SystemTokens.gold)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                primaryButton(title: "⟐  OPEN SETTINGS", action: openSettings)
            } else {
                primaryButton(title: "⟐  ENABLE SCREEN TIME", action: requestScreenTimeAuth)
            }
        }
    }

    private var appSelectionContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            stateHeadline(
                icon: "square.grid.2x2",
                title: "Choose your allowed apps"
            )
            Text("Pick the apps that stay open during a Lock-In — everything else gets blocked. With nothing selected, a session can't block anything.")
                .font(.custom(FontFamily.body.rawValue, size: 13))
                .foregroundColor(SystemTokens.textSecondary)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            primaryButton(title: "⟐  CHOOSE ALLOWED APPS", action: presentAppPicker)
        }
    }

    private func stateHeadline(icon: String, title: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(SystemTokens.glowAccent)
            Text(title)
                .font(.custom(FontFamily.heading.rawValue, size: 20))
                .tracking(-0.3)
                .foregroundColor(SystemTokens.textPrimary)
        }
    }

    // MARK: - Buttons (mirrors DurationPickerSheet's START block CTA)

    private func primaryButton(title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                .tracking(1.6)
                .foregroundColor(SystemTokens.glowAccent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.18))
                .overlay(
                    Rectangle()
                        .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.45), lineWidth: 1)
                )
                .opacity(isRequesting ? 0.35 : 1.0)
        }
        .buttonStyle(PressOpacityButtonStyle())
        .disabled(isRequesting)
    }

    private var notNowButton: some View {
        Button(action: onDismiss) {
            Text("Not now")
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                .foregroundColor(SystemTokens.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
        }
        .buttonStyle(PressOpacityButtonStyle())
    }

    // MARK: - Actions

    private func requestScreenTimeAuth() {
        guard !isRequesting else { return }
        isRequesting = true
        Task { @MainActor in
            let result = await LockModeService.shared.requestAuthorization()
            isRequesting = false
            if result == .approved {
                AnalyticsService.shared.track("Lock In Setup Resolved", properties: [
                    "step": "screen_time_auth",
                ])
                onResolved()
            } else {
                // `.denied` covers both a fresh decline and a pre-existing
                // permanent one — either way the in-app prompt is spent, so
                // route the user through Settings.
                permanentlyDenied = true
                AnalyticsService.shared.track("Lock In Setup Auth Denied")
            }
        }
    }

    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func presentAppPicker() {
        guard !isRequesting else { return }
        isRequesting = true
        Task { @MainActor in
            _ = await LockModeService.shared.showAppPicker()
            isRequesting = false
            // Only advance when the picker actually left a non-empty
            // allowlist — a cancelled/empty picker keeps the gate up.
            if LockModeService.shared.getSelectedAppCount() > 0 {
                AnalyticsService.shared.track("Lock In Setup Resolved", properties: [
                    "step": "app_selection",
                ])
                onResolved()
            }
        }
    }
}
