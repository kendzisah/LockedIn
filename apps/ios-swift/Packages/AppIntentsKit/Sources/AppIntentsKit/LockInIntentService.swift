//
//  LockInIntentService.swift
//  AppIntentsKit
//
//  Protocol the AppIntentsKit intents (Agent 4) dispatch through to drive
//  the main app's session machinery. Declared here so both the package
//  AND the main app target reference the same symbol — the main app
//  registers a concrete `LockInIntentServiceImpl` on the locator at boot,
//  intents call into the locator from their `perform()`.
//
//  Concrete implementation + the four `AppIntent` types (Start / End /
//  QueryStreak / QueryTodayFocus) are owned by Agent 4. This file ships
//  the protocol + service locator only.
//

import Foundation

/// Bridges App Intents into the main app's `SessionEngine` and friends.
/// Implemented in the LockedIn app target (Agent 4).
///
/// Methods marked `@MainActor` mutate session state; the read-only
/// `currentStreak()` / `todayFocusMinutes()` accessors read the App
/// Group snapshot and are safe to call from any actor.
public protocol LockInIntentService: Sendable {
    /// Start a lock-in session of the requested length. May open the app
    /// if Family Controls authorization is missing.
    @MainActor func startSession(durationMinutes: Int) async throws

    /// End the currently-running session. No-ops if no session is active.
    @MainActor func endActiveSession() async throws

    /// Read the current consecutive-day streak from the App Group widget
    /// snapshot. Safe to call without opening the app.
    func currentStreak() -> Int

    /// Read today's focused minutes from the App Group widget snapshot.
    func todayFocusMinutes() -> Int

    /// `true` if the user has granted Family Controls authorization.
    /// Intents check this before attempting to start a session and fall
    /// back to opening the app to surface an authorization prompt.
    var familyControlsAuthorized: Bool { get }
}

/// Process-wide service locator for `LockInIntentService`. The main app
/// sets `LockInIntentServiceLocator.shared = LockInIntentServiceImpl()` at
/// boot; intents read it from their `perform()`.
///
/// `nonisolated(unsafe)` is intentional — only the main app writes (once,
/// at boot) and intents are entered through `@MainActor` boundaries.
public enum LockInIntentServiceLocator {
    nonisolated(unsafe) public static var shared: LockInIntentService?
}
