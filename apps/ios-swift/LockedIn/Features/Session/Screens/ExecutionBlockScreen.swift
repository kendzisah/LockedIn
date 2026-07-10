//
//  ExecutionBlockScreen.swift
//  LockedIn — Session / Lock-In feature
//
//  Full-screen immersive view of the active manual lock-in. The timer + pause
//  state now live in `ActiveSessionStore` (shared with the minimized Home
//  tracker), so this screen is a pure view over the store: it drives the quit
//  gate, the Pause Protocol break, hardcore no-exit, and minimize, but it does
//  not own the engine or the completion side-effects.
//

import SwiftUI
import UIKit
import DesignKit

public struct ExecutionBlockScreen: View {
    @Environment(ActiveSessionStore.self) private var store

    /// Leave the timer and return to the app — the session keeps running in the
    /// background (shield + Live Activity stay up). Nil hides the minimize
    /// control.
    public let onMinimize: (() -> Void)?

    /// Multi-stage gate after a completed hold-to-end. We never end the session
    /// straight from the hold — the user walks past both prompts AND a forced
    /// cool-down before the exit unlocks.
    private enum QuitStage { case none, firstConfirm, secondConfirm, cooldown }

    @State private var timerOpacity: Double = 0.0
    @State private var holdProgress: Double = 0.0
    @State private var holdStartedAt: Date? = nil
    @State private var holdTickTimer: Timer? = nil
    @State private var quitStage: QuitStage = .none
    @State private var showBreakPrompt: Bool = false
    @State private var breakQuote: String = ""
    @State private var cooldownRemaining: Int = Self.cooldownSeconds
    @State private var cooldownTimer: Timer? = nil
    @Environment(\.scenePhase) private var scenePhase

    /// Forced "sit with the urge" delay before the exit unlocks at the final
    /// quit step. Impulse urges to bail pass within ~a minute.
    private static let cooldownSeconds: Int = 60

    public init(onMinimize: (() -> Void)? = nil) {
        self.onMinimize = onMinimize
    }

    private var isOnBreak: Bool { store.isOnBreak }

    public var body: some View {
        ZStack {
            AppColors.lockInBackground
                .ignoresSafeArea()

            if let engine = store.engine {
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

            // Minimize (top-right) — leave the timer; session keeps running.
            if let onMinimize, store.isActive, quitStage == .none, !showBreakPrompt, !isOnBreak {
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
            }

            // Bottom controls. Hardcore hides every exit; otherwise Pause
            // Protocol + hold-to-end.
            if store.isActive, quitStage == .none, !showBreakPrompt, !isOnBreak {
                VStack(spacing: 18) {
                    Spacer()
                    if store.hardcore {
                        hardcoreIndicator
                    } else {
                        pauseProtocolButton
                        VStack(spacing: 8) {
                            holdButton
                            Text("Hold to end session")
                                .font(.custom(FontFamily.body.rawValue, size: 11))
                                .tracking(0.3)
                                .foregroundColor(AppColors.textMuted)
                                .opacity(0.4)
                        }
                    }
                }
                .padding(.bottom, 60)
            }

            // Two-stage quit confirmation (shown after a completed hold).
            if quitStage != .none {
                quitDialogOverlay
                    .transition(.opacity)
            }

            // Pause Protocol deterrent (Tate quote) + paused break state.
            if showBreakPrompt {
                breakPromptOverlay
                    .transition(.opacity)
            }
            if isOnBreak {
                breakOverlay
                    .transition(.opacity)
            }
        }
        .statusBarHidden(true)
        .onAppear { handleAppear() }
        .onDisappear { handleDisappear() }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active { store.syncOnForeground() }
        }
    }

    // MARK: - Hold-to-end UI

    private static let holdDurationSeconds: Double = 2.0

