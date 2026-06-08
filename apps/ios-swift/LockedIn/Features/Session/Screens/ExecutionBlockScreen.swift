//
//  ExecutionBlockScreen.swift
//  LockedIn — Worker W11 (Session / Lock-In feature)
//
//  Port of `apps/mobile/src/features/home/ExecutionBlockScreen.tsx`. Standalone
//  immersive lock-in timer:
//   - Lock-in background `#090C10` (`AppColors.lockInBackground`).
//   - Monospace-style countdown (uses Inter Tight Bold + `.monospacedDigit()`),
//     72pt, letterSpacing −1, fades in over 600ms.
//   - Phase text cycles every 20% elapsed (mirrors RN `getPhaseText`).
//   - Hold-to-end (2s) custom touch button at the bottom — light haptic
//     every 500ms, success haptic on release.
//   - Idle timer disabled while on-screen (`isIdleTimerDisabled = true`).
//   - On natural completion or hold-to-end, replaces with SessionCompleteScreen
//     via `onFinish` (navigation owned by parent, matching RN `replace`).
//
//  Route params equivalent (passed via initializer):
//   - `durationMinutes: Int`
//   - `resumeEndTimestamp: Date?` (when non-nil, this is a resume from a
//     persisted active block — mirrors `route.params.resumeEndTimestamp`).
//

import SwiftUI
import UIKit
import DesignKit

public struct ExecutionBlockScreenParams: Equatable {
    public let durationMinutes: Int
    public let resumeEndTimestamp: Date?

    public init(durationMinutes: Int, resumeEndTimestamp: Date? = nil) {
        self.durationMinutes = durationMinutes
        self.resumeEndTimestamp = resumeEndTimestamp
    }
}

public struct ExecutionBlockScreen: View {
    public let params: ExecutionBlockScreenParams

    /// The user's primary goal, surfaced in the quit-confirmation dialog so a
    /// momentary urge to bail is met with a reminder of what they're chasing.
    public let goal: String?

    /// Called when the session ends. `actualMinutes` matches the value
    /// the SessionComplete screen should receive; `wasNatural` indicates
    /// whether the timer hit zero (true) or the user held to end (false).
    public let onFinish: (_ actualMinutes: Int, _ wasNatural: Bool) -> Void

    /// Two-stage gate after a completed hold-to-end. We never end the session
    /// straight from the hold anymore — the user has to walk past both prompts.
    private enum QuitStage { case none, firstConfirm, secondConfirm }

    @State private var engine: SessionEngine?
    @State private var timerOpacity: Double = 0.0
    @State private var holdProgress: Double = 0.0
    @State private var holdStartedAt: Date? = nil
    @State private var holdTickTimer: Timer? = nil
    @State private var isComplete: Bool = false
    @State private var quitStage: QuitStage = .none
    @Environment(\.scenePhase) private var scenePhase

    public init(
        params: ExecutionBlockScreenParams,
        goal: String? = nil,
        onFinish: @escaping (_ actualMinutes: Int, _ wasNatural: Bool) -> Void
    ) {
        self.params = params
        self.goal = goal
        self.onFinish = onFinish
    }

