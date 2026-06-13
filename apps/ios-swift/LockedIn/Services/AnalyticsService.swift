//
//  AnalyticsService.swift
//  LockedIn
//
//  Shared analytics wrapper. Combines PostHog + AppsFlyer behind a single
//  `@MainActor` singleton so every feature ships events through the same path.
//
//  Replaces the per-feature analytics shims that ship as placeholders:
//   - AuthAnalytics, OnboardingAnalytics, SettingsAnalytics, ReportAnalytics
//     (and any other feature-local stub) now forward into this service.
//
//  Mirrors the RN AnalyticsService (`apps/mobile/src/services/AnalyticsService.ts`)
//  + PostHogService + AppsFlyerService:
//   - PostHog API key + host come from xcconfig (`POSTHOG_API_KEY`,
//     `POSTHOG_HOST`), read via `LockedInConfig.postHogApiKey` etc.
//   - AppsFlyer dev key + app id come from xcconfig too.
//
//  Event-name policy: PostHog events use snake_case by convention. Call sites
//  in this codebase still pass Title Case names (e.g. "Sign In Completed").
//  This wrapper normalizes everything via `toSnakeCase()` before forwarding,
//  so call sites don't need to change. Property keys that start with `$` are
//  PostHog-reserved and are left alone.
//
//  Concurrency: `@MainActor`. PostHog + AppsFlyer SDK calls are not strictly
//  main-actor-required, but funneling through main keeps the call surface
//  identical to the rest of the iOS app and avoids extra hops.
//

import Foundation
import PostHog
import AppsFlyerLib

/// Centralised analytics. Use `AnalyticsService.shared.track(...)` everywhere
/// instead of feature-local `print` shims.
@MainActor
public final class AnalyticsService {
    public static let shared = AnalyticsService()

    private var didConfigure = false

    /// In-memory timer map for `timeEvent` — PostHog has no native timed
    /// events, so we record a start timestamp keyed by the *normalized* event
    /// name. The matching `track()` call attaches `duration_seconds` and clears
    /// the entry. Lock guarded for thread-safety.
    private var timedEvents: [String: CFAbsoluteTime] = [:]
    private let timedEventsLock = NSLock()

    private init() {}

    // MARK: - Configuration

    /// Confirm that PostHog + AppsFlyer SDKs are wired. The actual PostHog
    /// `setup(...)` call lives in `LockedInApp.configureSDKs()` so the SDK is
    /// up before any state initializer has a chance to fire an event.
    ///
    /// Safe to call multiple times — only the first invocation does any work.
    public func configure() {
        guard !didConfigure else { return }
        didConfigure = true

        if let devKey = LockedInConfig.string(.appsFlyerDevKey),
           let appId = LockedInConfig.string(.appsFlyerAppId) {
            AppsFlyerLib.shared().appsFlyerDevKey = devKey
            AppsFlyerLib.shared().appleAppID = appId
            AppsFlyerLib.shared().isDebug = false
        }
    }

    // MARK: - Identification

    /// Identify the current user in PostHog. Pass the **Supabase
    /// `auth.users.id` UUID** (not the RevenueCat `originalAppUserId`) so
    /// identity matches Supabase and the admin dashboard.
    public func identify(userId: String) {
        PostHogSDK.shared.identify(userId)
    }

    /// Reset PostHog identity (anonymous distinct_id regenerated). Called on
    /// sign-out via `LogoutCleanupBus`.
    public func reset() {
        PostHogSDK.shared.reset()
        // AppsFlyer setCustomerUserId is intentionally never called in the RN
        // app either (see plan §"Open items"); we mirror that here.
    }

    // MARK: - Event tracking

    /// Track an event. Properties may contain `String`, `Int`, `Double`,
    /// `Bool`, `Date`, or arrays of those types — anything else is stringified.
    ///
    /// Event name + property keys are normalized to `snake_case`. Property
    /// keys starting with `$` are PostHog-reserved and left alone.
    public func track(_ event: String, properties: [String: Any] = [:]) {
        let normalizedEvent = Self.toSnakeCase(event)
        var props = Self.normalizeKeys(properties)

        // Attach duration if a matching `timeEvent` start exists.
        timedEventsLock.lock()
        if let start = timedEvents.removeValue(forKey: normalizedEvent) {
            let elapsed = CFAbsoluteTimeGetCurrent() - start
            props["duration_seconds"] = elapsed
        }
        timedEventsLock.unlock()

        PostHogSDK.shared.capture(normalizedEvent, properties: Self.sanitize(props))
    }

    /// Start a timed event. Pair with `track(event:)` to fire with auto-filled
    /// `duration_seconds`. Mirrors RN `Analytics.timeEvent`.
    public func timeEvent(_ event: String) {
        let key = Self.toSnakeCase(event)
        timedEventsLock.lock()
        timedEvents[key] = CFAbsoluteTimeGetCurrent()
        timedEventsLock.unlock()
    }

    /// Fire an AppsFlyer custom event. Used for `af_subscribe`,
    /// `af_complete_registration`, `af_start_trial`, etc. Pass-through —
    /// `af_*` names are NOT normalized.
    public func trackAppsFlyer(_ event: String, values: [String: Any] = [:]) {
        AppsFlyerLib.shared().logEvent(event, withValues: values)
    }

