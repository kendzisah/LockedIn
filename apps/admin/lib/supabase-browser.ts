import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client -- anon key only, for auth session state.
 * All data mutations must go through server actions / API routes.
 */
export function getBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
