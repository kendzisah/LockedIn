/**
 * AuthService — Wraps Supabase auth methods with email/Apple Sign-In support.
 *
 * Methods:
 * - signUpWithEmail: Create new account
 * - signInWithEmail: Sign in with email/password
 * - signInWithApple: Apple Sign-In via expo-apple-authentication
 * - linkEmailPassword: Attach email/password to current session (e.g. anonymous → permanent)
 * - linkAppleAccount: Same Apple flow as signInWithApple; links when an anonymous session is active
 * - signOut: Sign out and return to anonymous mode
 * - getCurrentUser: Get current user session
 * - onAuthStateChange: Listen for auth state changes
 */

import { type User, type Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ensureAnonymousSession } from '@lockedin/supabase-client';
import { ENV } from '../../config/env';
import { SupabaseService } from '../../services/SupabaseService';

export interface AuthError {
  message: string;
  code?: string;
}

/** User-facing copy for Apple sheet dismiss / cancel (avoid exposing raw system strings). */
export const MSG_APPLE_AUTH_FAILED =
  'There was a problem signing you in. Try again';

/** Shown when email is already tied to another account (sign-up or guest→email link). */
const MSG_EMAIL_ALREADY_REGISTERED =
  'This email already has an account. Use Sign In with your password, or open Sign In and tap Forgot password to reset it.';

/** After sign-up / guest→email, Supabase often returns invalid_credentials until the address is verified. */
const MSG_CONFIRM_EMAIL_TO_FINISH =
  'Check your email and open the confirmation link to finish setting up your account. After that, sign in with this email and password.';

function isAppleUserCancellation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code;
  if (code === 'ERR_CANCELED') return true;
  const m = err.message.toLowerCase();
  if (m.includes('cancel') || m.includes('canceled') || m.includes('cancelled')) return true;
  return false;
}

function isLikelyAwaitingEmailVerification(
  userHint: User | null | undefined,
  isAnonymousSession: boolean,
): boolean {
  if (!userHint) return isAnonymousSession;
  if (isAnonymousSession) return true;
  return Boolean(userHint.email && !userHint.email_confirmed_at);
}

/**
 * Maps signInWithPassword failures right after signUp / updateUser(email+password).
 * Do not treat invalid_credentials as "email taken" while confirmation is still pending.
 */
function messageForProvisionFollowUpSignInFailure(
  errCode: string | undefined,
  errMsg: string,
  userHint: User | null | undefined,
  isAnonymousSession: boolean,
): string {
  const msgLower = (errMsg ?? '').toLowerCase();
  const needsConfirm =
    errCode === 'email_not_confirmed' ||
    /not\s+confirmed|confirm\s+your\s+email|verify\s+your\s+email/i.test(errMsg ?? '');
  const invalidCreds =
    errCode === 'invalid_credentials' ||
    msgLower.includes('invalid login credentials') ||
    msgLower.includes('invalid credentials');
  if (
    needsConfirm ||
    (invalidCreds &&
      isLikelyAwaitingEmailVerification(userHint, isAnonymousSession))
  ) {
    return MSG_CONFIRM_EMAIL_TO_FINISH;
  }
  return mapPostSignUpSignInError(errCode, errMsg ?? '');
}

function isDuplicateSignupUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const identities = user.identities ?? [];
  return identities.length === 0;
}

function mapSignUpError(code: string | undefined, message: string): string {
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    code === 'identity_already_exists'
  ) {
    return MSG_EMAIL_ALREADY_REGISTERED;
  }
  if (/already\s+been\s+registered|already\s+registered|user\s+already\s+exists/i.test(message)) {
    return MSG_EMAIL_ALREADY_REGISTERED;
  }
  return message;
}

/** Guest linking email/password via updateUser — server errors are often misleading vs. mail templates. */
function mapLinkEmailError(code: string | undefined, message: string): string {
  if (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    code === 'identity_already_exists' ||
    code === 'email_conflict_identity_not_deletable'
  ) {
    return MSG_EMAIL_ALREADY_REGISTERED;
  }
  // Supabase returns this when the new password matches the current one; during anonymous→email
  // that reads like "pick another password" while the real issue is usually an existing account
  // or a confirm-email / change-email flow — steer users to Sign In instead.
  if (code === 'same_password' || /same\s+password|different\s+from\s+the\s+old\s+password/i.test(message)) {
    return MSG_EMAIL_ALREADY_REGISTERED;
  }
  if (/already\s+been\s+registered|already\s+registered|email.*taken/i.test(message)) {
    return MSG_EMAIL_ALREADY_REGISTERED;
  }
  return message;
}

