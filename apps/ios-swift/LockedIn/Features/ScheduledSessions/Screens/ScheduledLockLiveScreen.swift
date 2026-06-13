//
//  ScheduledLockLiveScreen.swift
//  LockedIn — Scheduled Lock-In Sessions
//
//  Live countdown for an auto-block scheduled session that is currently in its
//  window. Surfaced when the user taps the scheduled-session notification (or
//  opens the app) mid-window. Apps are already shielded by the DeviceActivity
//  extension; this is the in-app view of the running session.
//
//  Crediting: on natural completion it calls `onComplete`, which credits EXP
//  once (deduped by occurrence id) and shows the SessionComplete celebration.
//  "Minimize" just dismisses the view — the auto-block keeps running in the
//  background and the queued completion credits on the next app open.
//

import SwiftUI
import UIKit
import DesignKit

public struct ScheduledLockLiveScreen: View {
    public let durationMinutes: Int
    public let endTimestamp: Date
    public let goal: String?
    /// Timer reached the window end → credit + celebrate.
    public let onComplete: () -> Void
    /// User minimized → keep the auto-block running, just dismiss the view.
    public let onMinimize: () -> Void

    @State private var engine: SessionEngine?
    @State private var timerOpacity: Double = 0.0
    @State private var isComplete = false
    @State private var showBreakPrompt = false
    @State private var breakQuote = ""
    @State private var isOnBreak = false
    @Environment(\.scenePhase) private var scenePhase

    public init(
        durationMinutes: Int,
        endTimestamp: Date,
        goal: String? = nil,
        onComplete: @escaping () -> Void,
        onMinimize: @escaping () -> Void
    ) {
        self.durationMinutes = durationMinutes
        self.endTimestamp = endTimestamp
        self.goal = goal
        self.onComplete = onComplete
        self.onMinimize = onMinimize
    }

