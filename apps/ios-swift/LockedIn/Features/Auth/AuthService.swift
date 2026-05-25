import Foundation
import AuthenticationServices
import Supabase

/// Swift port of `apps/mobile/src/features/auth/AuthService.ts`.
///
/// Wraps `supabase-swift` auth methods with email + Apple Sign-In support.
/// Public surface mirrors the RN service 1:1:
/// - `signInAnonymous()`
/// - `signUpWithEmail(email:password:)`
/// - `signInWithEmail(email:password:)`
/// - `sendPasswordReset(email:)`
/// - `signInWithApple()`
/// - `linkAnonymousToEmail(email:password:)`
/// - `linkAnonymousToApple()`
/// - `signOut()`
/// - `deleteAccount()`     — calls the `delete_own_account` RPC
public final class AuthService {

    // MARK: - User-facing copy (preserved verbatim from RN)

    /// Shown when the Apple sheet is cancelled or fails. Mirrors
    /// `MSG_APPLE_AUTH_FAILED` in RN AuthService.
    public static let messageAppleAuthFailed =
        "There was a problem signing you in. Try again"

    /// Shown when the email is already tied to another account.
    /// Mirrors `MSG_EMAIL_ALREADY_REGISTERED` in RN AuthService.
    public static let messageEmailAlreadyRegistered =
        "This email already has an account. Use Sign In with your password, or open Sign In and tap Forgot password to reset it."

    /// Shown when email confirmation is still pending after sign-up / link.
    /// Mirrors `MSG_CONFIRM_EMAIL_TO_FINISH` in RN AuthService.
    public static let messageConfirmEmailToFinish =
        "Check your email and open the confirmation link to finish setting up your account. After that, sign in with this email and password."

    // MARK: - Singleton

    public static let shared = AuthService()
    private init() {}

    // MARK: - Result type

    public struct AuthError {
        public let message: String
        public let code: String?

        public init(message: String, code: String? = nil) {
            self.message = message
            self.code = code
        }
    }

    public struct Result {
        public let user: User?
        public let session: Session?
        public let error: AuthError?

        public init(user: User? = nil, session: Session? = nil, error: AuthError? = nil) {
            self.user = user
            self.session = session
            self.error = error
        }
    }

    // MARK: - Convenience access

    private var client: SupabaseClient { LockedInSupabase.shared.client }

    // MARK: - Anonymous

    /// Sign in anonymously. The fresh-install / re-anonymous flow lives in
    /// `AuthState.start()` to mirror RN's `SupabaseService.initialize`.
    public func signInAnonymous() async -> Result {
        do {
            let session = try await client.auth.signInAnonymously()
            return Result(user: session.user, session: session, error: nil)
        } catch {
            return Result(error: AuthError(message: error.localizedDescription))
        }
    }

    // MARK: - Email / password

    /// Mirrors RN `AuthService.signUpWithEmail`:
    /// - If the current session is anonymous, delegate to
    ///   `linkAnonymousToEmail` (preserves UUID).
    /// - Otherwise call `auth.signUp`.
    /// - Detect duplicate-signup (Supabase returns 200 + user with no
    ///   identities) and surface as `email_already_registered`.
    /// - If a user is returned without a session, return
    ///   `email_confirmation_pending`.
    public func signUpWithEmail(email: String, password: String) async -> Result {
        do {
            // If signed in anonymously, link instead of creating a new user.
            if let priorSession = try? await client.auth.session,
               priorSession.user.resolvedIsAnonymous {
                return await linkAnonymousToEmail(email: email, password: password)
            }

            let response = try await client.auth.signUp(email: email, password: password)
            let createdUser: User = response.user
            let createdSession: Session? = response.session

            // Supabase returns 200 + a user with empty identities when the
            // address is already registered (to avoid leaking existence).
            if isDuplicateSignupUser(createdUser) {
                return Result(
                    user: nil,
                    session: nil,
                    error: AuthError(
                        message: Self.messageEmailAlreadyRegistered,
                        code: "email_already_registered"
                    )
                )
            }

            // When email confirmation is on, session is nil — user must
            // confirm before sign-in.
            if createdSession == nil {
                return Result(
                    user: createdUser,
                    session: nil,
                    error: AuthError(
                        message: Self.messageConfirmEmailToFinish,
                        code: "email_confirmation_pending"
                    )
                )
            }

            return Result(user: createdUser, session: createdSession, error: nil)
        } catch {
            let (message, code) = mapSignUpError(error)
            return Result(error: AuthError(message: message, code: code))
        }
    }

