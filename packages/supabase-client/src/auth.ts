import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ensure the mobile app has an active anonymous session.
 * - If a session exists (persisted), reuse it.
 * - If no session, sign in anonymously.
 * - Returns the user ID (stable across app restarts, lost on reinstall).
 *
 * Device reinstall: user gets a new anonymous ID. Streak data is lost.
 * Future mitigation: account linking (Apple Sign-In / email).
 */
export async function ensureAnonymousSession(
  client: SupabaseClient,
): Promise<string> {
  // Check for existing session
  const { data: { session } } = await client.auth.getSession();

  if (session?.user) {
    return session.user.id;
  }

  // No session -- sign in anonymously
  const { data, error } = await client.auth.signInAnonymously();

  if (error || !data.user) {
    throw new Error(`Anonymous sign-in failed: ${error?.message ?? 'unknown'}`);
  }

  return data.user.id;
}
