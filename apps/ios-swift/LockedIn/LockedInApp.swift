import SwiftUI
import AppsFlyerLib
import RevenueCat
import PostHog

/// `@main` SwiftUI entry point. Configures third-party SDKs at launch and
/// hands the scene off to `RootView`. `RootView` runs the post-launch
/// hydration / boot pipeline via the shared `AnalyticsService` +
/// `LogoutCleanupBus` + state objects.
@main
struct LockedInApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        // Run UserDefaults migrations BEFORE state hydration / SDK init so any
        // legacy `crew_*` key reads pick up the freshly-mirrored values.
        // `StorageMigrations.runAll()` is `@MainActor`-isolated; `init()` runs
        // on the main actor in a SwiftUI `App`, so the call is safe.
        MainActor.assumeIsolated {
            StorageMigrations.runAll()
        }
        Self.configureSDKs()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
        }
    }

    // MARK: - SDK Configuration

    private static func configureSDKs() {
        // Touch the Supabase singleton so it boots eagerly and fails fast on
        // missing env vars rather than at first network call.
        _ = LockedInSupabase.shared

        if let revenueCatKey = LockedInConfig.string(.revenueCatIOSAPIKey) {
            Purchases.logLevel = .info
            Purchases.configure(withAPIKey: revenueCatKey)
        }

        if let devKey = LockedInConfig.string(.appsFlyerDevKey),
           let appId = LockedInConfig.string(.appsFlyerAppId) {
            AppsFlyerLib.shared().appsFlyerDevKey = devKey
            AppsFlyerLib.shared().appleAppID = appId
            AppsFlyerLib.shared().isDebug = false
        }

        if let postHogKey = LockedInConfig.string(.postHogApiKey) {
            let host = LockedInConfig.string(.postHogHost) ?? "https://us.i.posthog.com"
            let config = PostHogConfig(projectToken: postHogKey, host: host)

            // We emit `App Opened` / `Notification Tapped` ourselves — disable
            // PostHog auto-capture for app-lifecycle and screen-view events.
            config.captureApplicationLifecycleEvents = false
            config.captureScreenViews = false

            // Only create person profiles after `identify()` runs. Keeps MAU
            // honest and avoids creating a row for every anonymous boot.
            config.personProfiles = .identifiedOnly

            // Session replay disabled — event analytics + error tracking only.
            config.sessionReplay = false

            // Error tracking — auto-capture Mach exceptions + POSIX signals.
            config.errorTrackingConfig.autoCapture = true

            #if DEBUG
            config.debug = true
            #else
            config.debug = false
            #endif

            PostHogSDK.shared.setup(config)

            // Install an uncaught Obj-C exception handler that forwards to
            // PostHog. PostHog's `autoCapture` covers Mach + signals but not
            // arbitrary Obj-C `NSException` throws.
            NSSetUncaughtExceptionHandler { exception in
                PostHogSDK.shared.captureException(exception, properties: [
                    "exception_name": exception.name.rawValue,
                    "exception_reason": exception.reason ?? "",
                    "is_fatal": true,
                    "platform": "ios",
                ])
            }
        }
    }
}
