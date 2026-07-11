import Foundation

/// Cross-process mirror of the Supabase auth session + public client config.
///
/// The main app writes these to the App Group so the DeviceActivityMonitor
/// extension can make authenticated Supabase calls (crediting guild points when a
/// scheduled session completes in the background) WITHOUT linking the Supabase SDK
/// or reaching into the app's private Keychain (which the extension can't read —
/// it has no keychain-access-group entitlement).
///
/// The app writes:
///   - the session (access token + refresh token + access-token expiry) on every
///     auth state change, via `AuthState`'s `authStateChanges` listener;
///   - the project URL + anon key once at launch (both are public client values
///     already baked into the binary), via `LockedInSupabase.init`.
///
/// SAFETY — depends on refresh-token rotation being **disabled** for the project
/// (Supabase Auth setting; see `supabase/config.toml`). With rotation off the
/// refresh token is stable, so the extension can mint a fresh access token from it
/// without invalidating the app's session — no logout race. If the mirror is
/// missing/expired and can't refresh, the extension simply skips the push and the
/// app credits the occurrence on next open (the guaranteed fallback path).
///
/// Compiled into the app + extension targets via the `Shared/` source group.
public enum SupabaseAuthMirror {

    /// Access/refresh tokens + access-token expiry, mirrored to the App Group.
    public struct MirroredSession: Codable, Equatable, Sendable {
        public var accessToken: String
        public var refreshToken: String
        /// Access-token expiry, epoch milliseconds.
        public var expiresAtMs: Double

        public init(accessToken: String, refreshToken: String, expiresAtMs: Double) {
            self.accessToken = accessToken
            self.refreshToken = refreshToken
            self.expiresAtMs = expiresAtMs
        }

        /// True when the access token is expired or within a 60s skew window —
        /// the extension refreshes before using it.
        public func isExpired(now: Date = Date()) -> Bool {
            expiresAtMs <= (now.timeIntervalSince1970 * 1000) + 60_000
        }
    }

    public enum Keys {
        public static let session = "@lockedin/sb_session"
        public static let url = "@lockedin/sb_url"
        public static let anonKey = "@lockedin/sb_anon_key"
    }

    private static func defaults() -> UserDefaults? {
        UserDefaults(suiteName: SharedScreenTime.appGroupId)
    }

    // MARK: - Session (written by the app)

    public static func writeSession(_ session: MirroredSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        defaults()?.set(data, forKey: Keys.session)
    }

    public static func clearSession() {
        defaults()?.removeObject(forKey: Keys.session)
    }

    public static func readSession() -> MirroredSession? {
        guard let data = defaults()?.data(forKey: Keys.session) else { return nil }
        return try? JSONDecoder().decode(MirroredSession.self, from: data)
    }

    /// Overwrite only the access token + expiry after an in-extension refresh.
    /// The refresh token is intentionally left untouched (rotation is off, so it
    /// never changes — writing it back would be a no-op at best, a stale-clobber
    /// at worst if the app rotated in parallel).
    public static func updateAccessToken(_ accessToken: String, expiresAtMs: Double) {
        guard var s = readSession() else { return }
        s.accessToken = accessToken
        s.expiresAtMs = expiresAtMs
        writeSession(s)
    }

    // MARK: - Public client config (written by the app at launch)

    public static func writeConfig(url: String, anonKey: String) {
        let d = defaults()
        d?.set(url, forKey: Keys.url)
        d?.set(anonKey, forKey: Keys.anonKey)
    }

    public static func readConfig() -> (url: String, anonKey: String)? {
        guard let url = defaults()?.string(forKey: Keys.url),
              let anon = defaults()?.string(forKey: Keys.anonKey),
              !url.isEmpty, !anon.isEmpty
        else { return nil }
        return (url, anon)
    }
}
