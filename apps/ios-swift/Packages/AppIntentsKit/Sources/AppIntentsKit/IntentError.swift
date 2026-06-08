//
//  IntentError.swift
//  AppIntentsKit
//
//  Errors thrown by the four LockedIn `AppIntent` types. Conforming to
//  `CustomLocalizedStringResourceConvertible` lets Siri / Shortcuts surface
//  a user-readable failure dialog instead of the generic "Something went
//  wrong" fallback.
//

import Foundation

/// Errors thrown by LockedIn App Intents. Each case maps to a concrete
/// user-facing dialog that Shortcuts / Siri can read aloud.
public enum IntentError: Error, CustomLocalizedStringResourceConvertible {
    /// `LockInIntentServiceLocator.shared` is nil — the main app hasn't
    /// booted, so we can't reach `SessionEngine` / `LockModeService`.
    case serviceUnavailable

    public var localizedStringResource: LocalizedStringResource {
        switch self {
        case .serviceUnavailable:
            return "LockedIn isn't running. Open the app first."
        }
    }
}
