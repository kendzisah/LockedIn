import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Mobile client: anonymous auth, anon key only.
 * Call ensureAnonymousSession() after creating.
 */
export function createMobileClient(url: string, anonKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
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
