import SwiftUI
import AppsFlyerLib
import RevenueCat
import PostHog
import AppIntentsKit

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

            // Defer the first attribution send until the ATT opt-in prompt
            // resolves (or 10s elapses), so we never track before the user
            // consents. `RootView` shows the prompt via `TrackingAuthorization`.
            // Mirrors RN's `timeToWaitForATTUserAuthorization: 10` (App.tsx).
            // Must be set before `AppsFlyerLib.start()` runs in AppDelegate.
            AppsFlyerLib.shared().waitForATTUserAuthorization(timeoutInterval: 10)
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
            // Flush every event immediately in debug so they show up in the
            // PostHog console within seconds instead of waiting for the default
            // 20-event / 30-second batch window. Production keeps the batched
            // defaults to conserve battery/network.
            config.flushAt = 1
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
        } else {
            // Loud failure instead of silently shipping a build with no
            // analytics: POSTHOG_API_KEY is missing/empty in Secrets.xcconfig
            // on this build machine, so PostHog was NOT initialized and no
            // events will be sent.
            print("⚠️ [LockedIn] POSTHOG_API_KEY missing — PostHog analytics DISABLED for this build. Check Config/Secrets.xcconfig.")
            #if DEBUG
            assertionFailure("POSTHOG_API_KEY missing from Config/Secrets.xcconfig — PostHog is disabled.")
            #endif
        }

        // Wire the AppIntents service locator. Siri / Shortcuts / interactive
        // widgets (Agent 5) call into this concrete impl via the protocol
        // declared in AppIntentsKit. Must run before any intent can fire —
        // we set it at the end of SDK configuration so all dependencies
        // (PostHog, Supabase) are already up.
        if #available(iOS 16.0, *) {
            LockInIntentServiceLocator.shared = LockInIntentServiceImpl()
        }
    }
}
