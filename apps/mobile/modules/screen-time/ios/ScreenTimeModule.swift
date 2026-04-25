import ExpoModulesCore
import UIKit
import FamilyControls
import ManagedSettings
import DeviceActivity
import SwiftUI

public class ScreenTimeModule: Module, @unchecked Sendable {

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
        } catch { return nil }
        if let c = created {
            _store = c
            return c
        }
        return nil
    }

    public func definition() -> ModuleDefinition {
        Name("ScreenTime")

        OnCreate {
            self.loadSelection()
        }

        // MARK: - Authorization

        AsyncFunction("requestAuthorization") { () async -> String in
            guard #available(iOS 16.0, *) else { return "denied" }

            return await Task { @MainActor in
                var currentStatus: FamilyControls.AuthorizationStatus = .notDetermined
                var checkSuccess = false

                do {
                    try ObjCExceptionCatcher.execute {
                        currentStatus = AuthorizationCenter.shared.authorizationStatus
                        checkSuccess = true
                    }
                } catch {
                    return "denied"
                }

                if !checkSuccess { return "denied" }

                if currentStatus == .approved {
                    self.authorized = true
                    return "approved"
                }

                if currentStatus == .denied {
                    return "denied"
                }

                do {
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                    self.authorized = true
                    return "approved"
                } catch {
                    return "denied"
                }
            }.value
        }

        Function("getAuthorizationStatus") { () -> String in
            guard #available(iOS 16.0, *) else { return "not_determined" }
            var status = "not_determined"
            do {
                try ObjCExceptionCatcher.execute {
                    switch AuthorizationCenter.shared.authorizationStatus {
                    case .notDetermined: status = "not_determined"
                    case .approved:
                        self.authorized = true
                        status = "approved"
                    case .denied: status = "denied"
                    @unknown default: status = "not_determined"
                    }
                }
            } catch {}
            return status
        }

        // MARK: - App Picker

        AsyncFunction("showAppPicker") { () async -> Int in
            // Ensure authorization before presenting the picker.
            // The in-memory flag resets each launch, so re-check the
            // actual system status and prompt if still undetermined.
            if !self.authorized, #available(iOS 16.0, *) {
                let resolved: Bool = await Task { @MainActor in
                    var status: FamilyControls.AuthorizationStatus = .notDetermined
                    do {
                        try ObjCExceptionCatcher.execute {
                            status = AuthorizationCenter.shared.authorizationStatus
                        }
                    } catch { return false }

                    if status == .approved {
                        self.authorized = true
                        return true
                    }
                    if status == .denied { return false }

                    do {
                        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                        self.authorized = true
                        return true
                    } catch { return false }
                }.value
                if !resolved { return 0 }
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
        // The JS layer also removes the shield on normal completion / hold-to-unlock
        // (via `endSession`), so both a normal end and a background-killed end are
        // covered.

        AsyncFunction("beginSession") { (durationSeconds: Int) -> Bool in
            guard let s = self.store else { return false }
            self.applyShield(on: s)

            let endDate = Date().addingTimeInterval(TimeInterval(durationSeconds))
            SharedScreenTime.sharedDefaults()?.set(
                endDate.timeIntervalSince1970 * 1000,
                forKey: SharedScreenTime.Keys.sessionEndTimestamp
            )

            guard #available(iOS 16.0, *) else {
                self.shielding = true
                return true
            }

            var scheduleSuccess = false
            do {
                try ObjCExceptionCatcher.execute {
                    let startComponents = Calendar.current.dateComponents([.hour, .minute, .second], from: Date())
                    let endComponents = Calendar.current.dateComponents([.hour, .minute, .second], from: endDate)
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
                    }
                }
            } catch { scheduleSuccess = false }

            self.shielding = true
            return scheduleSuccess
        }

        // Legacy entry point (kept for backward compat; prefer beginSession).
        Function("shieldApps") { () in
            guard let s = self.store else { return }
            self.applyShield(on: s)
            self.shielding = true
        }

        Function("removeShield") { () in
            guard let s = self.store else { return }
            do {
                try ObjCExceptionCatcher.execute {
                    s.shield.applications = nil
                    s.shield.applicationCategories = nil
                    s.shield.webDomains = nil
                    s.shield.webDomainCategories = nil
                    self.shielding = false
                }
            } catch {}

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
                } catch {}
            }
        }

        Function("isShielding") { () -> Bool in
            return self.shielding
        }

        Function("getSelectedAppCount") { () -> Int in
            var count = 0
            do {
                try ObjCExceptionCatcher.execute {
                    count = self.selection.applicationTokens.count + self.selection.categoryTokens.count
                }
            } catch {}
            return count
        }
    }

    // MARK: - Shield Helper

    private func applyShield(on s: ManagedSettingsStore) {
        do {
            try ObjCExceptionCatcher.execute {
                s.shield.applications = self.selection.applicationTokens.isEmpty ? nil : self.selection.applicationTokens
                s.shield.applicationCategories = self.selection.categoryTokens.isEmpty
                    ? nil
                    : ShieldSettings.ActivityCategoryPolicy.specific(self.selection.categoryTokens)
                s.shield.webDomains = self.selection.webDomainTokens.isEmpty ? nil : self.selection.webDomainTokens
                s.shield.webDomainCategories = self.selection.categoryTokens.isEmpty
                    ? nil
                    : ShieldSettings.ActivityCategoryPolicy.specific(self.selection.categoryTokens)
            }
        } catch {}
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

class AppPickerModel: ObservableObject {
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

    var body: some View {
        NavigationView {
            FamilyActivityPicker(selection: $model.selection)
                .navigationTitle("Block Apps")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            model.complete()
                            dismiss()
                        }
                    }
                }
        }
        .onDisappear {
            model.complete()
        }
    }
}
