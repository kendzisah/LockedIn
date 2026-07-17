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

    /// Re-apply the shield for a precise number of seconds. Used when resuming
    /// from a Pause Protocol break: the original DeviceActivity schedule was
    /// torn down on pause (which un-shields at the *original* end), so resume
    /// re-arms it for the remaining time. Seconds-accurate to avoid drift.
    @discardableResult
    public func beginSession(durationSeconds: Int) async -> Bool {
        let auth = await ScreenTimeModule.shared.requestAuthorization()
        if auth != .approved { return false }

        let secs = max(1, durationSeconds)
        let now = Date()
        let endTimestampMs = (now.timeIntervalSince1970 + TimeInterval(secs)) * 1000.0
        let active = ActiveExecutionBlock(
            startTimestamp: now.timeIntervalSince1970 * 1000.0,
            endTimestamp: endTimestampMs,
            durationMinutes: max(1, Int(ceil(Double(secs) / 60.0)))
        )
        Defaults.setCodable(active, SessionState.activeExecutionBlockKey, scope: .appGroup)
        Defaults.setCodable(active, SessionState.activeExecutionBlockKey, scope: .standard)

        let scheduled = ScreenTimeModule.shared.beginSession(durationSeconds: secs)
        if !scheduled {
            ScreenTimeModule.shared.shieldApps()
        }
        return scheduled
    }

    /// Resume focus after an in-app break end: re-apply the shield and re-arm
    /// the manual monitor + fail-safe timestamp for the remaining seconds
    /// while PRESERVING the persisted block's original metadata. The old path
    /// (`beginSession(durationSeconds:)`) persisted a fresh remaining-only
    /// block, so a later kill+expire credited only the post-break remainder —
    /// dropping the pre-break focus a surviving process would have credited in
    /// full. Here the block keeps its `startTimestamp`/`durationMinutes` (the
    /// ORIGINAL session, as `beginBreak` maintained) and only `endTimestamp`
    /// moves to the actual resume target: the fixed post-break end on an auto
    /// break-end, or the pulled-back end after `endBreakEarly` (leaving the
    /// old fixed end in place would pad the unused break tail back onto a
    /// kill-resume).
    ///
    /// Defensive fallback: if no block survived (torn down elsewhere), persist
    /// a remaining-time block so the cold-start resume paths still work.
    @discardableResult
    public func resumeSessionAfterBreak(remainingSeconds: Int) async -> Bool {
        let auth = await ScreenTimeModule.shared.requestAuthorization()
        if auth != .approved { return false }

        let secs = max(1, remainingSeconds)
        let now = Date()
        let endTimestampMs = (now.timeIntervalSince1970 + TimeInterval(secs)) * 1000.0
        let active: ActiveExecutionBlock
        if let block = loadActiveExecutionBlock() {
            active = ActiveExecutionBlock(
                startTimestamp: block.startTimestamp,
                endTimestamp: endTimestampMs,
                durationMinutes: block.durationMinutes
            )
        } else {
            active = ActiveExecutionBlock(
                startTimestamp: now.timeIntervalSince1970 * 1000.0,
                endTimestamp: endTimestampMs,
                durationMinutes: max(1, Int(ceil(Double(secs) / 60.0)))
            )
        }
        Defaults.setCodable(active, SessionState.activeExecutionBlockKey, scope: .appGroup)
        Defaults.setCodable(active, SessionState.activeExecutionBlockKey, scope: .standard)

        let scheduled = ScreenTimeModule.shared.beginSession(durationSeconds: secs)
        if !scheduled {
            ScreenTimeModule.shared.shieldApps()
        }
        return scheduled
    }

    // MARK: - Pause Protocol (timed break)

    /// Begin a Pause-Protocol break. Unlike `endSession()`, this lifts the
    /// shield WITHOUT tearing the session down:
    ///
    /// - The persisted `activeExecutionBlock` + hardcore flag stay intact — an
    ///   app kill mid-break must still resume (or credit) the session. The
    ///   block's `endTimestamp` is REWRITTEN to `sessionEnd` so the cold-start
    ///   paths agree with the engine's fixed post-break end.
    /// - An `ActiveBreakState` snapshot is persisted (both scopes, mirroring
    ///   the block's dual-write) so the resume path can tell "mid-break" from
    ///   "mid-session".
    /// - A future-start DeviceActivity monitor is registered whose
    ///   `intervalDidStart` re-applies the shield AT `breakEnd`, app dead or
    ///   alive — the OS, not the app, ends the unshielded window.
    ///
    /// `sessionEnd` is the FIXED wall-clock end computed once at break start
    /// (`breakEnd + frozenRemaining`, clamped to a scheduled window's hard
    /// end). While the break runs, the App Group `sessionEndTimestamp` holds
    /// this value (contract C3).
    ///
    /// The resume monitor is SKIPPED when `breakEnd >= sessionEnd`: that only
    /// happens for a promoted scheduled session whose break runs to/past the
    /// clamped window end — there is no post-break focus left to re-shield,
    /// and the scheduled monitor owns the window-end clear (a lingering future
    /// manual timestamp would make it defer and strand the shield).
    ///
    /// Returns `true` when the resume monitor was accepted by the OS.
    @discardableResult
    public func beginBreak(
        breakEnd: Date,
        sessionEnd: Date,
        durationMinutes: Int,
        hardcore: Bool,
        scheduledOccurrenceId: String?
    ) -> Bool {
        // Lift the shield + stop the pre-break session monitor (it targets the
        // pre-break end, which no longer exists). This also clears
        // `sessionEndTimestamp`; `scheduleBreakResume` rewrites it to the fixed
        // end below. Crucially it does NOT touch the block / hardcore / break
        // keys — that teardown is `endSession()`'s job, at real session end.
        ScreenTimeModule.shared.removeShield()

        // Rewrite the persisted manual block's end to the fixed post-break end
        // so cold-start resume + expired-credit see the real end. Duration is
        // preserved — the block still describes the ORIGINAL session. Promoted
        // scheduled sessions persist no manual block (the scheduled window is
        // their source of truth) — nothing to rewrite.
        if let block = loadActiveExecutionBlock() {
            let rewritten = ActiveExecutionBlock(
                startTimestamp: block.startTimestamp,
                endTimestamp: sessionEnd.timeIntervalSince1970 * 1000.0,
                durationMinutes: block.durationMinutes
            )
            Defaults.setCodable(rewritten, SessionState.activeExecutionBlockKey, scope: .appGroup)
            Defaults.setCodable(rewritten, SessionState.activeExecutionBlockKey, scope: .standard)
        }

        let breakState = ActiveBreakState(
            breakEndsAtMs: breakEnd.timeIntervalSince1970 * 1000.0,
            sessionEndsAtMs: sessionEnd.timeIntervalSince1970 * 1000.0,
            durationMinutes: durationMinutes,
            hardcore: hardcore,
            scheduledOccurrenceId: scheduledOccurrenceId
        )
        Defaults.setCodable(breakState, SessionState.activeBreakStateKey, scope: .appGroup)
        Defaults.setCodable(breakState, SessionState.activeBreakStateKey, scope: .standard)

        guard breakEnd < sessionEnd else { return false }
        return ScreenTimeModule.shared.scheduleBreakResume(
            breakEnd: breakEnd,
            sessionEnd: sessionEnd
        )
    }

    /// Read the persisted active break (if any). Prefers App Group suite,
    /// falls back to standard defaults — same precedence as the block.
    public func loadActiveBreakState() -> ActiveBreakState? {
        if let appGroup = Defaults.codable(ActiveBreakState.self, SessionState.activeBreakStateKey, scope: .appGroup) {
            return appGroup
        }
        return Defaults.codable(ActiveBreakState.self, SessionState.activeBreakStateKey, scope: .standard)
    }

    /// Drop the persisted break snapshot (both scopes). Called on every
    /// in-app break exit and by the resume path once it has consumed (or
    /// invalidated) the snapshot.
    public func clearActiveBreakState() {
        Defaults.remove(SessionState.activeBreakStateKey, scope: .appGroup)
        Defaults.remove(SessionState.activeBreakStateKey, scope: .standard)
    }

    /// End the current session — un-shield apps, cancel the DAM schedule,
    /// and clear the App Group keys the extension reads. Also drops any
    /// persisted break snapshot: a session can end mid-break (hold-to-end, a
    /// scheduled window closing) and a surviving break key would make the next
    /// launch resurrect a dead session.
    public func endSession() {
        ScreenTimeModule.shared.removeShield()
        Defaults.remove(SessionState.activeExecutionBlockKey, scope: .appGroup)
        Defaults.remove(SessionState.activeExecutionBlockKey, scope: .standard)
        Defaults.remove(SessionState.activeBreakStateKey, scope: .appGroup)
        Defaults.remove(SessionState.activeBreakStateKey, scope: .standard)
        Defaults.remove(SessionState.activeBlockHardcoreKey)
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