    public var body: some View {
        ZStack {
            AppColors.lockInBackground.ignoresSafeArea()

            // Minimize (top-right) — returns to the app; session keeps running.
            VStack {
                HStack {
                    Spacer()
                    Button(action: onMinimize) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.down")
                                .font(.system(size: 16, weight: .semibold))
                            Text("MINIMIZE")
                                .font(.custom(FontFamily.display.rawValue, size: 10))
                                .tracking(1.6)
                        }
                        .foregroundColor(AppColors.textMuted)
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)
                Spacer()
            }

            if let engine {
                VStack(spacing: 14) {
                    Text("SCHEDULED LOCK-IN")
                        .font(.custom(FontFamily.display.rawValue, size: 10))
                        .tracking(2.4)
                        .foregroundColor(SystemTokens.cyan)
                    Text(SessionTimeFormatter.format(seconds: engine.remainingSeconds))
                        .font(.custom(FontFamily.heading.rawValue, size: 72))
                        .monospacedDigit()
                        .tracking(-1)
                        .foregroundColor(AppColors.textPrimary)
                    Text(SessionPhaseText.text(
                        elapsedSeconds: engine.totalSeconds - engine.remainingSeconds,
                        totalSeconds: engine.totalSeconds
                    ))
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 16))
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                }
                .opacity(timerOpacity)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            // Take-a-break (Pause Protocol) button, pinned to the bottom.
            if !isOnBreak && !showBreakPrompt {
                VStack {
                    Spacer()
                    Button(action: {
                        breakQuote = TateQuotes.random()
                        HapticsService.shared.light()
                        withAnimation(.easeOut(duration: 0.25)) { showBreakPrompt = true }
                    }) {
                        HStack(spacing: 8) {
                            Image(systemName: "pause.fill").font(.system(size: 12, weight: .bold))
                            Text("PAUSE PROTOCOL")
                                .font(.custom(FontFamily.display.rawValue, size: 11))
                                .tracking(1.8)
                        }
                        .foregroundColor(SystemTokens.cyan)
                        .padding(.horizontal, 22)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.04))
                        .overlay(Rectangle().stroke(SystemTokens.cyan.opacity(0.3), lineWidth: 1))
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                    .padding(.bottom, 70)
                }
            }

            if showBreakPrompt { breakPromptOverlay.transition(.opacity) }
            if isOnBreak { onBreakOverlay.transition(.opacity) }
        }
        .statusBarHidden(true)
        .onAppear { handleAppear() }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active { engine?.sync() }
        }
    }

    // MARK: - Break (Pause Protocol)

    private var breakPromptOverlay: some View {
        ZStack {
            Color.black.opacity(0.85).ignoresSafeArea()
            VStack(spacing: 0) {
                Text("// PAUSE PROTOCOL")
                    .font(.custom(FontFamily.display.rawValue, size: 11))
                    .tracking(2.5)
                    .foregroundColor(SystemTokens.glowAccent)
                    .padding(.bottom, 16)
                Image(systemName: "pause.circle.fill")
                    .font(.system(size: 28))
                    .foregroundColor(SystemTokens.gold)
                    .padding(.bottom, 16)
                Text("Taking a break?")
                    .font(.custom(FontFamily.heading.rawValue, size: 22))
                    .tracking(-0.3)
                    .foregroundColor(AppColors.textPrimary)
                    .padding(.bottom, 14)
                Text("\"\(breakQuote)\"")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 15))
                    .italic()
                    .foregroundColor(SystemTokens.cyan)
                    .lineSpacing(5)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 24)
                Button(action: { withAnimation(.easeOut(duration: 0.25)) { showBreakPrompt = false } }) {
                    Text("▸  STAY LOCKED IN")
                        .font(.custom(FontFamily.display.rawValue, size: 12))
                        .tracking(2.0)
                        .foregroundColor(AppColors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(SystemTokens.glowAccentSoft)
                        .overlay(Rectangle().stroke(SystemTokens.bracketColor, lineWidth: 1))
                }
                .buttonStyle(PressOpacityButtonStyle())
                .padding(.bottom, 10)
                Button(action: confirmBreak) {
                    Text("I need a break")
                        .font(.custom(FontFamily.body.rawValue, size: 13))
                        .foregroundColor(AppColors.danger)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(PressOpacityButtonStyle())
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 28)
            .background(
                Rectangle()
                    .fill(SystemTokens.panelBg)
                    .overlay(Rectangle().stroke(SystemTokens.panelBorder, lineWidth: 1))
            )
            .padding(.horizontal, 28)
        }
    }

    private var onBreakOverlay: some View {
        ZStack {
            AppColors.lockInBackground.ignoresSafeArea()
            VStack(spacing: 20) {
                Text("ON BREAK")
                    .font(.custom(FontFamily.display.rawValue, size: 12))
                    .tracking(3)
                    .foregroundColor(SystemTokens.gold)
                Text(SessionTimeFormatter.format(seconds: engine?.remainingSeconds ?? 0))
                    .font(.custom(FontFamily.heading.rawValue, size: 56))
                    .monospacedDigit()
                    .foregroundColor(AppColors.textPrimary)
                Text("Apps are unblocked. The clock keeps running — get back to it.")
                    .font(.custom(FontFamily.body.rawValue, size: 14))
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                Button(action: resumeBreak) {
                    Text("▸  RESUME LOCK-IN")
                        .font(.custom(FontFamily.display.rawValue, size: 13))
                        .tracking(2)
                        .foregroundColor(AppColors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(SystemTokens.glowAccentSoft)
                        .overlay(Rectangle().stroke(SystemTokens.bracketColor, lineWidth: 1))
                }
                .buttonStyle(PressOpacityButtonStyle())
                .padding(.horizontal, 40)
                .padding(.top, 12)
            }
        }
    }

    private func confirmBreak() {
        withAnimation(.easeOut(duration: 0.25)) {
            showBreakPrompt = false
            isOnBreak = true
        }
        HapticsService.shared.warning()
        // A scheduled window is OS-fixed and can't be paused, so the break just
        // lifts the shield (apps unblock); the countdown keeps running. Resume
        // re-applies the shield. Doesn't touch the DeviceActivity schedule.
        ScreenTimeModule.shared.removeShield()
    }

    private func resumeBreak() {
        withAnimation(.easeOut(duration: 0.25)) { isOnBreak = false }
        HapticsService.shared.rigid()
        ScreenTimeModule.shared.shieldApps()
    }

    private func handleAppear() {
        UIApplication.shared.isIdleTimerDisabled = true
        if engine == nil {
            // Drive the countdown straight to the real window end.
            engine = SessionEngine(
                durationMinutes: durationMinutes,
                resumeEndTimestamp: endTimestamp,
                onComplete: { _ in
                    Task { @MainActor in
                        guard !isComplete else { return }
                        isComplete = true
                        HapticsService.shared.success()
                        onComplete()
                    }
                }
            )
            engine?.start()
        }
        withAnimation(.easeInOut(duration: 0.6)) { timerOpacity = 1.0 }
    }
}