    public var body: some View {
        ZStack {
            AppColors.lockInBackground
                .ignoresSafeArea()

            if let engine {
                VStack(spacing: 24) {
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

            // Hold-to-end button pinned to the bottom.
            if !isComplete && quitStage == .none {
                VStack(spacing: 8) {
                    Spacer()
                    holdButton
                    Text("Hold to end session")
                        .font(.custom(FontFamily.body.rawValue, size: 11))
                        .tracking(0.3)
                        .foregroundColor(AppColors.textMuted)
                        .opacity(0.4)
                        .padding(.bottom, 60)
                }
            }

            // Two-stage quit confirmation (shown after a completed hold).
            if quitStage != .none {
                quitDialogOverlay
                    .transition(.opacity)
            }
        }
        .statusBarHidden(true)
        .onAppear { handleAppear() }
        .onDisappear { handleDisappear() }
        .onChange(of: scenePhase) { _, newPhase in
            // Re-sync timer when foregrounding (covers sleep / background).
            if newPhase == .active {
                engine?.sync()
            }
        }
    }

    // MARK: - Hold-to-end UI

    private static let holdDurationSeconds: Double = 2.0

    private var holdButton: some View {
        ZStack {
            // Pulsing ring shows hold progress (scales 0 → 1 over hold duration).
            Circle()
                .stroke(AppColors.accent, lineWidth: 2)
                .frame(width: 56, height: 56)
                .scaleEffect(holdProgress)
                .opacity(holdProgress > 0 ? 0.4 : 0)
                .animation(.linear(duration: 0.05), value: holdProgress)

            // Lock body — `lock_close.json` Lottie driven by the hold
            // progress so the lock visually closes as the user holds.
            LockLottieView(progress: holdProgress)
                .frame(width: 32, height: 32)
        }
        .frame(width: 56, height: 56)
        .contentShape(Rectangle())
        .simultaneousGesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { _ in
                    if holdStartedAt == nil { startHold() }
                }
                .onEnded { _ in
                    cancelHold()
                }
        )
    }

    // MARK: - Quit dialog UI

    private var remainingMinutes: Int {
        max(0, Int(ceil(Double(engine?.remainingSeconds ?? 0) / 60.0)))
    }

    private var goalText: String? {
        guard let g = goal?.trimmingCharacters(in: .whitespacesAndNewlines), !g.isEmpty else { return nil }
        return g
    }

    @ViewBuilder
    private var quitDialogOverlay: some View {
        ZStack {
            Color.black.opacity(0.85)
                .ignoresSafeArea()
            switch quitStage {
            case .firstConfirm: firstQuitPanel
            case .secondConfirm: secondQuitPanel
            case .none: EmptyView()
            }
        }
    }

    private var firstQuitPanel: some View {
        quitPanel(
            eyebrow: "// ABORT PROTOCOL",
            icon: "exclamationmark.triangle.fill",
            iconColor: SystemTokens.gold,
            title: "End the session?",
            bodyContent: {
                VStack(spacing: 14) {
                    if let goalText {
                        VStack(spacing: 6) {
                            Text("YOU'RE LOCKED IN FOR")
                                .font(.custom(FontFamily.display.rawValue, size: 9))
                                .tracking(1.6)
                                .foregroundColor(SystemTokens.textMuted)
                            Text(goalText)
                                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 15))
                                .foregroundColor(SystemTokens.cyan)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(SystemTokens.glowAccentSoft)
                        .overlay(Rectangle().stroke(SystemTokens.panelBorder, lineWidth: 1))
                    }
                    Text(remainingMinutes > 0
                         ? "\(remainingMinutes) min left on the clock. Quit now and this session doesn't count."
                         : "You're almost there. Quit now and this session doesn't count.")
                        .font(.custom(FontFamily.body.rawValue, size: 14))
                        .foregroundColor(SystemTokens.textSecondary)
                        .lineSpacing(5)
                        .multilineTextAlignment(.center)
                }
            },
            backLabel: "LOCK BACK IN",
            backAction: { dismissQuit(reconsideredAtStage: 1) },
            quitLabel: "Quit anyway",
            quitAction: { withAnimation(.easeOut(duration: 0.25)) { quitStage = .secondConfirm } }
        )
    }

    private var secondQuitPanel: some View {
        quitPanel(
            eyebrow: "// IDENTITY CHECK",
            icon: "person.fill.questionmark",
            iconColor: SystemTokens.red,
            title: "Is this who you want to become?",
            bodyContent: {
                Text("A quitter? Discipline is forged in the exact moment you want to stop. Walk away now and that's the pattern you reinforce — the next quit gets easier.")
                    .font(.custom(FontFamily.body.rawValue, size: 14))
                    .foregroundColor(SystemTokens.textSecondary)
                    .lineSpacing(5)
                    .multilineTextAlignment(.center)
            },
            backLabel: "NO — STAY LOCKED IN",
            backAction: { dismissQuit(reconsideredAtStage: 2) },
            quitLabel: "Yes, I quit",
            quitAction: { confirmQuit() }
        )
    }

