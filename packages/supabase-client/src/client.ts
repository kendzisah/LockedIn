import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Storage adapter interface for Supabase auth session persistence.
 * Matches the contract expected by @supabase/supabase-js.
 */
export interface StorageAdapter {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

/**
 * Mobile client: anonymous auth, anon key only.
 * Call ensureAnonymousSession() after creating.
 *
 * @param storage - Custom storage adapter (e.g., SecureStore for RN).
 *   If omitted, uses the default (localStorage on web, AsyncStorage on RN).
 */
export function createMobileClient(
  url: string,
  anonKey: string,
  storage?: StorageAdapter,
): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      ...(storage ? { storage } : {}),
    },
  });
}

/**
 * Admin server client: service role key, NO session persistence.
 * Only import in server actions / API routes. Never in client components.
 */
export function createAdminClient(url: string, serviceRoleKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
