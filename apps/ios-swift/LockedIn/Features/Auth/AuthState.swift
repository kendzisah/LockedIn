import Foundation
import Observation
import Supabase

/// Mirrors the RN `AuthProvider` state shape (see
/// `apps/mobile/src/features/auth/AuthProvider.tsx`).
///
/// Provides:
/// - `user`: Current authenticated user (nil if no session)
/// - `isAuthenticated`: true when a non-anonymous user is signed in
/// - `isAnonymous`: true when the current session is anonymous
/// - `isLoading`: true while bootstrapping the auth listener / session
///
/// On `start()` (called once from the app root), the state object:
///   1. Subscribes to Supabase auth state changes
///   2. Loads the current session
///   3. Ensures an anonymous session exists if no user is signed in (mirrors
///      RN `SupabaseService.initialize` + `ensureAnonymousSession`).
///
/// Persisted keys (match RN exactly):
/// - `@lockedin/has_launched` — fresh-install heuristic that wipes a stale
///   Keychain session left over from a previous install before signing in
///   anonymously. Standard `UserDefaults`.
@MainActor
@Observable
public final class AuthState {
    // MARK: - Persisted key names (match RN exactly)

    /// Set on first successful boot. If missing, treat as a fresh install and
    /// `signOut()` before signing in anonymously to clear any stale session
    /// still present in the Keychain (which survives uninstall on iOS).
    /// Source: `apps/mobile/src/services/SupabaseService.ts:21`.
    public static let hasLaunchedKey = "@lockedin/has_launched"

    // MARK: - Observable state

    public private(set) var user: User?
    public private(set) var isLoading: Bool = true

    public var isAuthenticated: Bool {
        guard let user else { return false }
        return !user.resolvedIsAnonymous
    }

    public var isAnonymous: Bool {
        user?.resolvedIsAnonymous ?? false
    }

    // MARK: - Internal

    // Internal plumbing — not UI state, so excluded from observation tracking.
    // `Task` is thread-safe to cancel from any context; `nonisolated(unsafe)`
    // lets `deinit` cancel it without a main-actor hop.
    @ObservationIgnored private nonisolated(unsafe) var authChangesTask: Task<Void, Never>?
    private var didStart = false

    public init() {}

    // MARK: - Lifecycle

    /// Boot the auth subsystem. Safe to call multiple times (no-op after the
    /// first successful invocation).
    public func start() async {
        guard !didStart else { return }
        didStart = true

        // Subscribe first so we never miss a state event during bootstrap.
        attachListener()

        // Fresh-install heuristic: AsyncStorage is wiped on uninstall, but the
        // Keychain (where supabase-swift persists its session) survives. If
        // the flag is missing, sign out to clear any stale session.
        if Defaults.string(Self.hasLaunchedKey) == nil {
            try? await LockedInSupabase.shared.client.auth.signOut()
            Defaults.setString("true", Self.hasLaunchedKey)
        }

        // Make sure we always have at least an anonymous session.
        await ensureAnonymousSession()

        // Hydrate the user from the current session.
        await refreshCurrentUser()

        isLoading = false
    }

    /// Mirror of RN `ensureAnonymousSession` (packages/supabase-client/src/auth.ts).
    public func ensureAnonymousSession() async {
        let client = LockedInSupabase.shared.client
        do {
            let session = try? await client.auth.session
            if session?.user != nil {
                return
            }
            _ = try await client.auth.signInAnonymously()
        } catch {
            print("[AuthState] ensureAnonymousSession failed:", error)
        }
    }

    private func refreshCurrentUser() async {
        let client = LockedInSupabase.shared.client
        if let session = try? await client.auth.session {
            self.user = session.user
        } else {
            self.user = nil
        }
    }

    private func attachListener() {
        authChangesTask?.cancel()
        authChangesTask = Task { [weak self] in
            for await (_, session) in LockedInSupabase.shared.client.auth.authStateChanges {
                // Mirror the session to the App Group on EVERY change — including
                // silent SDK auto-refreshes (`.tokenRefreshed`) and `.initialSession`
                // — so the DAM extension always has a current token to credit guild
                // points in the background. Hooking only the `AuthService` methods
                // would miss those and let the mirror go stale.
                Self.mirrorSession(session)
                await MainActor.run {
                    self?.user = session?.user
                }
            }
        }
    }

    /// Write (or clear) the App-Group session mirror the DAM extension reads.
    /// `nonisolated static` so it runs off the main actor inside the listener loop.
    private nonisolated static func mirrorSession(_ session: Session?) {
        guard let session else {
            SupabaseAuthMirror.clearSession()
            return
        }
        SupabaseAuthMirror.writeSession(.init(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresAtMs: session.expiresAt * 1000
        ))
    }

    // MARK: - Auth operations (UI bindings)

    /// Sign up with email + password. If the current session is anonymous,
    /// the AuthService delegates to `linkEmailPassword` to preserve the UUID.
    public func signUp(email: String, password: String) async -> AuthService.Result {
        let result = await AuthService.shared.signUpWithEmail(email: email, password: password)
        if result.error == nil {
            await refreshCurrentUser()
        }
        return result
    }

    public func signIn(email: String, password: String) async -> AuthService.Result {
        let result = await AuthService.shared.signInWithEmail(email: email, password: password)
        if result.error == nil, let fresh = result.user {
            self.user = fresh
        }
        return result
    }

    public func signInWithApple() async -> AuthService.Result {
        let result = await AuthService.shared.signInWithApple()
        if result.error == nil, let fresh = result.user {
            self.user = fresh
        }
        return result
    }

    public func linkAccount(email: String, password: String) async -> AuthService.Result {
        let result = await AuthService.shared.linkAnonymousToEmail(email: email, password: password)
        if result.error == nil {
            await refreshCurrentUser()
        }
        return result
    }

    public func linkAppleAccount() async -> AuthService.Result {
        let result = await AuthService.shared.linkAnonymousToApple()
        if result.error == nil, let fresh = result.user {
            self.user = fresh
        }
        return result
    }

    public func signOut() async -> AuthService.Result {
        let result = await AuthService.shared.signOut()
        if result.error == nil {
            await refreshCurrentUser()
        }
        return result
    }

    public func resetPasswordForEmail(_ email: String) async -> AuthService.Result {
        await AuthService.shared.sendPasswordReset(email: email)
    }

    /// Calls the `delete_own_account` Supabase RPC. After deletion the
    /// supabase-swift client is signed out automatically by the server; we
    /// re-ensure an anonymous session so the user stays inside the app.
    public func deleteAccount() async -> AuthService.Result {
        let result = await AuthService.shared.deleteAccount()
        if result.error == nil {
            await ensureAnonymousSession()
            await refreshCurrentUser()
        }
        return result
    }

    deinit {
        authChangesTask?.cancel()
    }
}
