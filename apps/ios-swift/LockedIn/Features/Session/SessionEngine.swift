//
//  SessionEngine.swift
//  LockedIn — Worker W11 (Session / Lock-In feature)
//
//  Pure logic + timer driver for an active Lock-In session. Mirrors the
//  RN `ExecutionBlockScreen` timer logic but as a UI-agnostic
//  `@Observable` so the screen view can simply bind to `remainingSeconds`
//  and `isComplete`.
//
//  Timing is wall-clock based (matches RN): the engine stores
//  `endTimestamp` and the tick recomputes remaining = end − now. This
//  prevents drift when the app backgrounds or the system goes to sleep.
//
//  Idle-timer disable (`UIApplication.shared.isIdleTimerDisabled`) is
//  driven from `ExecutionBlockScreen.onAppear/onDisappear`, NOT here —
//  the engine has no opinion on screen presentation.
//

import Foundation
import Observation

// MARK: - Phase text (mirror engine/SessionEngine.getPhaseText)

public enum SessionPhaseText {
    /// Returns the phase text for the active ExecutionBlock. Mirrors the
    /// RN file `ExecutionBlockScreen.tsx` `PHASE_TEXTS` table (NOT the
    /// `engine/SessionEngine.ts` table — the on-screen text uses the
    /// shorter array in `ExecutionBlockScreen.tsx`).
    public static func text(elapsedSeconds: Int, totalSeconds: Int) -> String {
        let pct: Double = totalSeconds > 0 ? Double(elapsedSeconds) / Double(totalSeconds) : 0
        switch pct {
        case ..<0.2: return "You are now Locked In."
        case ..<0.4: return "Stay Locked In."
        case ..<0.6: return "Execute."
        case ..<0.8: return "No distractions."
        default:     return "Build the standard."
        }
    }
}

// MARK: - Engine

/// Owns the timer / state machine for a single active execution block.
/// One instance per session — recreate when starting a new block.
@MainActor
@Observable
public final class SessionEngine {
    public enum Status: Equatable {
        case idle
        case running
        case completedNaturally       // hit zero
        case endedEarly(actualMinutes: Int) // hold-to-unlock
    }

    public private(set) var status: Status = .idle
    public private(set) var remainingSeconds: Int
    public let totalSeconds: Int
    public let durationMinutes: Int
    public let endTimestamp: Date

    // Internal plumbing — not UI state, so excluded from observation tracking.
    // `Timer` is thread-safe to invalidate from any context; `nonisolated(unsafe)`
    // lets `deinit` (nonisolated by default) clean it up without a main-actor hop.
    @ObservationIgnored private nonisolated(unsafe) var timer: Timer?
    private let onComplete: (Status) -> Void

    /// - Parameters:
    ///   - durationMinutes: requested block length.
    ///   - resumeEndTimestamp: when non-nil, treat this as a resume from a
    ///     persisted active block (matches `resumeEndTimestamp` route
    ///     param). Otherwise compute `now + duration`.
    ///   - onComplete: fired when the engine resolves (natural finish or
    ///     hold-to-unlock). Called on the main actor.
    public init(
        durationMinutes: Int,
        resumeEndTimestamp: Date? = nil,
        onComplete: @escaping (Status) -> Void
    ) {
        self.durationMinutes = durationMinutes
        self.totalSeconds = durationMinutes * 60
        let end = resumeEndTimestamp ?? Date().addingTimeInterval(TimeInterval(totalSeconds))
        self.endTimestamp = end
        self.remainingSeconds = max(0, Int(ceil(end.timeIntervalSinceNow)))
        self.onComplete = onComplete
    }

    deinit {
        timer?.invalidate()
    }

    // MARK: - Lifecycle

    /// Begin ticking. Idempotent.
    public func start() {
        guard status == .idle else { return }
        status = .running
        scheduleTick()
    }

    /// Snapshot the current state without ticking — used by views that need
    /// to sync after AppState foreground transitions.
    public func sync(now: Date = Date()) {
        let r = max(0, Int(ceil(endTimestamp.timeIntervalSince(now))))
        remainingSeconds = r
        if r <= 0, status == .running {
            finishNaturally()
        }
    }

    /// Hold-to-unlock path. Computes the actual minutes the user ran for and
    /// transitions to `endedEarly`.
    public func endEarly(now: Date = Date()) {
        guard status == .running else { return }
        timer?.invalidate()
        timer = nil

        let elapsedSeconds = totalSeconds - max(0, Int(ceil(endTimestamp.timeIntervalSince(now))))
        let actualMinutes = max(1, Int(ceil(Double(elapsedSeconds) / 60.0)))
        status = .endedEarly(actualMinutes: actualMinutes)
        onComplete(status)
    }

    /// External cancel (e.g. forced sign-out / FULL_RESET). Stops ticking
    /// without firing `onComplete`.
    public func cancel() {
        timer?.invalidate()
        timer = nil
        status = .idle
    }

    // MARK: - Internals

    private func scheduleTick() {
        timer?.invalidate()
        // 250ms tick matches RN `setInterval(..., 250)`.
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.tick()
            }
        }
    }

    private func tick() {
        let now = Date()
        let r = max(0, Int(ceil(endTimestamp.timeIntervalSince(now))))
        remainingSeconds = r
        if r <= 0 {
            finishNaturally()
        }
    }

    private func finishNaturally() {
        timer?.invalidate()
        timer = nil
        status = .completedNaturally
        onComplete(status)
    }
}

// MARK: - Formatting helper

public enum SessionTimeFormatter {
    /// Mirrors `ExecutionBlockScreen.formatTime` — H:MM:SS when ≥ 1h,
    /// MM:SS otherwise.
    public static func format(seconds: Int) -> String {
        let s = max(0, seconds)
        let h = s / 3600
        let m = (s % 3600) / 60
        let sec = s % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, sec)
        } else {
            return String(format: "%d:%02d", m, sec)
        }
    }
}

// `CompletionCopy` is declared canonically by
// `Features/Home/Engine/CompletionCopy.swift`. The Session feature references
// it directly to avoid module-level redeclaration. `SessionCompleteScreen`
// callers below use `CompletionCopy.completionMessage(for: .executionBlock)`
// instead of the legacy `executionBlockMessage()` helper.
