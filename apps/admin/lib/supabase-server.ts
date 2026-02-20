import 'server-only';
import { createAdminClient } from '@lockedin/supabase-client';

/**
 * Server-only Supabase client using service role key.
 * NEVER import this file in client components.
 */
export function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
