import UIKit
import FamilyControls
import ManagedSettings
import DeviceActivity
import SwiftUI

/// Native Swift port of the Expo `ScreenTimeModule`. Exposes a plain Swift
/// API (no Expo bridges) used by the Session/Lock-In feature (Worker W11).
///
/// Lifecycle: instantiate once at app launch and reuse. `loadSelection()` is
/// called automatically by `init`.
public final class ScreenTimeModule: @unchecked Sendable {

    public static let shared = ScreenTimeModule()

    public enum AuthorizationState: String {
        case notDetermined = "not_determined"
        case approved
        case denied
    }

    private var _store: ManagedSettingsStore?
    private var selection = FamilyActivitySelection()
    private var shielding = false
    private var authorized = false

    private var store: ManagedSettingsStore? {
        if let s = _store { return s }
        var created: ManagedSettingsStore?
        do {
            try ObjCExceptionCatcher.execute {
                if #available(iOS 16.0, *) {
                    created = ManagedSettingsStore(named: .init(SharedScreenTime.managedSettingsStoreName))
                } else {
                    created = ManagedSettingsStore()
                }
            }
        } catch {
            Task { @MainActor in
                AnalyticsService.shared.captureException(error, properties: [
                    "context": "screen_time_store_init",
                    "ios_version": UIDevice.current.systemVersion,
                ])
                AnalyticsService.shared.track("screen_time_store_init_failed", properties: [
                    "ios_version": UIDevice.current.systemVersion,
                ])
            }
            return nil
        }
        if let c = created {
            _store = c
            return c
        }
        return nil
    }

    public init() {
        loadSelection()
    }

    // MARK: - Authorization

    /// Request Family Controls authorization. Returns the resolved state.
    @discardableResult
    public func requestAuthorization() async -> AuthorizationState {
        guard #available(iOS 16.0, *) else { return .denied }

        return await Task { @MainActor in
            var currentStatus: FamilyControls.AuthorizationStatus = .notDetermined
            var checkSuccess = false

            do {
                try ObjCExceptionCatcher.execute {
                    currentStatus = AuthorizationCenter.shared.authorizationStatus
                    checkSuccess = true
                }
            } catch {
                AnalyticsService.shared.captureException(error, properties: [
                    "context": "family_controls_auth_check",
                    "ios_version": UIDevice.current.systemVersion,
                ])
                AnalyticsService.shared.track("family_controls_auth_check_failed", properties: [
                    "ios_version": UIDevice.current.systemVersion,
                ])
                return AuthorizationState.denied
            }

            if !checkSuccess { return .denied }

            if currentStatus == .approved {
                self.authorized = true
                return .approved
            }

            if currentStatus == .denied {
                return .denied
            }

            do {
                try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                self.authorized = true
                return .approved
            } catch {
                return .denied
            }
        }.value
    }

    /// Current authorization status (no prompt).
    public func getAuthorizationStatus() -> AuthorizationState {
        guard #available(iOS 16.0, *) else { return .notDetermined }
        var status: AuthorizationState = .notDetermined
        do {
            try ObjCExceptionCatcher.execute {
                switch AuthorizationCenter.shared.authorizationStatus {
                case .notDetermined: status = .notDetermined
                case .approved:
                    self.authorized = true
                    status = .approved
                case .denied: status = .denied
                @unknown default: status = .notDetermined
                }
            }
        } catch {
            let iosVersion = UIDevice.current.systemVersion
            Task { @MainActor in
                AnalyticsService.shared.captureException(error, properties: [
                    "context": "family_controls_status_check",
                    "ios_version": iosVersion,
                ])
                AnalyticsService.shared.track("family_controls_status_check_failed", properties: [
                    "ios_version": iosVersion,
                ])
            }
        }
        return status
    }

    // MARK: - App Picker

    /// Present the SwiftUI `FamilyActivityPicker` modally. Returns the
    /// number of selected applications + categories.
    @discardableResult
    @MainActor
    public func showAppPicker() async -> Int {
        // Ensure authorization before presenting the picker.
        if !self.authorized, #available(iOS 16.0, *) {
            var status: FamilyControls.AuthorizationStatus = .notDetermined
            do {
                try ObjCExceptionCatcher.execute {
                    status = AuthorizationCenter.shared.authorizationStatus
                }
            } catch {
                AnalyticsService.shared.captureException(error, properties: [
                    "context": "family_controls_picker_auth_check",
                    "ios_version": UIDevice.current.systemVersion,
                ])
                AnalyticsService.shared.track("family_controls_picker_auth_check_failed", properties: [
                    "ios_version": UIDevice.current.systemVersion,
                ])
                return 0
            }

            if status == .approved {
                self.authorized = true
            } else if status == .denied {
                return 0
            } else {
                do {
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                    self.authorized = true
                } catch { return 0 }
            }
        }

        guard self.authorized else { return 0 }

        return await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [self] in
                let model = AppPickerModel(selection: self.selection)
                var resolved = false

                model.onComplete = { [weak self] newSelection in
                    guard !resolved else { return }
                    resolved = true
                    self?.selection = newSelection
                    self?.saveSelection()
                    continuation.resume(returning: newSelection.applicationTokens.count)
                }

                let sheet = AppPickerSheet(model: model)
                let host = UIHostingController(rootView: sheet)
                host.modalPresentationStyle = .pageSheet

                if let pc = host.sheetPresentationController {
                    pc.detents = [.large()]
                    pc.prefersGrabberVisible = true
                }

                guard let root = self.topViewController() else {
                    resolved = true
                    continuation.resume(returning: self.selection.applicationTokens.count)
                    return
                }

                root.present(host, animated: true)
            }
        }
    }

    // MARK: - Shield Control
    //
    // `beginSession` applies the shield immediately (so apps are blocked the
    // moment the user taps Lock In) AND schedules a DeviceActivityMonitor
    // interval ending at `now + durationSeconds`. The extension's
    // intervalDidEnd callback un-shields via the same named ManagedSettingsStore
    // even if iOS has killed the main app process.
    //
    // The app layer also removes the shield on normal completion / hold-to-unlock
    // (via `endSession`), so both a normal end and a background-killed end are
    // covered.

    /// Start a Lock-In session of `durationSeconds`. Applies the shield and
    /// schedules the DAM extension to clean up at session end.
    @discardableResult
    public func beginSession(durationSeconds: Int) -> Bool {
        self.applyShield()

        let endDate = Date().addingTimeInterval(TimeInterval(durationSeconds))
        // Fail-safe floor: the extension's manual-end guard reads this
        // timestamp with a 2-minute slack (its own boundary-aligned callback
        // can arrive slightly early). A POST-BREAK remainder can be
        // arbitrarily short — resuming a session with <2 min left writes a
        // timestamp inside that slack, and the stale stop callback fired by
        // stopping the break-resume monitor (below, inside startMonitoring's
        // stop-then-start) would read the fresh session as "own boundary" and
        // wipe the just-re-applied shield + timestamp. Floor the WRITTEN
        // fail-safe well past the slack (the margin also absorbs the stale
        // callback's delivery latency); the engine still ends the session
        // (and un-shields) at the REAL end — only the cross-process "a
        // manual session owns the shield" signal is padded, mirroring the
        // ≥16-min monitor clamp's overshoot-by-design for short sessions.
        let failSafeFloorSeconds: TimeInterval = 300
        let failSafeEnd = max(endDate, Date().addingTimeInterval(failSafeFloorSeconds))
        SharedScreenTime.sharedDefaults()?.set(
            failSafeEnd.timeIntervalSince1970 * 1000,
            forKey: SharedScreenTime.Keys.sessionEndTimestamp
        )

        guard #available(iOS 16.0, *) else {
            self.shielding = true
            return true
        }

        var scheduleSuccess = false
        var monitorStartError: Error?
        do {
            try ObjCExceptionCatcher.execute {
                let startComponents = Calendar.current.dateComponents([.hour, .minute, .second], from: Date())
                // DeviceActivity rejects monitoring intervals shorter than 15
                // minutes (MonitoringError Code 2: "The activity's schedule is
                // too short"). Clamp the OS backstop window to ≥16 minutes —
                // the app still un-shields at the REAL end time via
                // `removeShield()` (which also stops this monitor), and the
                // extension's fail-safe reads `sessionEndTimestamp`. The clamp
                // only changes the killed-app fail-safe for short sessions:
                // shield clears at ~16 min instead of never.
                let minimumMonitorInterval: TimeInterval = 16 * 60
                let monitorEnd = max(endDate, Date().addingTimeInterval(minimumMonitorInterval))
                let endComponents = Calendar.current.dateComponents([.hour, .minute, .second], from: monitorEnd)
                let schedule = DeviceActivitySchedule(
                    intervalStart: startComponents,
                    intervalEnd: endComponents,
                    repeats: false
                )
                let center = DeviceActivityCenter()
                center.stopMonitoring([DeviceActivityName(SharedScreenTime.activityName)])
                do {
                    try center.startMonitoring(
                        DeviceActivityName(SharedScreenTime.activityName),
                        during: schedule
                    )
                    scheduleSuccess = true
                } catch {
                    scheduleSuccess = false
                    monitorStartError = error
                }
            }
        } catch {
            scheduleSuccess = false
            monitorStartError = error
        }

        if !scheduleSuccess {
            let iosVersion = UIDevice.current.systemVersion
            let durationSec = durationSeconds
            let capturedError = monitorStartError
            Task { @MainActor in
                if let err = capturedError {
                    AnalyticsService.shared.captureException(err, properties: [
                        "context": "device_activity_monitor_start",
                        "ios_version": iosVersion,
                        "duration_seconds": durationSec,
                    ])
                }
                AnalyticsService.shared.track("device_activity_monitor_start_failed", properties: [
                    "ios_version": iosVersion,
                    "duration_seconds": durationSec,
                ])
            }
        }

        self.shielding = true
        return scheduleSuccess
    }

    /// Legacy entry point. Prefer `beginSession(durationSeconds:)`.
    public func shieldApps() {
        self.applyShield()
        self.shielding = true
    }

    // MARK: - Break auto-reblock (Pause Protocol)

    /// Register the break-resume monitor: a FUTURE-START, non-repeating
    /// DeviceActivity interval REUSING the manual `"LockedInSession"` activity
    /// name, whose `intervalDidStart` fires in the DAM extension at `breakEnd`
    /// and re-applies the shield — even if the app is backgrounded or killed.
    /// This is what turns a break into a bounded pause instead of an
    /// indefinite unshielded one.
    ///
    /// - `intervalEnd` = max(`sessionEnd`, `breakEnd` + 16 min): keeps the OS
    ///   un-shield backstop at the session's REAL fixed end while honoring
    ///   DeviceActivity's ~15-minute minimum interval length (same clamp as
    ///   `beginSession`; short remainders over-run the backstop by design —
    ///   the app's own end path un-shields at the real end).
    /// - Writes `sessionEndTimestamp` = `sessionEnd`, the FIXED post-break end
    ///   (contract C3): a future value tells the extension a manual session
    ///   still owns the shield, so a stale `intervalDidEnd` from the stopped
    ///   pre-break monitor can't wipe the state mid-break.
    /// - Start components are FULLY specified (y/m/d/h/m/s): hour/minute-only
    ///   components match the *next wall-clock occurrence*, which for a
    ///   future-start interval is ambiguous — absolute components pin the
    ///   start to the exact break-end instant.
    @discardableResult
    public func scheduleBreakResume(breakEnd: Date, sessionEnd: Date) -> Bool {
        SharedScreenTime.sharedDefaults()?.set(
            sessionEnd.timeIntervalSince1970 * 1000,
            forKey: SharedScreenTime.Keys.sessionEndTimestamp
        )

        guard #available(iOS 16.0, *) else { return false }

        var scheduleSuccess = false
        var monitorStartError: Error?
        do {
            try ObjCExceptionCatcher.execute {
                let comps: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
                let startComponents = Calendar.current.dateComponents(comps, from: breakEnd)
                // Same ≥16-minute clamp as `beginSession` — DeviceActivity
                // rejects intervals shorter than 15 minutes.
                let minimumMonitorInterval: TimeInterval = 16 * 60
                let monitorEnd = max(sessionEnd, breakEnd.addingTimeInterval(minimumMonitorInterval))
                let endComponents = Calendar.current.dateComponents(comps, from: monitorEnd)
                let schedule = DeviceActivitySchedule(
                    intervalStart: startComponents,
                    intervalEnd: endComponents,
                    repeats: false
                )
                let center = DeviceActivityCenter()
                // Stop the pre-break session monitor first — it would fire
                // `intervalDidEnd` at the ORIGINAL end, which no longer exists
                // under the fixed-end break model. (The extension's C3 guard
                // ignores the stale stop callback because the timestamp above
                // is in the future.)
                center.stopMonitoring([DeviceActivityName(SharedScreenTime.activityName)])
                do {
                    try center.startMonitoring(
                        DeviceActivityName(SharedScreenTime.activityName),
                        during: schedule
                    )
                    scheduleSuccess = true
                } catch {
                    scheduleSuccess = false
                    monitorStartError = error
                }
            }
        } catch {
            scheduleSuccess = false
            monitorStartError = error
        }

        if !scheduleSuccess {
            let iosVersion = UIDevice.current.systemVersion
            let breakSecondsLeft = Int(breakEnd.timeIntervalSinceNow)
            let capturedError = monitorStartError
            Task { @MainActor in
                if let err = capturedError {
                    AnalyticsService.shared.captureException(err, properties: [
                        "context": "device_activity_break_resume",
                        "ios_version": iosVersion,
                        "break_seconds_left": breakSecondsLeft,
                    ])
                }
                AnalyticsService.shared.track("device_activity_break_resume_failed", properties: [
                    "ios_version": iosVersion,
                    "break_seconds_left": breakSecondsLeft,
                ])
            }
        }
        return scheduleSuccess
    }

    /// Stop the break-resume monitor WITHOUT lifting the shield — the inverse
    /// of `removeShield()`'s "clear everything" semantics. Used when a promoted
    /// SCHEDULED session's break ends in-app: the shield must stay up (the
    /// window is still open) but the manual-named monitor and its
    /// manual-owns-the-shield `sessionEndTimestamp` have to go, otherwise the
    /// scheduled window-end `intervalDidEnd` would defer to a phantom manual
    /// session and strand the shield past the window.
    ///
    /// The timestamp is removed BEFORE the stop so the extension's stale
    /// `intervalDidEnd` (stopping an in-progress interval fires it) evaluates
    /// "no manual session" and falls into its scheduled-window-active guard,
    /// which keeps the shield up.
    public func cancelBreakResume() {
        SharedScreenTime.sharedDefaults()?.removeObject(
            forKey: SharedScreenTime.Keys.sessionEndTimestamp
        )
        guard #available(iOS 16.0, *) else { return }
        do {
            try ObjCExceptionCatcher.execute {
                DeviceActivityCenter().stopMonitoring(
                    [DeviceActivityName(SharedScreenTime.activityName)]
                )
            }
        } catch {
            let iosVersion = UIDevice.current.systemVersion
            Task { @MainActor in
                AnalyticsService.shared.captureException(error, properties: [
                    "context": "device_activity_break_resume_stop",
                    "ios_version": iosVersion,
                ])
                AnalyticsService.shared.track("device_activity_break_resume_stop_failed", properties: [
                    "ios_version": iosVersion,
                ])
            }
        }
    }

    /// Remove the shield (normal completion / hold-to-unlock path).
    public func removeShield() {
        do {
            try ObjCExceptionCatcher.execute {
                if #available(iOS 16.0, *) {
                    // Sweep primary + legacy shard stores (see SharedShieldApplier).
                    SharedShieldApplier.clearAll()
                } else if let s = self.store {
                    s.shield.applications = nil
                    s.shield.applicationCategories = nil
                    s.shield.webDomains = nil
                    s.shield.webDomainCategories = nil
                }
                self.shielding = false
            }
        } catch {
            let iosVersion = UIDevice.current.systemVersion
            Task { @MainActor in
                AnalyticsService.shared.captureException(error, properties: [
                    "context": "screen_time_shield_removal",
                    "ios_version": iosVersion,
                ])
                AnalyticsService.shared.track("screen_time_shield_removal_failed", properties: [
                    "ios_version": iosVersion,
                ])
            }
        }

        SharedScreenTime.sharedDefaults()?.removeObject(
            forKey: SharedScreenTime.Keys.sessionEndTimestamp
        )

        if #available(iOS 16.0, *) {
            do {
                try ObjCExceptionCatcher.execute {
                    DeviceActivityCenter().stopMonitoring(
                        [DeviceActivityName(SharedScreenTime.activityName)]
                    )
                }
            } catch {
                let iosVersion = UIDevice.current.systemVersion
                Task { @MainActor in
                    AnalyticsService.shared.captureException(error, properties: [
                        "context": "device_activity_monitor_stop",
                        "ios_version": iosVersion,
                    ])
                    AnalyticsService.shared.track("device_activity_monitor_stop_failed", properties: [
                        "ios_version": iosVersion,
                    ])
                }
            }
        }
    }

    public func isShielding() -> Bool {
        return self.shielding
    }

    public func getSelectedAppCount() -> Int {
        var count = 0
        do {
            try ObjCExceptionCatcher.execute {
                // Allowlist model: only application + web-domain tokens actually
                // form the `.all(except:)` exception set. categoryTokens are NOT
                // counted — `.all(except:)` can't exempt a whole category, so a
                // category selection allowlists nothing. Counting it would make
                // "Allowed apps: N" (and the scheduled diagnostic) read healthy
                // while the shield applies nothing. This count == the tokens the
                // guard in SharedShieldApplier.apply keys on, so count > 0 iff a
                // shield is actually applied.
                count = self.selection.applicationTokens.count + self.selection.webDomainTokens.count
            }
        } catch {
            let iosVersion = UIDevice.current.systemVersion
            Task { @MainActor in
                AnalyticsService.shared.track("screen_time_selection_count_failed", properties: [
                    "ios_version": iosVersion,
                ])
            }
        }
        return count
    }

    // MARK: - Shield Helper

    private func applyShield() {
        // Allowlist model: the selection is the set of apps that stay OPEN;
        // everything else is blocked. iOS caps the allowlist (`.all(except:)`)
        // at 50 tokens, so picks beyond 50 can't be exempted and end up
        // blocked. Surface it so we know when a user's allowlist is truncated.
        // Token-count access is wrapped in ObjCExceptionCatcher (as in
        // getSelectedAppCount) since reading counts on a decoded
        // FamilyActivitySelection can raise an ObjC exception.
        var allowlistCount = 0
        try? ObjCExceptionCatcher.execute {
            allowlistCount = self.selection.applicationTokens.count
        }
        if allowlistCount > SharedScreenTime.maxAllowlistTokens {
            let count = allowlistCount
            Task { @MainActor in
                AnalyticsService.shared.track("screen_time_allowlist_limit_exceeded", properties: [
                    "allowlist_count": count,
                    "max_allowlist": SharedScreenTime.maxAllowlistTokens,
                ])
            }
        }

        do {
            try ObjCExceptionCatcher.execute {
                if #available(iOS 16.0, *) {
                    // Allowlist model: blocks every app except the selection
                    // via `.all(except:)`, bypassing the cumulative 50-token
                    // block cap. See SharedShieldApplier.
                    SharedShieldApplier.apply(self.selection)
                } else if let s = self.store {
                    s.shield.applications = self.selection.applicationTokens.isEmpty ? nil : self.selection.applicationTokens
                    s.shield.applicationCategories = self.selection.categoryTokens.isEmpty
                        ? nil
                        : ShieldSettings.ActivityCategoryPolicy.specific(self.selection.categoryTokens)
                    s.shield.webDomains = self.selection.webDomainTokens.isEmpty ? nil : self.selection.webDomainTokens
                    s.shield.webDomainCategories = self.selection.categoryTokens.isEmpty
                        ? nil
                        : ShieldSettings.ActivityCategoryPolicy.specific(self.selection.categoryTokens)
                }
            }
        } catch {
            let iosVersion = UIDevice.current.systemVersion
            let appCount = self.selection.applicationTokens.count
            let categoryCount = self.selection.categoryTokens.count
            let webDomainCount = self.selection.webDomainTokens.count
            Task { @MainActor in
                AnalyticsService.shared.captureException(error, properties: [
                    "context": "screen_time_apply_shield",
                    "ios_version": iosVersion,
                    "application_count": appCount,
                    "category_count": categoryCount,
                ])
                AnalyticsService.shared.track("screen_time_apply_shield_failed", properties: [
                    "ios_version": iosVersion,
                    "application_count": appCount,
                    "category_count": categoryCount,
                ])
                // Separate event for the web-domain branch — the single catch
                // wraps both application + web-domain shield writes.
                if webDomainCount > 0 {
                    AnalyticsService.shared.captureException(error, properties: [
                        "context": "screen_time_shield_web_domains",
                        "ios_version": iosVersion,
                        "web_domain_count": webDomainCount,
                    ])
                    AnalyticsService.shared.track("screen_time_shield_web_domains_failed", properties: [
                        "ios_version": iosVersion,
                        "web_domain_count": webDomainCount,
                    ])
                }
            }
        }
    }

    // MARK: - Persistence (shared App Group suite with legacy migration)

    private func saveSelection() {
        guard let data = try? PropertyListEncoder().encode(selection) else { return }
        let defaults = SharedScreenTime.sharedDefaults() ?? UserDefaults.standard
        defaults.set(data, forKey: SharedScreenTime.Keys.selection)
    }

    private func loadSelection() {
        do {
            try ObjCExceptionCatcher.execute {
                let shared = SharedScreenTime.sharedDefaults()
                if let data = shared?.data(forKey: SharedScreenTime.Keys.selection),
                   let saved = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) {
                    self.selection = saved
                    return
                }
                // Legacy fallback: selection was previously written to .standard.
                if let data = UserDefaults.standard.data(forKey: SharedScreenTime.Keys.selection),
                   let saved = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) {
                    self.selection = saved
                    shared?.set(data, forKey: SharedScreenTime.Keys.selection)
                    UserDefaults.standard.removeObject(forKey: SharedScreenTime.Keys.selection)
                }
            }
        } catch {}
    }

    // MARK: - View Controller Helpers

    private func topViewController() -> UIViewController? {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first(where: \.isKeyWindow)
        else { return nil }

        var vc = window.rootViewController
        while let presented = vc?.presentedViewController {
            vc = presented
        }
        return vc
    }
}

