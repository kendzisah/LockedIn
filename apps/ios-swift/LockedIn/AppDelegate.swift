import UIKit
import AppsFlyerLib
import UserNotifications

/// UIKit AppDelegate for APNs registration and AppsFlyer launch hooks.
///
/// Phase 1 Worker W1 (Auth) / W11 (Session) will extend this to:
/// - Convert APNs device token Data → hex string and POST to `profiles` table.
/// - Handle Universal Links / `lockedin://` deep links.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        AppsFlyerLib.shared().start()
    }

    // MARK: - Remote Notifications

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let tokenHex = deviceToken.map { String(format: "%02x", $0) }.joined()
        AppsFlyerLib.shared().registerUninstall(deviceToken)
        // TODO(W1/W11): POST `tokenHex` to the `profiles` push-token column once Agent A
        // confirms the column name. See plan §"Open items to confirm".
        _ = tokenHex
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Phase 1 worker W1 will log this via PostHogService.
    }

    // MARK: - Foreground notifications

    /// Foreground presentation policy. The "break over" and "session complete"
    /// nudges exist ONLY to pull the user back into the app from the outside —
    /// when they're already looking at LockedIn the in-app UI (focus ring /
    /// completion screen) is showing the same state, so presenting the banner
    /// on top would be a redundant, stale-feeling double announcement. The
    /// scheduled per-occurrence "Session Complete" (prefix-matched — its ids
    /// are date-scoped) is the scheduled counterpart of `executionBlockDone`:
    /// promoted scheduled sessions deliberately skip `executionBlockDone` in
    /// favor of it, so it gets the same suppression. Every other notification
    /// keeps the full banner treatment.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let id = notification.request.identifier
        if id == NotificationService.ID.breakEnded
            || id == NotificationService.ID.executionBlockDone
            || id.hasPrefix(NotificationService.ID.scheduledSessionEndPrefix) {
            completionHandler([])
            return
        }
        completionHandler([.banner, .sound, .badge])
    }

    /// Fired when the user taps a delivered notification. Emits `Notification
    /// Tapped` so engagement from push can be attributed. `notification_type`
    /// is the stable leading segment of the request identifier (e.g.
    /// `streak_milestone.7` → `streak_milestone`).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let identifier = response.notification.request.identifier
        let type = identifier.split(separator: ".").first.map(String.init) ?? identifier
        Task { @MainActor in
            AnalyticsService.shared.track("Notification Tapped", properties: [
                "notification_type": type,
                "notification_id": identifier,
            ])
        }
        completionHandler()
    }

    // MARK: - URL Handling (custom scheme + Universal Links)

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        AppsFlyerLib.shared().handleOpen(url, options: options)
        // TODO(W1): route `lockedin://` deep links through the auth feature.
        return true
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        AppsFlyerLib.shared().continue(userActivity) { _ in }
        // TODO(W1): handle `applinks:locked-in.co` Universal Links → password reset.
        return true
    }
}
