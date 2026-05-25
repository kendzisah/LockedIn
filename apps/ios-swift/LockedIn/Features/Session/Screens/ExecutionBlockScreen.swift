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

    /// Called when the session ends. `actualMinutes` matches the value
    /// the SessionComplete screen should receive; `wasNatural` indicates
    /// whether the timer hit zero (true) or the user held to end (false).
    public let onFinish: (_ actualMinutes: Int, _ wasNatural: Bool) -> Void

    @State private var engine: SessionEngine?
    @State private var timerOpacity: Double = 0.0
    @State private var holdProgress: Double = 0.0
    @State private var holdStartedAt: Date? = nil
    @State private var holdTickTimer: Timer? = nil
    @State private var isComplete: Bool = false
    @Environment(\.scenePhase) private var scenePhase

    public init(
        params: ExecutionBlockScreenParams,
        onFinish: @escaping (_ actualMinutes: Int, _ wasNatural: Bool) -> Void
    ) {
        self.params = params
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
            if !isComplete {
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
        guard !isComplete else { return }
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
        HapticsService.shared.success()
        engine?.endEarly()
    }

    // MARK: - Engine finish dispatch

    private func handleEngineFinish(status: SessionEngine.Status) {
        guard !isComplete else { return }
        isComplete = true

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