function mapPostSignUpSignInError(code: string | undefined, message: string): string {
  if (code === 'invalid_credentials') {
    return MSG_EMAIL_ALREADY_REGISTERED;
  }
  if (code === 'same_password') {
    return MSG_EMAIL_ALREADY_REGISTERED;
  }
  return message;
}

function withResolvedAuthCode(
  message: string,
  originalCode: string | undefined,
  duplicateCode = 'email_already_registered',
): { message: string; code: string | undefined } {
  return {
    message,
    code: message === MSG_EMAIL_ALREADY_REGISTERED ? duplicateCode : originalCode,
  };
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

class AuthServiceImpl {
  /**
   * Sign up with email and password.
   * Returns new user session.
   */
  async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<AuthResponse> {
    try {
      const client = SupabaseService.getClient();
      if (!client) {
        return {
          user: null,
          session: null,
          error: { message: 'Supabase client not initialized' },
        };
      }

      const {
        data: { session: priorSession },
      } = await client.auth.getSession();
      if (priorSession?.user?.is_anonymous) {
        return this.linkEmailPassword(email, password);
      }

      const { data, error } = await client.auth.signUp({
        email,
        password,
      });

      if (error) {
        const mapped = mapSignUpError(error.code, error.message ?? '');
        const { message, code } = withResolvedAuthCode(mapped, error.code);
        return {
          user: null,
          session: null,
          error: { message, code },
        };
      }

      let user = data.user;
      let session = data.session;

      // Supabase often returns 200 + a user with no identities when the email is already registered
      // (to avoid leaking whether the address exists). Do not follow up with sign-in or obfuscated UX.
      if (user && isDuplicateSignupUser(user)) {
        return {
          user: null,
          session: null,
          error: {
            message: MSG_EMAIL_ALREADY_REGISTERED,
            code: 'email_already_registered',
          },
        };
      }

      // When email confirmation is off, Supabase returns a session here.
      // When confirmation is on, session is null — user must confirm before sign-in.
      if (user && !session) {
        return {
          user,
          session: null,
          error: {
            message: MSG_CONFIRM_EMAIL_TO_FINISH,
            code: 'email_confirmation_pending',
          },
        };
      }

      return {
        user,
        session,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        user: null,
        session: null,
        error: { message },
      };
    }
  }

  /**
   * Sign in with email and password.
   * Returns user session.
   */
  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<AuthResponse> {
    try {
      const client = SupabaseService.getClient();
      if (!client) {
        return {
          user: null,
          session: null,
          error: { message: 'Supabase client not initialized' },
        };
      }

      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          user: null,
          session: null,
          error: { message: error.message, code: error.code },
        };
      }

      return {
        user: data.user,
        session: data.session,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        user: null,
        session: null,
        error: { message },
      };
    }
  }

  /**
   * Sign in with Apple via expo-apple-authentication.
   * Creates or links Apple identity.
   */
  async signInWithApple(): Promise<AuthResponse> {
    try {
      // Check if Apple authentication is available
      if (!(await AppleAuthentication.isAvailableAsync())) {
        return {
          user: null,
          session: null,
          error: { message: 'Apple Sign-In not available on this device' },
        };
      }

      const client = SupabaseService.getClient();
      if (!client) {
        return {
          user: null,
          session: null,
          error: { message: 'Supabase client not initialized' },
        };
      }

      // Request Apple credentials
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return {
          user: null,
          session: null,
          error: { message: 'Failed to get Apple identity token' },
        };
      }

      // signInWithIdToken works for both fresh sign-in and anonymous→Apple linking.
      // When called with an active anonymous session, Supabase links the Apple identity
      // to the existing user (preserving the UUID) as long as anonymous sign-ins are enabled.
      // NOTE: linkIdentity is for OAuth redirect flows (web), not native ID token flows.
      const { data, error } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        return {
          user: null,
          session: null,
          error: { message: error.message, code: error.code },
        };
      }

      return {
        user: data.user,
        session: data.session,
        error: null,
      };
    } catch (err) {
      if (isAppleUserCancellation(err)) {
        return {
          user: null,
          session: null,
          error: { message: MSG_APPLE_AUTH_FAILED, code: 'ERR_CANCELED' },
        };
      }

      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        user: null,
        session: null,
        error: { message },
      };
    }
  }

  /**
   * Link email and password to the current user (e.g. convert anonymous → permanent).
   * UUID stays the same; updateUser does not return a new session.
   *
   * When email confirmation is disabled (recommended for mobile), the conversion
   * happens immediately and is_anonymous flips to false after a session refresh.
   *
   * When email confirmation is enabled, Supabase puts the email into email_change
   * (pending confirmation) and is_anonymous stays true. Do NOT try signInWithPassword
   * in that state — it will always fail since the email isn't on the user yet.
   */
  async linkEmailPassword(
    email: string,
    password: string,
  ): Promise<AuthResponse> {
    try {
      const client = SupabaseService.getClient();
      if (!client) {
        return {
          user: null,
          session: null,
          error: { message: 'Supabase client not initialized' },
        };
      }

      const { data, error } = await client.auth.updateUser({
        email,
        password,
      });

      if (error) {
        const mapped = mapLinkEmailError(error.code, error.message ?? '');
        const { message, code } = withResolvedAuthCode(mapped, error.code);
        return {
          user: null,
          session: null,
          error: { message, code },
        };
      }

      // Refresh JWT so is_anonymous claim updates (works when email confirmation is off).
      const { error: refreshErr } = await client.auth.refreshSession();
      if (refreshErr) {
        console.warn('[AuthService] linkEmailPassword refreshSession:', refreshErr.message);
      }

      const {
        data: { session },
      } = await client.auth.getSession();
      const user = session?.user ?? data.user ?? null;

      // Conversion succeeded — email confirmation is off, user is now permanent.
      if (user && !user.is_anonymous) {
        return { user, session, error: null };
      }

      // Still anonymous = email confirmation is pending.
      // The email is in email_change, not email. signInWithPassword would fail here.
      return {
        user: data.user ?? null,
        session: null,
        error: {
          message: MSG_CONFIRM_EMAIL_TO_FINISH,
          code: 'email_confirmation_pending',
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        user: null,
        session: null,
        error: { message },
      };
    }
  }

  /**
   * Link Apple identity to the current session (delegates to signInWithApple,
   * which uses linkIdentity when the session is anonymous).
   */
  async linkAppleAccount(): Promise<AuthResponse> {
    return this.signInWithApple();
  }

  async resetPasswordForEmail(email: string): Promise<{ error: AuthError | null }> {
    try {
      const client = SupabaseService.getClient();
      if (!client) {
        return { error: { message: 'Supabase client not initialized' } };
      }

      const trimmed = email.trim();
      if (!trimmed) {
        return { error: { message: 'Email is required' } };
      }

      const { error } = await client.auth.resetPasswordForEmail(trimmed, {
        redirectTo: ENV.SUPABASE_PASSWORD_RESET_REDIRECT,
      });

      if (error) {
        return { error: { message: error.message, code: error.code } };
      }
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { error: { message } };
    }
  }

  /**
   * Sign out current user and clear session.
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const client = SupabaseService.getClient();
      if (!client) {
        return { error: { message: 'Supabase client not initialized' } };
      }

      const { error } = await client.auth.signOut();

      if (error) {
        return { error: { message: error.message, code: error.code } };
      }

      try {
        await ensureAnonymousSession(client);
      } catch (e) {
        console.warn('[AuthService] signOut: could not restore anonymous session:', e);
      }

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { error: { message } };
    }
  }

  /**
   * Get current user and session.
   */
  async getCurrentUser(): Promise<{
    user: User | null;
    session: Session | null;
  }> {
    try {
      const client = SupabaseService.getClient();
      if (!client) {
        return { user: null, session: null };
      }

      const { data, error } = await client.auth.getSession();

      if (error) {
        console.warn('[AuthService] Failed to get session:', error.message);
        return { user: null, session: null };
      }

      return {
        user: data.session?.user ?? null,
        session: data.session ?? null,
      };
    } catch (err) {
      console.warn(
        '[AuthService] Error getting current user:',
        err instanceof Error ? err.message : 'Unknown error',
      );
      return { user: null, session: null };
    }
  }

  /**
   * Listen for auth state changes.
   * Returns unsubscribe function.
   */
  onAuthStateChange(
    callback: (user: User | null, session: Session | null) => void,
  ): (() => void) | null {
    try {
      const client = SupabaseService.getClient();
      if (!client) {
        return null;
      }

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        callback(session?.user ?? null, session ?? null);
      });

      return () => subscription?.unsubscribe();
    } catch (err) {
      console.warn(
        '[AuthService] Failed to set up auth state listener:',
        err instanceof Error ? err.message : 'Unknown error',
      );
      return null;
    }
  }
}

export const AuthService = new AuthServiceImpl();
