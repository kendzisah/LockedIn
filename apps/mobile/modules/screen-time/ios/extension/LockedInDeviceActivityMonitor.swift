import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

/// DeviceActivityMonitor extension. Runs in its own process; iOS wakes it at
/// the scheduled interval boundaries even when the main app has been killed.
///
/// Responsibilities:
/// - `intervalDidEnd`: primary un-shield. Guarantees apps get unblocked when
///   the Lock In session's scheduled time has elapsed, regardless of main app
///   state.
/// - `intervalDidStart`: defensive re-apply of the shield — the main app
///   already applied it synchronously, but this guards against the main app
///   being killed between calling `startMonitoring` and the shield actually
///   landing.
///
/// Extensions have tight CPU/time budgets per callback. Keep this minimal —
/// no network, no heavy work.
@available(iOS 16.0, *)
final class LockedInDeviceActivityMonitor: DeviceActivityMonitor {

    private lazy var store: ManagedSettingsStore = ManagedSettingsStore(
        named: .init(SharedScreenTime.managedSettingsStoreName)
    )

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        guard activity.rawValue == SharedScreenTime.activityName else { return }
        applyShieldFromSavedSelection()
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        guard activity.rawValue == SharedScreenTime.activityName else { return }
        clearShield()
    }

    override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.eventDidReachThreshold(event, activity: activity)
    }

    override func intervalWillStartWarning(for activity: DeviceActivityName) {
        super.intervalWillStartWarning(for: activity)
    }

    override func intervalWillEndWarning(for activity: DeviceActivityName) {
        super.intervalWillEndWarning(for: activity)
    }

    override func eventWillReachThresholdWarning(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.eventWillReachThresholdWarning(event, activity: activity)
    }

    // MARK: - Private

    private func applyShieldFromSavedSelection() {
        guard let data = SharedScreenTime.sharedDefaults()?
                .data(forKey: SharedScreenTime.Keys.selection),
              let selection = try? PropertyListDecoder()
                .decode(FamilyActivitySelection.self, from: data)
        else { return }

        store.shield.applications = selection.applicationTokens.isEmpty
            ? nil : selection.applicationTokens
        store.shield.applicationCategories = selection.categoryTokens.isEmpty
            ? nil
            : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
        store.shield.webDomains = selection.webDomainTokens.isEmpty
            ? nil : selection.webDomainTokens
        store.shield.webDomainCategories = selection.categoryTokens.isEmpty
            ? nil
            : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
    }

    private func clearShield() {
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomains = nil
        store.shield.webDomainCategories = nil
        SharedScreenTime.sharedDefaults()?.removeObject(
            forKey: SharedScreenTime.Keys.sessionEndTimestamp
        )
    }
}