    @ViewBuilder
    private func quitPanel<Body: View>(
        eyebrow: String,
        icon: String,
        iconColor: Color,
        title: String,
        @ViewBuilder bodyContent: () -> Body,
        backLabel: String,
        backAction: @escaping () -> Void,
        quitLabel: String,
        quitAction: @escaping () -> Void
    ) -> some View {
        ZStack {
            Rectangle()
                .fill(SystemTokens.panelBg)
                .overlay(Rectangle().stroke(SystemTokens.panelBorder, lineWidth: 1))

            VStack(spacing: 0) {
                Text(eyebrow)
                    .font(.custom(FontFamily.display.rawValue, size: 11))
                    .tracking(2.5)
                    .foregroundColor(SystemTokens.glowAccent)
                    .padding(.bottom, 16)

                Image(systemName: icon)
                    .font(.system(size: 28))
                    .foregroundColor(iconColor)
                    .padding(.bottom, 16)

                Text(title)
                    .font(.custom(FontFamily.heading.rawValue, size: 22))
                    .tracking(-0.3)
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 14)

                bodyContent()
                    .padding(.bottom, 24)

                // Encouraged action — HUD accent button.
                Button(action: backAction) {
                    ZStack {
                        Rectangle()
                            .fill(SystemTokens.glowAccentSoft)
                            .overlay(Rectangle().stroke(SystemTokens.bracketColor, lineWidth: 1))
                        HStack(spacing: 0) {
                            Rectangle().fill(SystemTokens.bracketColor).frame(width: 2)
                            Spacer(minLength: 0)
                        }
                        HStack(spacing: 10) {
                            Text("▸")
                                .font(.custom(FontFamily.display.rawValue, size: 10))
                                .foregroundColor(SystemTokens.bracketColor)
                            Text(backLabel)
                                .font(.custom(FontFamily.display.rawValue, size: 12))
                                .tracking(2.0)
                                .foregroundColor(AppColors.textPrimary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                }
                .buttonStyle(PressOpacityButtonStyle())
                .padding(.bottom, 10)

                // Quit action — muted danger, deliberately understated.
                Button(action: quitAction) {
                    Text(quitLabel)
                        .font(.custom(FontFamily.body.rawValue, size: 13))
                        .foregroundColor(AppColors.danger)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(PressOpacityButtonStyle())
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 28)

            HUDCornerBrackets(length: 16, thickness: 1.5, color: SystemTokens.bracketColor, pulses: false)
                .allowsHitTesting(false)
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 28)
    }

    // MARK: - Lifecycle

    private func handleAppear() {
        // Keep screen awake.
        UIApplication.shared.isIdleTimerDisabled = true

        // Spin up the engine once.
        if engine == nil {
            engine = SessionEngine(
                durationMinutes: params.durationMinutes,
                resumeEndTimestamp: params.resumeEndTimestamp,
                onComplete: { status in
                    Task { @MainActor in handleEngineFinish(status: status) }
                }
            )
            engine?.start()
        }

        // Fade timer in.
        withAnimation(.easeInOut(duration: 0.6)) { timerOpacity = 1.0 }

        // Schedule the "block done" local notification (covers background
        // case so the user gets a ping even if the app is killed).
        if let endTs = params.resumeEndTimestamp {
            NotificationService.shared.scheduleExecutionBlockDone(endsAt: endTs)
        } else {
            let endsAt = Date().addingTimeInterval(TimeInterval(params.durationMinutes * 60))
            NotificationService.shared.scheduleExecutionBlockDone(endsAt: endsAt)
        }
        AnalyticsService.shared.track(
            params.resumeEndTimestamp == nil ? "Session Started" : "Session Resumed",
            properties: ["duration_minutes": params.durationMinutes]
        )
    }

    private func handleDisappear() {
        UIApplication.shared.isIdleTimerDisabled = false
        holdTickTimer?.invalidate()
        holdTickTimer = nil
    }

    // MARK: - Hold lifecycle

    private func startHold() {
        // Bail out when the quit gate is already open. Without this, a
        // lingering DragGesture.onChanged event (fired right as the hold
        // button was being removed from the view tree) would see
        // `holdStartedAt == nil` (cleared by `completeHold`) and kick off a
        // fresh 2-second hold — eventually firing the quit dialog a second
        // time on the same press.
        guard !isComplete, quitStage == .none else { return }
        holdStartedAt = Date()

        holdTickTimer?.invalidate()
        holdTickTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { _ in
            Task { @MainActor in
                guard let startedAt = holdStartedAt else { return }
                let elapsed = Date().timeIntervalSince(startedAt)
                let progress = min(1.0, elapsed / Self.holdDurationSeconds)
                holdProgress = progress

                // Light haptic every 500ms while holding.
                let bucket = Int(elapsed * 1000.0) % 500
                if bucket < 50 {
                    HapticsService.shared.light()
                }

                if progress >= 1.0 {
                    completeHold()
                }
            }
        }
    }

    private func cancelHold() {
        holdTickTimer?.invalidate()
        holdTickTimer = nil
        holdStartedAt = nil
        withAnimation(.easeOut(duration: 0.2)) { holdProgress = 0 }
    }

    private func completeHold() {
        holdTickTimer?.invalidate()
        holdTickTimer = nil
        holdStartedAt = nil
        // The hold no longer ends the session directly — it opens the
        // two-stage "are you sure" gate. Reset the lock visual and surface
        // the first prompt.
        HapticsService.shared.warning()
        withAnimation(.easeOut(duration: 0.2)) { holdProgress = 0 }
        withAnimation(.easeOut(duration: 0.25)) { quitStage = .firstConfirm }
        AnalyticsService.shared.track("Session Quit Prompt Shown", properties: [
            "duration_minutes": params.durationMinutes,
        ])
    }

    // MARK: - Quit gate

    /// User backed out at either stage — keep them locked in.
    private func dismissQuit(reconsideredAtStage stage: Int) {
        HapticsService.shared.light()
        withAnimation(.easeOut(duration: 0.25)) { quitStage = .none }
        AnalyticsService.shared.track("Session Quit Reconsidered", properties: [
            "duration_minutes": params.durationMinutes,
            "stage": stage,
        ])
    }

    /// User pushed through both prompts — end the session for real.
    private func confirmQuit() {
        HapticsService.shared.rigid()
        quitStage = .none
        engine?.endEarly()
    }

    // MARK: - Engine finish dispatch

    private func handleEngineFinish(status: SessionEngine.Status) {
        guard !isComplete else { return }
        isComplete = true
        // If the timer completes naturally while the quit gate is open, drop
        // the dialog — this is a win, not a quit.
        quitStage = .none

        // Side effects mirror ExecutionBlockScreen.tsx:111-145 / :148-193.
        HapticsService.shared.success()
        LockModeService.shared.endSession()

        NotificationService.shared.cancelExecutionBlockDone()
        NotificationService.shared.onSessionCompletedToday()
        let isNatural: Bool = {
            if case .completedNaturally = status { return true }
            return false
        }()
        AnalyticsService.shared.track(
            isNatural ? "Session Completed" : "Session Abandoned",
            properties: ["duration_minutes": params.durationMinutes]
        )

        // Clear the active execution block snapshot.
        Defaults.remove(SessionState.activeExecutionBlockKey, scope: .standard)
        Defaults.remove(SessionState.activeExecutionBlockKey, scope: .appGroup)

        // Fade out before handing off.
        withAnimation(.easeInOut(duration: 0.5)) { timerOpacity = 0 }

        switch status {
        case .completedNaturally:
            onFinish(params.durationMinutes, true)

        case .endedEarly(let actualMinutes):
            // RN: when elapsed < 60s, return to Tabs without completion.
            // We surface the same value here so the parent can short-circuit.
            let elapsedSeconds = (params.durationMinutes * 60) - (engine?.remainingSeconds ?? 0)
            if elapsedSeconds < 60 {
                // Caller is expected to navigate back to Tabs on (0, false).
                onFinish(0, false)
            } else {
                onFinish(actualMinutes, false)
            }

        case .idle, .running:
            // Should not happen — engine only fires onComplete in terminal states.
            break
        }
    }
}
