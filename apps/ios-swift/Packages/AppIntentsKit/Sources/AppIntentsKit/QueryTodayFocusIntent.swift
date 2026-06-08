//
//  QueryTodayFocusIntent.swift
//  AppIntentsKit
//
//  Read-only intent that returns today's accumulated focused minutes from
//  the App Group widget snapshot. Mirrors `QueryStreakIntent` — no app
//  foregrounding, no main-app singleton access, just the cross-process
//  cached value.
//

import AppIntents
import Foundation

@available(iOS 16.0, *)
public struct QueryTodayFocusIntent: AppIntent {
    public static var title: LocalizedStringResource = "Check today's focus time"
    public static var description = IntentDescription(
        "Returns the total minutes you've focused so far today."
    )

    public static var openAppWhenRun: Bool = false

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog {
        guard let service = LockInIntentServiceLocator.shared else {
            throw IntentError.serviceUnavailable
        }

        let minutes = service.todayFocusMinutes()
        return .result(
            value: minutes,
            dialog: "You've focused for \(minutes) minutes today."
        )
    }
}
