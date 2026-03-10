import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS ?? '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as any);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Fast-fail: no user or email not in allowlist
  // RLS on profiles.role='admin' is the real authorization gate
  if (!user || !ALLOWED_EMAILS.includes(user.email ?? '')) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/program/:path*', '/api/:path*'],
};
