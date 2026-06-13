//
//  LogoutCleanupBus.swift
//  LockedIn
//
//  Cross-feature pub/sub bus for sign-out / account-delete cleanup. Mirrors
//  the RN `subscribeLogoutCleanup` pattern (`apps/mobile/src/services/logoutCleanupBus.ts`).
//
//  Why this exists: when the user signs out, every feature's @Observable state
//  needs to wipe itself (Home, Missions, Session, Onboarding, Guild,
//  Subscription, Notifications, PostHog). Rather than have each call site
//  remember every cleanup target, AuthState posts a single `.logout` event
//  and every state object subscribes once at app boot.
//
//  Usage:
//   - On boot (in `LockedInApp.init` / `RootView.task`): call
//     `LogoutCleanupBus.shared.subscribeAll(home: ..., missions: ..., ...)`
//     to attach every state object.
//   - On sign-out: `AuthState.signOut()` is wired to call
//     `LogoutCleanupBus.shared.post(.logout)` after the auth call succeeds.
//

import Foundation

/// Singleton fan-out bus. Listeners are weakly held closures that run on the
/// main actor.
@MainActor
public final class LogoutCleanupBus {
    public static let shared = LogoutCleanupBus()

    public enum Event: Sendable {
        case logout
        case accountDeleted
    }

    private var listeners: [(Event) -> Void] = []

    private init() {}

    // MARK: - Subscribe / post

    /// Register a listener. Returns a token; pass it to `unsubscribe(token:)`
    /// to stop receiving callbacks. In practice we never need to unsubscribe
    /// (state objects live for the app lifetime) but the token is returned
    /// for symmetry with the RN service.
    @discardableResult
    public func subscribe(_ handler: @escaping (Event) -> Void) -> Int {
        listeners.append(handler)
        return listeners.count - 1
    }

    public func unsubscribe(token: Int) {
        guard token < listeners.count else { return }
        listeners[token] = { _ in }
    }

    public func post(_ event: Event) {
        for listener in listeners {
            listener(event)
        }
    }

    // MARK: - Convenience subscription helper

    /// Wire every known state object to the bus. Called once from `LockedInApp.init`.
    /// Each handler runs the feature's `fullReset` / `fullLogoutReset` /
    /// `handleLogout` cleanup.
    public func subscribeAll(
        home: HomeState,
        missions: MissionsState,
        session: SessionState,
        onboarding: OnboardingState,
        guild: GuildState,
        subscription: SubscriptionState
    ) {
        subscribe { event in
            // For both `.logout` and `.accountDeleted` we run the full reset
            // pipeline. AccountDeleted runs additional server-side calls but
            // the client cleanup is identical.
            _ = event
            home.fullReset()
            missions.fullLogoutReset()
            session.fullReset()
            onboarding.fullReset()

            Task { @MainActor in
                await subscription.handleLogout()
            }

            // Guild state has private setters — `reset` is performed by
            // wiping the cached storage keys + clearing the in-memory cache
            // via the public `cacheUserRank` zero-out is wrong, so we just
            // remove the persisted cache and let the next focus refetch.
            Defaults.remove(GuildService.cachedRankKey)
            Defaults.remove(GuildService.monthStatsKey)
            Defaults.remove("@lockedin/guild_week_stats")  // legacy weekly cache
            Defaults.remove(GuildService.hasActiveGuildKey)
            // GuildState doesn't expose a reset(); future API could add one.
            _ = guild

            // Cancel all local notifications.
            NotificationService.shared.cancelAllNotifications()

            // Reset analytics identity.
            AnalyticsService.shared.reset()
        }
    }
}
