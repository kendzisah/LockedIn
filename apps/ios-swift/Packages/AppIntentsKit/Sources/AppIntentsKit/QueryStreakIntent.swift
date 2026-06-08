//
//  QueryStreakIntent.swift
//  AppIntentsKit
//
//  Read-only intent that returns the user's current consecutive-day streak
//  by reading the App Group snapshot. Does NOT open the app — the whole
//  point is "Hey Siri, what's my streak" without yanking the user into
//  the foreground.
//

import AppIntents
import Foundation

@available(iOS 16.0, *)
public struct QueryStreakIntent: AppIntent {
    public static var title: LocalizedStringResource = "Check current streak"
    public static var description = IntentDescription(
        "Returns the number of consecutive days you've completed a focus session."
    )

    /// Pure data read — no need to launch the SwiftUI graph.
    public static var openAppWhenRun: Bool = false

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog {
        guard let service = LockInIntentServiceLocator.shared else {
            throw IntentError.serviceUnavailable
        }

        let streak = service.currentStreak()
        let dayWord = streak == 1 ? "day" : "days"
        return .result(
            value: streak,
            dialog: "Your streak is \(streak) \(dayWord)."
        )
    }
}
