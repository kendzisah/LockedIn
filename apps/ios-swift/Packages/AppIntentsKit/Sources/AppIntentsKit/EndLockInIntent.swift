//
//  EndLockInIntent.swift
//  AppIntentsKit
//
//  Pure side-effect intent that ends the running session. Used by Siri
//  ("end my lock-in"), Shortcuts automations, AND the "End early" button
//  in the Dynamic Island expanded view rendered by Agent 2.
//
//  `openAppWhenRun = false` because ending a session is a background-safe
//  operation (un-shield + extension cleanup) and we don't want to yank the
//  user out of whatever they were doing when the timer hits zero.
//

import AppIntents
import Foundation

@available(iOS 16.0, *)
public struct EndLockInIntent: AppIntent {
    public static var title: LocalizedStringResource = "End the current lock-in"
    public static var description = IntentDescription(
        "Stop the currently running focus session and unblock all apps."
    )

    /// Stay in the background — ending a session should feel like a remote
    /// kill switch, not a context grab.
    public static var openAppWhenRun: Bool = false

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let service = LockInIntentServiceLocator.shared else {
            throw IntentError.serviceUnavailable
        }

        try await service.endActiveSession()
        return .result(dialog: "Lock-in ended.")
    }
}

/// The Dynamic Island's "End early" `Button(intent:)` (iOS 17+ surface)
/// would otherwise perform this intent in the WIDGET-EXTENSION process,
/// where `LockInIntentServiceLocator.shared` is nil — the tap hits
/// `IntentError.serviceUnavailable`, Live Activity buttons surface no error
/// dialog, and the session keeps running while the end hook / hardcore
/// guard never execute. `LiveActivityIntent` (iOS 17+, matching the
/// button's own availability floor) tells the OS to run `perform()` in the
/// APP process instead, where the locator is registered at boot.
/// NEEDS a physical-device smoke test — Live Activity intent routing can't
/// be exercised in the simulator.
@available(iOS 17.0, *)
extension EndLockInIntent: LiveActivityIntent {}
