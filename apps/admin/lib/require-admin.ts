import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ALLOWED_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

/**
 * Verify the request is from an authenticated admin.
 *
 * Defence-in-depth: API routes must NOT rely solely on middleware.
 * This checks:
 *  1. Valid Supabase session exists (cookie-based)
 *  2. User email is in the server-side allowlist
 *
 * Returns the authenticated user on success, or a 401/403 NextResponse on failure.
 */
export async function requireAdmin(): Promise<
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse }
> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // API routes don't need to set cookies
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      ),
    };
  }

  if (!ALLOWED_EMAILS.includes(user.email ?? '')) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, userId: user.id, email: user.email! };
}
