//
//  StartLockInIntent.swift
//  AppIntentsKit
//
//  Siri / Shortcuts entry point for starting a focus session. Dispatches
//  through `LockInIntentServiceLocator.shared` so the intent stays
//  ignorant of the main app's SwiftUI graph — required because Shortcuts
//  can invoke this intent even when the app isn't foregrounded.
//
//  `openAppWhenRun = true` so the user lands in LockedIn after invocation;
//  this is also a no-op safety net for the Family-Controls-not-authorized
//  case (we ask them to grant access from inside the app).
//

import AppIntents
import Foundation

@available(iOS 16.0, *)
public struct StartLockInIntent: AppIntent {
    public static var title: LocalizedStringResource = "Start a lock-in"
    public static var description = IntentDescription(
        "Begin a focus session that blocks distracting apps."
    )

    /// Bringing the app to the foreground is intentional — Family Controls
    /// authorization prompts and the shielded-app picker both require an
    /// active app session. Even in the happy path, surfacing the running
    /// session UI is the expected affordance.
    public static var openAppWhenRun: Bool = true

    /// 25-minute default is the canonical Pomodoro window and the in-app
    /// default for the duration picker. We expose `Measurement<UnitDuration>`
    /// so Siri can parse "30 minutes", "1 hour", etc. without us writing a
    /// unit-resolution layer.
    @Parameter(title: "Duration", description: "How long to lock in for.")
    public var duration: Measurement<UnitDuration>?

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let service = LockInIntentServiceLocator.shared else {
            throw IntentError.serviceUnavailable
        }

        // Clamp to ≥1 minute. Siri sometimes hands us 0.49-minute values
        // when the user fumbles the dictation; rounding + clamping avoids
        // an immediate "ended" race condition in `SessionEngine`.
        // Default to the Pomodoro 25-minute window when the parameter is
        // omitted (Siri "lock me in" with no duration).
        let resolvedDuration = duration ?? Measurement(value: 25, unit: UnitDuration.minutes)
        let minutes = max(1, Int(resolvedDuration.converted(to: .minutes).value.rounded()))

        if !service.familyControlsAuthorized {
            // `openAppWhenRun = true` already brings the app forward; the
            // app's onboarding / settings surface will guide the user to
            // grant Family Controls. We bail BEFORE calling `startSession`
            // so we don't trigger an authorization prompt from a context
            // that can't display it (Shortcuts run sheet).
            return .result(
                dialog: "Open LockedIn to enable Screen Time access first."
            )
        }

        try await service.startSession(durationMinutes: minutes)
        return .result(dialog: "Locked in for \(minutes) minutes.")
    }
}
