import Foundation

/// Strongly-typed read-only view of the `LockedInConfig` dictionary embedded
/// in `Info.plist`. Each entry maps to an `xcconfig` build setting (see
/// `Config/Debug.xcconfig` and `Config/Secrets.xcconfig.example`).
///
/// Reads happen once at startup; subsequent calls are O(1).
public enum LockedInConfig {
    private static let configKey = "LockedInConfig"

    public enum Key: String {
        case supabaseURL = "SUPABASE_URL"
        case supabaseAnonKey = "SUPABASE_ANON_KEY"
        case supabasePasswordResetRedirect = "SUPABASE_PASSWORD_RESET_REDIRECT"
        case revenueCatIOSAPIKey = "REVENUECAT_IOS_API_KEY"
        case appsFlyerDevKey = "APPSFLYER_DEV_KEY"
        case appsFlyerAppId = "APPSFLYER_APP_ID"
        case iosAppStoreURL = "IOS_APP_STORE_URL"
        case privacyURL = "PRIVACY_URL"
        case termsURL = "TERMS_URL"
        case postHogApiKey = "POSTHOG_API_KEY"
        case postHogHost = "POSTHOG_HOST"
    }

    public static func string(_ key: Key) -> String? {
        guard let dict = Bundle.main.object(forInfoDictionaryKey: configKey) as? [String: Any],
              let value = dict[key.rawValue] as? String,
              !value.isEmpty
        else { return nil }
        return value
    }

    public static func required(_ key: Key) -> String {
        guard let value = string(key) else {
            fatalError("Missing required LockedInConfig value: \(key.rawValue). Provide it via Config/Secrets.xcconfig.")
        }
        return value
    }

    public static func url(_ key: Key) -> URL? {
        guard let raw = string(key) else { return nil }
        return URL(string: raw)
    }
}
