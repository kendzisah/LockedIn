/**
 * AuthProvider — React context for managing authentication state.
 *
 * Provides:
 * - user: Current authenticated user (null if anonymous/not logged in)
 * - isAuthenticated: Boolean flag for logged-in users
 * - isAnonymous: Boolean flag for anonymous users
 * - signUp, signIn, signInWithApple, signOut: Auth methods
 *
 * On mount, checks current Supabase session and listens for auth changes.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { type User } from '@supabase/supabase-js';
import { AuthService, type AuthError } from './AuthService';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  isLoading: boolean;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signInWithApple: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null && !user.is_anonymous;
  const isAnonymous = user?.is_anonymous ?? false;

  // On mount, check current session and set up listener
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      try {
        // Check current session
        const { user: currentUser } = await AuthService.getCurrentUser();
        setUser(currentUser);

        // Set up listener for future changes
        unsubscribe = AuthService.onAuthStateChange(
          (newUser) => {
            setUser(newUser);
          },
        );
      } catch (err) {
        console.warn('[AuthProvider] Failed to initialize auth:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      unsubscribe?.();
    };
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ error: AuthError | null }> => {
      const response = await AuthService.signUpWithEmail(email, password);
      if (!response.error && response.user) {
        setUser(response.user);
      }
      return { error: response.error };
    },
    [],
  );

  const signIn = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ error: AuthError | null }> => {
      const response = await AuthService.signInWithEmail(email, password);
      if (!response.error && response.user) {
        setUser(response.user);
      }
      return { error: response.error };
    },
    [],
  );

  const signInWithApple = useCallback(
    async (): Promise<{ error: AuthError | null }> => {
      const response = await AuthService.signInWithApple();
      if (!response.error && response.user) {
        setUser(response.user);
      }
      return { error: response.error };
    },
    [],
  );

  const signOut = useCallback(
    async (): Promise<{ error: AuthError | null }> => {
      const response = await AuthService.signOut();
      if (!response.error) {
        setUser(null);
      }
      return response;
    },
    [],
  );

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isAnonymous,
    isLoading,
    signUp,
    signIn,
    signInWithApple,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use auth context.
 * Must be called from within <AuthProvider>.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return context;
};
