/**
 * AuthService — Wraps Supabase auth methods with email/Apple Sign-In support.
 *
 * Methods:
 * - signUpWithEmail: Create new account
 * - signInWithEmail: Sign in with email/password
 * - signInWithApple: Apple Sign-In via expo-apple-authentication
 * - signOut: Sign out and return to anonymous mode
 * - getCurrentUser: Get current user session
 * - onAuthStateChange: Listen for auth state changes
 */

import { type User, type Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SupabaseService } from '../../services/SupabaseService';

export interface AuthError {
  message: string;
  code?: string;
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

      const { data, error } = await client.auth.signUp({
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

      // Sign in with Supabase using Apple token
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
      // Handle user cancellation
      if (
        err instanceof Error &&
        (err as any).code === 'ERR_CANCELED'
      ) {
        return {
          user: null,
          session: null,
          error: { message: 'Apple Sign-In cancelled' },
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
