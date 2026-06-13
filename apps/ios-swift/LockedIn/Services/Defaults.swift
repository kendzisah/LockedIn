import Foundation

/// Typed wrapper around `UserDefaults.standard` AND
/// `UserDefaults(suiteName: "group.com.flocktechnologies.lockedin")`.
///
/// Phase 1 workers register their `@lockedin/*` keys here. The shared App
/// Group suite is the IPC channel between the main app and the Device
/// Activity Monitor extension (see SharedScreenTimeConstants).
public enum Defaults {
    /// App Group suite identifier — must match the entitlement on both the
    /// main app and the DAM extension.
    public static let appGroupSuiteName = "group.com.flocktechnologies.lockedin"

    /// Standard (per-app) defaults.
    public static let standard: UserDefaults = .standard

    /// App-group-shared defaults. Falls back to `.standard` only if the
    /// suite is unavailable (entitlement misconfigured).
    public static let appGroup: UserDefaults = {
        UserDefaults(suiteName: appGroupSuiteName) ?? .standard
    }()

    /// Storage scope.
    public enum Scope {
        case standard
        case appGroup

        var store: UserDefaults {
            switch self {
            case .standard: return Defaults.standard
            case .appGroup: return Defaults.appGroup
            }
        }
    }

    // MARK: - String

    public static func string(_ key: String, scope: Scope = .standard) -> String? {
        scope.store.string(forKey: key)
    }

    public static func setString(_ value: String?, _ key: String, scope: Scope = .standard) {
        if let value {
            scope.store.set(value, forKey: key)
        } else {
            scope.store.removeObject(forKey: key)
        }
    }

    // MARK: - Bool

    public static func bool(_ key: String, scope: Scope = .standard) -> Bool {
        scope.store.bool(forKey: key)
    }

    public static func setBool(_ value: Bool, _ key: String, scope: Scope = .standard) {
        scope.store.set(value, forKey: key)
    }

    // MARK: - Int / Double

    public static func int(_ key: String, scope: Scope = .standard) -> Int {
        scope.store.integer(forKey: key)
    }

    public static func setInt(_ value: Int, _ key: String, scope: Scope = .standard) {
        scope.store.set(value, forKey: key)
    }

    public static func double(_ key: String, scope: Scope = .standard) -> Double {
        scope.store.double(forKey: key)
    }

    public static func setDouble(_ value: Double, _ key: String, scope: Scope = .standard) {
        scope.store.set(value, forKey: key)
    }

    // MARK: - Data / Codable

    public static func data(_ key: String, scope: Scope = .standard) -> Data? {
        scope.store.data(forKey: key)
    }

    public static func setData(_ value: Data?, _ key: String, scope: Scope = .standard) {
        if let value {
            scope.store.set(value, forKey: key)
        } else {
            scope.store.removeObject(forKey: key)
        }
    }

    public static func codable<T: Decodable>(_ type: T.Type, _ key: String, scope: Scope = .standard) -> T? {
        guard let data = data(key, scope: scope) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    public static func setCodable<T: Encodable>(_ value: T?, _ key: String, scope: Scope = .standard) {
        guard let value else {
            scope.store.removeObject(forKey: key)
            return
        }
        if let encoded = try? JSONEncoder().encode(value) {
            scope.store.set(encoded, forKey: key)
        }
    }

    // MARK: - Removal

    public static func remove(_ key: String, scope: Scope = .standard) {
        scope.store.removeObject(forKey: key)
    }
}