    // MARK: - User properties

    /// Set PostHog person properties (overwrites any existing values).
    /// Keys not starting with `$` are normalized to snake_case.
    ///
    /// Implementation: emits a `$set` event with the properties under the
    /// `$set` key — this is the wire format PostHog expects for person
    /// property updates.
    public func setUserProperties(_ props: [String: Any]) {
        let normalized = Self.normalizeKeys(props)
        PostHogSDK.shared.capture(
            "$set",
            properties: ["$set": Self.sanitize(normalized)] as [String: Any]
        )
    }

    /// Set PostHog person properties — only sets keys that are not already
    /// set for this user (idempotent).
    public func setUserPropertiesOnce(_ props: [String: Any]) {
        let normalized = Self.normalizeKeys(props)
        PostHogSDK.shared.capture(
            "$set",
            properties: ["$set_once": Self.sanitize(normalized)] as [String: Any]
        )
    }

    /// Register "super-properties" — values auto-attached to every subsequent
    /// event. PostHog's equivalent is `register(...)`. Keys not starting with
    /// `$` are normalized to snake_case.
    public func registerSuperProperties(_ props: [String: Any]) {
        let normalized = Self.normalizeKeys(props)
        PostHogSDK.shared.register(Self.sanitize(normalized))
    }

    /// Forwards an unregister call to PostHog. Provided for completeness.
    public func unregisterSuperProperty(_ key: String) {
        PostHogSDK.shared.unregister(Self.toSnakeCase(key))
    }

    // MARK: - Exception capture

    /// Capture an arbitrary error in PostHog with optional extra properties.
    /// Used by P0/P1 instrumentation hooks throughout the app.
    public func captureException(_ error: Error, properties: [String: Any] = [:]) {
        var props = Self.normalizeKeys(properties)
        let nsError = error as NSError
        props["error_code"] = nsError.code
        props["error_message"] = error.localizedDescription
        props["error_type"] = String(describing: type(of: error))
        props["error_domain"] = nsError.domain
        props["platform"] = "ios"
        PostHogSDK.shared.captureException(error, properties: Self.sanitize(props))
    }

    // MARK: - Helpers

    /// Convert arbitrary value bags into PostHog-friendly values. Anything
    /// non-trivial falls back to a string representation so the call site
    /// doesn't crash on unexpected types.
    private static func sanitize(_ props: [String: Any]) -> [String: Any] {
        var out: [String: Any] = [:]
        for (key, raw) in props {
            if let v = raw as? String { out[key] = v }
            else if let v = raw as? Int { out[key] = v }
            else if let v = raw as? UInt { out[key] = Int(v) }
            else if let v = raw as? Double { out[key] = v }
            else if let v = raw as? Float { out[key] = Double(v) }
            else if let v = raw as? Bool { out[key] = v }
            else if let v = raw as? Date { out[key] = v }
            else if let v = raw as? URL { out[key] = v.absoluteString }
            else if let v = raw as? [String] { out[key] = v }
            else if let v = raw as? [Int] { out[key] = v }
            else if let v = raw as? [Double] { out[key] = v }
            else if let v = raw as? [String: Any] { out[key] = sanitize(v) }
            else if let v = raw as? [String: String] { out[key] = v }
            else if raw is NSNull { continue }
            else { out[key] = String(describing: raw) }
        }
        return out
    }

    /// Normalize a property dictionary's keys to snake_case. Keys that start
    /// with `$` are PostHog reserved and left untouched.
    private static func normalizeKeys(_ props: [String: Any]) -> [String: Any] {
        var out: [String: Any] = [:]
        for (key, value) in props {
            if key.hasPrefix("$") {
                out[key] = value
            } else {
                out[toSnakeCase(key)] = value
            }
        }
        return out
    }

    /// Convert a string (CamelCase, Title Case, "Title Case With Spaces", or
    /// already-snake_case) into `snake_case`.
    ///
    ///   "Sign In Completed"  → "sign_in_completed"
    ///   "PaywallShown"       → "paywall_shown"
    ///   "paywall_shown"      → "paywall_shown"
    ///   "duration_ms"        → "duration_ms"
    static func toSnakeCase(_ input: String) -> String {
        guard !input.isEmpty else { return input }
        var result = ""
        result.reserveCapacity(input.count + 4)
        var prevWasLower = false

        for char in input {
            if char == " " || char == "-" || char == "." {
                if !result.isEmpty, !result.hasSuffix("_") {
                    result.append("_")
                }
                prevWasLower = false
                continue
            }
            if char.isUppercase {
                if prevWasLower, !result.isEmpty, !result.hasSuffix("_") {
                    result.append("_")
                }
                result.append(char.lowercased())
                prevWasLower = false
            } else {
                result.append(char)
                prevWasLower = char.isLowercase
            }
        }
        // Collapse any accidental double underscores.
        while result.contains("__") {
            result = result.replacingOccurrences(of: "__", with: "_")
        }
        return result
    }
}