    private var holdButton: some View {
        ZStack {
            Circle()
                .stroke(AppColors.accent, lineWidth: 2)
                .frame(width: 56, height: 56)
                .scaleEffect(holdProgress)
                .opacity(holdProgress > 0 ? 0.4 : 0)
                .animation(.linear(duration: 0.05), value: holdProgress)

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
        max(0, Int(ceil(Double(store.remainingSeconds) / 60.0)))
    }

    private var elapsedSeconds: Int { store.elapsedSeconds }

    /// Quitting under 60s elapsed earns nothing at all (mirrors the engine's
    /// `endedEarly` < 60s → 0 rule).
    private var willCountAsZero: Bool { elapsedSeconds < 60 }

    private var bankedMinutes: Int { max(0, elapsedSeconds / 60) }

    private var goalText: String? {
        guard let g = store.goal?.trimmingCharacters(in: .whitespacesAndNewlines), !g.isEmpty else { return nil }
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
            case .cooldown: cooldownPanel
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
                    // Concrete stakes — what quitting actually costs right now.
                    VStack(spacing: 10) {
                        Text("\(remainingMinutes) MIN LEFT")
                            .font(.custom(FontFamily.headingBold.rawValue, size: 18))
                            .tracking(1)
                            .foregroundColor(AppColors.textPrimary)

                        if willCountAsZero {
                            Text("Under a minute in — quit now and you get ZERO. No minutes, no XP.")
                                .font(.custom(FontFamily.body.rawValue, size: 14))
                                .foregroundColor(SystemTokens.red)
                                .lineSpacing(5)
                                .multilineTextAlignment(.center)
                        } else {
                            Text("You'll keep the \(bankedMinutes) min you've banked — but forfeit the final \(remainingMinutes) and the completed-session bonus.")
                                .font(.custom(FontFamily.body.rawValue, size: 14))
                                .foregroundColor(SystemTokens.textSecondary)
                                .lineSpacing(5)
                                .multilineTextAlignment(.center)
                        }

                        if store.streak > 0 {
                            Text("🔥 \(store.streak)-day streak on the line. Don't be the reason it dies.")
                                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 13))
                                .foregroundColor(SystemTokens.gold)
                                .lineSpacing(4)
                                .multilineTextAlignment(.center)
                        }
                    }
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
            quitAction: { beginCooldown() }
        )
    }

    // MARK: - Cool-down gate

    private var cooldownPanel: some View {
        quitPanel(
            eyebrow: "// COOL-DOWN",
            icon: "hourglass",
            iconColor: SystemTokens.cyan,
            title: cooldownRemaining > 0 ? "Sit with the urge." : "Still want out?",
            bodyContent: {
                VStack(spacing: 14) {
                    Text(cooldownRemaining > 0
                         ? "The urge to quit is a spike — it passes. Breathe. If you still want out when the timer hits zero, the door opens."
                         : "The urge has had its minute. Walk back in, or leave — your choice now.")
                        .font(.custom(FontFamily.body.rawValue, size: 14))
                        .foregroundColor(SystemTokens.textSecondary)
                        .lineSpacing(5)
                        .multilineTextAlignment(.center)
                    if cooldownRemaining > 0 {
                        Text(SessionTimeFormatter.format(seconds: cooldownRemaining))
                            .font(.custom(FontFamily.heading.rawValue, size: 40))
                            .monospacedDigit()
                            .foregroundColor(AppColors.textPrimary)
                    }
                }
            },
            backLabel: "STAY LOCKED IN",
            backAction: { dismissCooldown() },
            quitLabel: cooldownRemaining > 0 ? "Leave (\(cooldownRemaining)s)" : "Leave anyway",
            quitAction: { if cooldownRemaining <= 0 { confirmQuit() } }
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

    // MARK: - Pause Protocol UI

    private var hardcoreIndicator: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "flame.fill").font(.system(size: 12))
                Text("HARDCORE — NO EXIT")
                    .font(.custom(FontFamily.display.rawValue, size: 11))
                    .tracking(1.8)
            }
            .foregroundColor(SystemTokens.red)
            Text("You committed. Finish it.")
                .font(.custom(FontFamily.body.rawValue, size: 11))
                .foregroundColor(AppColors.textMuted)
                .opacity(0.6)
        }
    }

    private var pauseProtocolButton: some View {
        let hasBreaks = store.breaksRemainingToday > 0
        return Button(action: {
            guard hasBreaks else { return }
            breakQuote = TateQuotes.random()
            HapticsService.shared.light()
            withAnimation(.easeOut(duration: 0.25)) { showBreakPrompt = true }
        }) {
            HStack(spacing: 8) {
                Image(systemName: "pause.fill").font(.system(size: 12, weight: .bold))
                Text(hasBreaks ? "PAUSE PROTOCOL · \(store.breaksRemainingToday) LEFT" : "NO BREAKS LEFT TODAY")
                    .font(.custom(FontFamily.display.rawValue, size: 11))
                    .tracking(1.8)
            }
            .foregroundColor(hasBreaks ? SystemTokens.cyan : SystemTokens.textMuted)
            .padding(.horizontal, 22)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.04))
            .overlay(Rectangle().stroke((hasBreaks ? SystemTokens.cyan : SystemTokens.textMuted).opacity(0.3), lineWidth: 1))
        }
        .buttonStyle(PressOpacityButtonStyle())
        .disabled(!hasBreaks)
    }

    // Tate-quote deterrent + break-length picker.
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
                    .padding(.bottom, 12)
                Text("\"\(breakQuote)\"")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 15))
                    .italic()
                    .foregroundColor(SystemTokens.cyan)
                    .lineSpacing(5)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 18)

                Text("\(store.breaksRemainingToday) of \(ActiveSessionStore.maxBreaksPerDay) breaks left today")
                    .font(.custom(FontFamily.display.rawValue, size: 9))
                    .tracking(1.4)
                    .foregroundColor(SystemTokens.textMuted)
                    .padding(.bottom, 12)

                // Break-length chips — auto-resumes when the timer ends.
                HStack(spacing: 8) {
                    ForEach(ActiveSessionStore.breakOptions, id: \.self) { secs in
                        Button(action: {
                            withAnimation(.easeOut(duration: 0.25)) { showBreakPrompt = false }
                            store.startBreak(seconds: secs)
                        }) {
                            Text(breakLabel(secs))
                                .font(.custom(FontFamily.headingBold.rawValue, size: 14))
                                .foregroundColor(SystemTokens.cyan)
                                .frame(maxWidth: .infinity)
                                .frame(height: 46)
                                .background(SystemTokens.cyan.opacity(0.10))
                                .overlay(Rectangle().stroke(SystemTokens.cyan.opacity(0.3), lineWidth: 1))
                        }
                        .buttonStyle(PressOpacityButtonStyle())
                    }
                }
                .padding(.bottom, 14)

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
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 28)
            .background(
                Rectangle()
                    .fill(SystemTokens.panelBg)
                    .overlay(Rectangle().stroke(SystemTokens.panelBorder, lineWidth: 1))
            )
            .padding(.horizontal, 24)
        }
    }

    private func breakLabel(_ seconds: Int) -> String {
        seconds < 60 ? "\(seconds)s" : "\(seconds / 60)m"
    }

    private var breakOverlay: some View {
        ZStack {
            AppColors.lockInBackground.ignoresSafeArea()
            VStack(spacing: 20) {
                Text("ON BREAK")
                    .font(.custom(FontFamily.display.rawValue, size: 12))
                    .tracking(3)
                    .foregroundColor(SystemTokens.gold)
                Text(SessionTimeFormatter.format(seconds: store.breakRemainingSeconds))
                    .font(.custom(FontFamily.heading.rawValue, size: 64))
                    .monospacedDigit()
                    .foregroundColor(AppColors.textPrimary)
                Text("Resumes automatically. Focus time is frozen.")
                    .font(.custom(FontFamily.body.rawValue, size: 14))
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                Button(action: { store.endBreakEarly() }) {
                    Text("▸  END BREAK NOW")
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

            // Minimize during a break — the Home FocusRing renders the frozen
            // break countdown + END BREAK NOW, and tapping it re-expands here.
            if let onMinimize {
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
            }
        }
    }

    // MARK: - Lifecycle

    private func handleAppear() {
        UIApplication.shared.isIdleTimerDisabled = true
        timerOpacity = 0
        withAnimation(.easeInOut(duration: 0.6)) { timerOpacity = 1.0 }
        // Re-sync in case we re-entered from a minimize after a background gap.
        store.syncOnForeground()
    }

    private func handleDisappear() {
        UIApplication.shared.isIdleTimerDisabled = false
        holdTickTimer?.invalidate()
        holdTickTimer = nil
        cooldownTimer?.invalidate()
        cooldownTimer = nil
    }

    // MARK: - Hold lifecycle

    private func startHold() {
        guard store.isActive, quitStage == .none else { return }
        holdStartedAt = Date()

        holdTickTimer?.invalidate()
        holdTickTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { _ in
            Task { @MainActor in
                guard let startedAt = holdStartedAt else { return }
                let elapsed = Date().timeIntervalSince(startedAt)
                let progress = min(1.0, elapsed / Self.holdDurationSeconds)
                holdProgress = progress

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
        HapticsService.shared.warning()
        withAnimation(.easeOut(duration: 0.2)) { holdProgress = 0 }
        withAnimation(.easeOut(duration: 0.25)) { quitStage = .firstConfirm }
        AnalyticsService.shared.track("Session Quit Prompt Shown", properties: [
            "duration_minutes": store.durationMinutes,
        ])
    }

    // MARK: - Quit gate

    private func dismissQuit(reconsideredAtStage stage: Int) {
        HapticsService.shared.light()
        withAnimation(.easeOut(duration: 0.25)) { quitStage = .none }
        AnalyticsService.shared.track("Session Quit Reconsidered", properties: [
            "duration_minutes": store.durationMinutes,
            "stage": stage,
        ])
    }

    private func beginCooldown() {
        cooldownRemaining = Self.cooldownSeconds
        withAnimation(.easeOut(duration: 0.25)) { quitStage = .cooldown }
        HapticsService.shared.warning()
        AnalyticsService.shared.track("Session Quit Cooldown Started", properties: [
            "duration_minutes": store.durationMinutes,
        ])
        cooldownTimer?.invalidate()
        cooldownTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            Task { @MainActor in
                guard quitStage == .cooldown, cooldownRemaining > 0 else { return }
                cooldownRemaining -= 1
                if cooldownRemaining <= 0 {
                    HapticsService.shared.light()
                    cooldownTimer?.invalidate()
                    cooldownTimer = nil
                }
            }
        }
    }

    private func dismissCooldown() {
        cooldownTimer?.invalidate()
        cooldownTimer = nil
        HapticsService.shared.light()
        withAnimation(.easeOut(duration: 0.25)) { quitStage = .none }
        AnalyticsService.shared.track("Session Quit Reconsidered", properties: [
            "duration_minutes": store.durationMinutes,
            "stage": 3,
        ])
    }

    private func confirmQuit() {
        cooldownTimer?.invalidate()
        cooldownTimer = nil
        HapticsService.shared.rigid()
        quitStage = .none
        store.endEarly()
    }
}
