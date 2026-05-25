//
//  LockModeService.swift
//  LockedIn — Worker W11 (Session / Lock-In feature)
//
//  Native port of `apps/mobile/src/services/LockModeService.ts`. Thin wrapper
//  around `ScreenTimeModule` that:
//
//  - Requests Family Controls authorization (must happen before
//    `DeviceActivityCenter.startMonitoring`; cannot be skipped on iOS).
//  - Applies the Managed Settings shield AND schedules a Device Activity
//    Monitor interval so the extension un-shields if the main app is killed.
//  - Writes the lock-mode keys to the **App Group** `UserDefaults` suite so
//    the DAM extension reads the same data. Key set is authoritative —
//    matches `Shared/SharedScreenTimeConstants.swift` keys exactly:
//      - `com.lockedin.screentime.selection`
//      - `com.lockedin.screentime.sessionEndTimestamp`
//
//  Also mirrors the RN `@lockedin/active_execution_block` payload into the
//  **App Group** suite (key `@lockedin/active_execution_block`) so the
//  extension / future widgets can read the current session metadata. The RN
//  app stored this in AsyncStorage which is app-only; mirroring to the App
//  Group is the Swift-side preferred location (also still mirrored to
//  standard defaults for in-app HomeTab reads — Worker W3 may swap to App
//  Group later).
//

import Foundation
import UIKit

@MainActor
public final class LockModeService {

    public static let shared = LockModeService()
    private init() {}

    // MARK: - Authorization

    /// Authorization passthrough. Always call before `beginSession`.
    @discardableResult
    public func requestAuthorization() async -> ScreenTimeModule.AuthorizationState {
        await ScreenTimeModule.shared.requestAuthorization()
    }

    public var currentAuthorizationStatus: ScreenTimeModule.AuthorizationState {
        ScreenTimeModule.shared.getAuthorizationStatus()
    }

    // MARK: - App picker passthrough

    /// Present the SwiftUI `FamilyActivityPicker`. Returns selected count.
    @discardableResult
    public func showAppPicker() async -> Int {
        await ScreenTimeModule.shared.showAppPicker()
    }

    public func getSelectedAppCount() -> Int {
        ScreenTimeModule.shared.getSelectedAppCount()
    }

    // MARK: - Session lifecycle

    /// Begin a lock-in session. Returns `true` if the DeviceActivityMonitor
    /// schedule was accepted (preferred path). Returns `false` when the
    /// extension could not be scheduled — in that case the in-app shield is
    /// still applied as a fallback (mirrors the RN `shieldApps()` branch in
    /// `LockModeService.beginSession`).
    @discardableResult
    public func beginSession(durationMinutes: Int) async -> Bool {
        // Gate on Family Controls authorization. The RN flow uses an
        // onboarding step (ScreenTimePreFrame) to prompt; we attempt to
        // request here too, idempotently — if the user denied previously
        // this resolves to `.denied` and we fall through to no-op
        // (matching `LockModeService` returning early in RN when
        // `getScreenTime()` is unavailable).
        let auth = await ScreenTimeModule.shared.requestAuthorization()
        if auth != .approved {
            return false
        }

        let durationSeconds = max(1, durationMinutes * 60)

        // Write the active execution block snapshot into the App Group
        // suite. The DAM extension and (eventually) widgets read from this
        // key. Standard UserDefaults also gets the same payload so the
        // HomeTab resume sweep keeps working without an entitlement check.
        let now = Date()
        let endTimestampMs = (now.timeIntervalSince1970 + TimeInterval(durationSeconds)) * 1000.0
        let active = ActiveExecutionBlock(
            startTimestamp: now.timeIntervalSince1970 * 1000.0,
            endTimestamp: endTimestampMs,
            durationMinutes: durationMinutes
        )
        Defaults.setCodable(active, SessionState.activeExecutionBlockKey, scope: .appGroup)
        Defaults.setCodable(active, SessionState.activeExecutionBlockKey, scope: .standard)

        // Hand off to the ScreenTimeModule. This both applies the shield
        // (immediate effect) AND schedules the DAM activity (extension
        // un-shields at intervalDidEnd).
        let scheduled = ScreenTimeModule.shared.beginSession(durationSeconds: durationSeconds)
        if !scheduled {
            // Schedule failed → fall back to in-app shield only.
            ScreenTimeModule.shared.shieldApps()
        }
        return scheduled
    }

    /// End the current session — un-shield apps, cancel the DAM schedule,
    /// and clear the App Group keys the extension reads.
    public func endSession() {
        ScreenTimeModule.shared.removeShield()
        Defaults.remove(SessionState.activeExecutionBlockKey, scope: .appGroup)
        Defaults.remove(SessionState.activeExecutionBlockKey, scope: .standard)
    }

    /// `true` while the main process is shielding (DAM extension may still
    /// shield on its own after a kill; check via Managed Settings if needed).
    public func isActive() -> Bool {
        ScreenTimeModule.shared.isShielding()
    }

    // MARK: - Active session resume helpers (for HomeTab / Worker W3)

    /// Read the persisted active execution block (if any). Prefers App
    /// Group suite, falls back to standard defaults.
    public func loadActiveExecutionBlock() -> ActiveExecutionBlock? {
        if let appGroup = Defaults.codable(ActiveExecutionBlock.self, SessionState.activeExecutionBlockKey, scope: .appGroup) {
            return appGroup
        }
        return Defaults.codable(ActiveExecutionBlock.self, SessionState.activeExecutionBlockKey, scope: .standard)
    }
}