    public func signInWithEmail(email: String, password: String) async -> Result {
        do {
            let session = try await client.auth.signIn(email: email, password: password)
            return Result(user: session.user, session: session, error: nil)
        } catch {
            return Result(error: AuthError(message: errorMessage(error), code: errorCode(error)))
        }
    }

    public func sendPasswordReset(email: String) async -> Result {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return Result(error: AuthError(message: "Email is required"))
        }
        let redirect = LockedInConfig.url(.supabasePasswordResetRedirect)
            ?? URL(string: "https://locked-in.co/auth/callback?next=/auth/reset-password")
        do {
            try await client.auth.resetPasswordForEmail(trimmed, redirectTo: redirect)
            return Result()
        } catch {
            return Result(error: AuthError(message: errorMessage(error), code: errorCode(error)))
        }
    }

    // MARK: - Apple Sign-In

    /// Native Apple Sign-In flow. Requests FULL_NAME + EMAIL scopes (matches
    /// RN), retrieves the identity token, and forwards it to Supabase via
    /// `signInWithIdToken(provider:.apple, idToken:)`.
    ///
    /// When called with an active anonymous session, Supabase **links** the
    /// Apple identity to the existing user (preserving the UUID). No
    /// `linkIdentity()` call needed — that path is for OAuth redirect flows.
    public func signInWithApple() async -> Result {
        // Fetch the Apple credential first.
        let credential: ASAuthorizationAppleIDCredential
        do {
            credential = try await AppleSignInCoordinator.requestCredential()
        } catch AppleSignInCoordinator.SignInError.canceled {
            return Result(error: AuthError(
                message: Self.messageAppleAuthFailed,
                code: "ERR_CANCELED"
            ))
        } catch {
            return Result(error: AuthError(message: errorMessage(error)))
        }

        guard let tokenData = credential.identityToken,
              let idToken = String(data: tokenData, encoding: .utf8)
        else {
            return Result(error: AuthError(message: "Failed to get Apple identity token"))
        }

        do {
            let session = try await client.auth.signInWithIdToken(
                credentials: OpenIDConnectCredentials(
                    provider: .apple,
                    idToken: idToken,
                    nonce: AppleSignInCoordinator.currentNonce
                )
            )
            return Result(user: session.user, session: session, error: nil)
        } catch {
            return Result(error: AuthError(message: errorMessage(error), code: errorCode(error)))
        }
    }

    // MARK: - Linking (anonymous → permanent)

    /// Mirrors RN `linkEmailPassword`. Calls `auth.updateUser(email:password:)`,
    /// refreshes the session so the `is_anonymous` claim flips, and returns
    /// either:
    /// - success when `is_anonymous == false` post-refresh, or
    /// - `email_confirmation_pending` when it stayed true (the email is in
    ///   `email_change`, awaiting confirmation).
    public func linkAnonymousToEmail(email: String, password: String) async -> Result {
        do {
            let updated = try await client.auth.update(
                user: UserAttributes(email: email, password: password)
            )

            // Refresh JWT so is_anonymous claim updates (when confirmation off).
            _ = try? await client.auth.refreshSession()

            let refreshed = try? await client.auth.session
            let resolvedUser: User = refreshed?.user ?? updated
            if !resolvedUser.resolvedIsAnonymous {
                return Result(user: resolvedUser, session: refreshed, error: nil)
            }

            // Still anonymous → email confirmation is pending.
            return Result(
                user: resolvedUser,
                session: nil,
                error: AuthError(
                    message: Self.messageConfirmEmailToFinish,
                    code: "email_confirmation_pending"
                )
            )
        } catch {
            let (message, code) = mapLinkEmailError(error)
            return Result(error: AuthError(message: message, code: code))
        }
    }

    /// Apple linking just delegates to `signInWithApple` — when the current
    /// session is anonymous, Supabase links the identity instead of creating
    /// a new user (same as the RN code).
    public func linkAnonymousToApple() async -> Result {
        await signInWithApple()
    }

    // MARK: - Sign-out

    /// Sign out and immediately restore an anonymous session so the user
    /// stays inside the app (matches RN behavior).
    public func signOut() async -> Result {
        do {
            try await client.auth.signOut()
        } catch {
            return Result(error: AuthError(message: errorMessage(error), code: errorCode(error)))
        }

        do {
            _ = try await client.auth.signInAnonymously()
        } catch {
            // Don't fail signOut just because anon couldn't be restored.
            print("[AuthService] signOut: could not restore anonymous session:", error)
        }
        return Result()
    }

    // MARK: - Delete account (RPC: delete_own_account)

    /// Calls the `delete_own_account` Supabase RPC. The function cascades
    /// through `guilds`, `guild_members`, `guild_scores`, `profiles`, and
    /// `auth.users`. Caller is expected to clear any local state above this.
    public func deleteAccount() async -> Result {
        do {
            try await client.rpc("delete_own_account").execute()
            return Result()
        } catch {
            return Result(error: AuthError(message: errorMessage(error), code: errorCode(error)))
        }
    }

    // MARK: - Internal helpers

    private func isDuplicateSignupUser(_ user: User?) -> Bool {
        guard let identities = user?.identities else { return false }
        return identities.isEmpty
    }

    private func mapSignUpError(_ error: Error) -> (String, String?) {
        let code = errorCode(error)
        let rawMessage = errorMessage(error)
        let lower = rawMessage.lowercased()

        if code == "user_already_exists"
            || code == "email_exists"
            || code == "identity_already_exists" {
            return (Self.messageEmailAlreadyRegistered, "email_already_registered")
        }
        if lower.contains("already been registered")
            || lower.contains("already registered")
            || lower.contains("user already exists") {
            return (Self.messageEmailAlreadyRegistered, "email_already_registered")
        }
        return (rawMessage, code)
    }

    private func mapLinkEmailError(_ error: Error) -> (String, String?) {
        let code = errorCode(error)
        let rawMessage = errorMessage(error)
        let lower = rawMessage.lowercased()

        if code == "email_exists"
            || code == "user_already_exists"
            || code == "identity_already_exists"
            || code == "email_conflict_identity_not_deletable" {
            return (Self.messageEmailAlreadyRegistered, "email_already_registered")
        }
        // Supabase returns this when the new password matches the current one;
        // during anonymous→email it reads like "pick another password" while
        // the real issue is usually an existing account.
        if code == "same_password"
            || lower.contains("same password")
            || lower.contains("different from the old password") {
            return (Self.messageEmailAlreadyRegistered, "email_already_registered")
        }
        if lower.contains("already been registered")
            || lower.contains("already registered")
            || (lower.contains("email") && lower.contains("taken")) {
            return (Self.messageEmailAlreadyRegistered, "email_already_registered")
        }
        return (rawMessage, code)
    }

    private func errorMessage(_ error: Error) -> String {
        // `supabase-swift` errors generally implement LocalizedError. Fall back to description.
        if let localized = (error as? LocalizedError)?.errorDescription {
            return localized
        }
        return String(describing: error)
    }

    /// Best-effort extraction of an error "code" from a `supabase-swift` Error.
    /// supabase-swift surfaces backend errors with embedded code fields; this
    /// helper digs through `localizedDescription` / mirror children so the
    /// migrated mappers can branch on `email_exists`, `invalid_credentials`,
    /// etc. without coupling to a specific error type that may change between
    /// supabase-swift versions.
    private func errorCode(_ error: Error) -> String? {
        let mirror = Mirror(reflecting: error)
        for child in mirror.children {
            if child.label == "errorCode" || child.label == "code" {
                if let s = child.value as? String { return s }
            }
            // Inspect one level deeper (e.g. associated values on enums).
            let inner = Mirror(reflecting: child.value)
            for nested in inner.children {
                if nested.label == "errorCode" || nested.label == "code" {
                    if let s = nested.value as? String { return s }
                }
            }
        }
        return nil
    }
}

// MARK: - User isAnonymous helper

extension User {
    /// Normalized `is_anonymous` accessor that works across supabase-swift
    /// 2.x versions. Newer SDKs expose `isAnonymous: Bool` directly on
    /// `User`; older builds only set `app_metadata.is_anonymous`. We
    /// inspect both via reflection so this code compiles regardless of
    /// which SDK version is resolved.
    var resolvedIsAnonymous: Bool {
        let mirror = Mirror(reflecting: self)
        for child in mirror.children where child.label == "isAnonymous" {
            if let v = child.value as? Bool { return v }
            if let v = child.value as? Bool?, let unwrapped = v { return unwrapped }
        }
        if let json = appMetadata["is_anonymous"] {
            let jsonMirror = Mirror(reflecting: json)
            for child in jsonMirror.children {
                if let b = child.value as? Bool { return b }
            }
        }
        return false
    }
}
