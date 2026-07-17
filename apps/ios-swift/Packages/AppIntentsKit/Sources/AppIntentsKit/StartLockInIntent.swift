//
//  StartLockInIntent.swift
//  AppIntentsKit
//
//  Siri / Shortcuts / interactive-widget entry point for starting a focus
//  session. Dispatches through `LockInIntentServiceLocator.shared` so the
//  intent stays ignorant of the main app's SwiftUI graph — required because
//  Shortcuts can invoke this intent even when the app isn't foregrounded.
//
//  Gate order (all cross-process, via `LockInAppGroupGate`):
//   1. Subscription — starting sessions is a Pro feature. Missing mirror
//      key reads as NOT subscribed (fail-closed).
//   2. Active session — refuse instead of silently overwriting the running
//      session's persisted block / re-arming its monitor.
//   3. Family Controls pre-check (app process only, via the service) — we
//      bail before `startSession` so an authorization prompt is never
//      triggered from a context that can't display it (Shortcuts run sheet).
//
//  Execution context: the app process (Siri / Shortcuts) — the locator is
//  registered at boot and the start goes straight through
//  `LockInIntentService.startSession`. The QuickStart widget does NOT
//  perform this intent: an intent run in the widget-extension process can
//  neither reach the session machinery (locator nil) nor foreground the
//  app (`ForegroundContinuableIntent` is unavailable in app extensions),
//  so the widget uses a `widgetURL` deep link handled by
//  `RootView.onOpenURL` instead. The locator-nil branch below survives as
//  a defensive fallback for any future extension context: it parks the
//  request in the App Group (`writePendingStart`), which `RootView`
//  consumes on `.active` and re-runs every gate in-process.
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
    /// session UI is the expected affordance. (Ignored when the intent runs
    /// from a widget — that path uses `ForegroundContinuableIntent` instead.)
    public static var openAppWhenRun: Bool = true

    /// Minimum session length startable from Siri / Shortcuts / widgets.
    /// Matches the product's shortest meaningful lock-in; sub-15-minute
    /// dictation fumbles ("lock in for 1 minute") round UP to this floor
    /// rather than starting throwaway sessions that pollute stats.
    public static let minimumMinutes = 15

    /// 25-minute default is the canonical Pomodoro window and the in-app
    /// default for the duration picker. We expose `Measurement<UnitDuration>`
    /// so Siri can parse "30 minutes", "1 hour", etc. without us writing a
    /// unit-resolution layer.
    @Parameter(title: "Duration", description: "How long to lock in for.")
    public var duration: Measurement<UnitDuration>?

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        // Default to the Pomodoro 25-minute window when the parameter is
        // omitted (Siri "lock me in" with no duration), then clamp to the
        // 15-minute product floor.
        let resolvedDuration = duration ?? Measurement(value: 25, unit: UnitDuration.minutes)
        let minutes = max(
            Self.minimumMinutes,
            Int(resolvedDuration.converted(to: .minutes).value.rounded())
        )

        // Gate 1 — subscription. Read from the App Group mirror so it works
        // in BOTH the app and widget processes. Fail-closed: a missing
        // mirror (fresh install, app never booted) refuses the start.
        guard LockInAppGroupGate.isSubscribed else {
            return .result(
                dialog: "LockedIn Pro is required — open LockedIn to subscribe."
            )
        }

        // Gate 2 — active session. Starting on top of a live session would
        // overwrite its persisted block and re-arm the monitor mid-run.
        if LockInAppGroupGate.isSessionActive(now: Date()) {
            return .result(dialog: "You're already locked in.")
        }

        guard let service = LockInIntentServiceLocator.shared else {
            // Extension process (defensive — the widget no longer performs
            // this intent; it deep-links via `widgetURL`). The session
            // machinery is unreachable here, and nothing in an extension can
            // foreground the app (`needsToContinueInForegroundError` is
            // treated as a plain failure). Park the request so the pending
            // start still fires if the user opens the app promptly —
            // `RootView` consumes it on `.active` and re-runs every gate
            // in-process (this handoff is NOT an authorization).
            LockInAppGroupGate.writePendingStart(minutes: minutes)
            if #available(iOS 16.4, *) {
                throw needsToContinueInForegroundError(
                    IntentDialog("Open LockedIn to start your session.")
                )
            }
            throw IntentError.serviceUnavailable
        }

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

/// Foreground continuation is only used on the widget-process path (locator
/// nil) — see `perform()`. Availability-gated because the protocol is
/// iOS 16.4+ while the package floor is 16.0; the call site is `#available`
/// guarded to match.
///
/// NOTE: the protocol is `@available(iOSApplicationExtension, unavailable)`.
/// That compiles here because this package is linked by the MAIN APP as well
/// as the widget extension, so Xcode builds it WITHOUT
/// `APPLICATION_EXTENSION_API_ONLY`. If AppIntentsKit ever becomes
/// extension-only, this conformance must move behind a different mechanism.
@available(iOS 16.4, *)
extension StartLockInIntent: ForegroundContinuableIntent {}