// MARK: - SwiftUI App Picker

final class AppPickerModel: ObservableObject {
    @Published var selection: FamilyActivitySelection
    var onComplete: ((FamilyActivitySelection) -> Void)?
    private var completed = false

    init(selection: FamilyActivitySelection) {
        self.selection = selection
    }

    func complete() {
        guard !completed else { return }
        completed = true
        onComplete?(selection)
    }
}

struct AppPickerSheet: View {
    @ObservedObject var model: AppPickerModel
    @Environment(\.dismiss) var dismiss

    /// FamilyActivityPicker exposes no "content loaded" callback and can render
    /// an empty list for a beat right after authorization (especially the very
    /// first time, during onboarding) while iOS populates the installed-app
    /// list. We cover that window with a spinner and gate "Done" so the user
    /// can't dismiss a half-loaded picker and save an unintended empty allowlist.
    @State private var isReady = false

    /// Number of allowlisted apps, read defensively (token-count access can
    /// raise an ObjC exception on a decoded selection).
    private var allowlistCount: Int {
        var count = 0
        try? ObjCExceptionCatcher.execute {
            count = model.selection.applicationTokens.count
        }
        return count
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // The selection is an ALLOWLIST: chosen apps stay open, every
                // other app is blocked during a Lock-In. iOS limits the
                // allowlist to 50 apps.
                let over = allowlistCount > SharedScreenTime.maxAllowlistTokens
                Text(over
                     ? "You can allow at most \(SharedScreenTime.maxAllowlistTokens) apps. Only the first \(SharedScreenTime.maxAllowlistTokens) will stay open — the rest will be blocked."
                     : "Pick the individual apps that stay open during a Lock-In — every other app and all websites get blocked. Tap into a category and choose apps one by one; picking a whole category won't keep it open. Up to \(SharedScreenTime.maxAllowlistTokens) apps.")
                    .font(.footnote)
                    .foregroundColor(over ? Color(red: 1, green: 0.28, blue: 0.34) : .secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)

                ZStack {
                    // Keep the picker mounted (opacity 0) so it loads underneath
                    // while the spinner shows; fade it in once settled.
                    FamilyActivityPicker(selection: $model.selection)
                        .opacity(isReady ? 1 : 0)

                    if !isReady {
                        VStack(spacing: 12) {
                            ProgressView()
                            Text("Loading your apps…")
                                .font(.footnote)
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color(.systemBackground))
                    }
                }
            }
                .navigationTitle("Apps You Can Still Use")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            model.complete()
                            dismiss()
                        }
                        .disabled(!isReady)
                    }
                }
                .task {
                    // No readiness signal exists; settle briefly to let the
                    // system populate the picker before revealing it.
                    try? await Task.sleep(nanoseconds: 800_000_000)
                    isReady = true
                }
        }
        // Block swipe-to-dismiss during the load window too — otherwise the
        // user could dismiss a half-loaded picker and save an empty allowlist,
        // which the disabled Done button alone doesn't prevent.
        .interactiveDismissDisabled(!isReady)
        .onDisappear {
            model.complete()
        }
    }
}
