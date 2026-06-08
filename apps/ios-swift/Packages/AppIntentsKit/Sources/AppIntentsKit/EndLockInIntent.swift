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
