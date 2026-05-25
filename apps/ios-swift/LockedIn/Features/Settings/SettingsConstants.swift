import Foundation

/// External URLs and copy used by the Settings (Profile) screen.
///
/// Mirrors `apps/mobile/src/features/settings/settingsConstants.ts`. Values
/// come from `LockedInConfig` (xcconfig → Info.plist) when set, otherwise
/// fall back to production defaults.
public enum SettingsConstants {
    /// App Store listing for "Locked In: Mental Conditioning".
    /// Override via `IOS_APP_STORE_URL` xcconfig entry for staging builds.
    public static var iosAppStorePageURL: URL {
        if let override = LockedInConfig.url(.iosAppStoreURL) {
            return override
        }
        return URL(string: "https://apps.apple.com/us/app/locked-in-mental-conditioning/id6759698565")!
    }

    /// Privacy Policy URL — opened from Settings → About.
    public static var privacyURL: URL {
        if let override = LockedInConfig.url(.privacyURL) {
            return override
        }
        return URL(string: "https://locked-in.co/privacy")!
    }

    /// Terms of Service URL — opened from Settings → About.
    public static var termsURL: URL {
        if let override = LockedInConfig.url(.termsURL) {
            return override
        }
        return URL(string: "https://locked-in.co/terms")!
    }

    /// Manage subscription URL — Apple-only (Android is dropped).
    public static let manageSubscriptionURL: URL =
        URL(string: "https://apps.apple.com/account/subscriptions")!

    /// Feedback Formspree endpoint (matches `FORMSPREE_URL` in RN
    /// `SettingsScreen.tsx`).
    public static let feedbackFormspreeURL: URL =
        URL(string: "https://formspree.io/f/xwvwngjo")!

    /// App Store URL with `?action=write-review` appended — opens the
    /// Reviews tab on the listing.
    public static func appStoreReviewURL() -> URL {
        let raw = iosAppStorePageURL.absoluteString
        let trimmed = raw.hasSuffix("/") ? String(raw.dropLast()) : raw
        return URL(string: "\(trimmed)?action=write-review") ?? iosAppStorePageURL
    }

    /// Share message body (matches RN `iosShareMessage()`).
    public static func shareMessage() -> String {
        "I've been using Locked In to build discipline and stay focused. Check it out: \(iosAppStorePageURL.absoluteString)"
    }
}
