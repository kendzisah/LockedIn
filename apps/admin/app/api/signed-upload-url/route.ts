import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@lockedin/supabase-client';
import { requireAdmin } from '../../../lib/require-admin';

/** Allowed storage buckets — reject requests for any other bucket. */
const ALLOWED_BUCKETS = new Set(['audio']);

/** Path validation — only allow safe characters. */
const SAFE_PATH_RE = /^[a-zA-Z0-9_\-/.]+$/;

export async function POST(request: NextRequest) {
  // ── Auth gate (defence-in-depth, not relying on middleware alone) ──
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const body = await request.json();
  const { bucket, path } = body as { bucket: string; path: string };

  if (!bucket || !path) {
    return NextResponse.json(
      { error: 'bucket and path are required' },
      { status: 400 },
    );
  }

  // ── Restrict to allowed buckets ──
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json(
      { error: 'Invalid bucket' },
      { status: 403 },
    );
  }

  // ── Validate path format (no path traversal) ──
  if (!SAFE_PATH_RE.test(path) || path.includes('..')) {
    return NextResponse.json(
      { error: 'Invalid path' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create upload URL' },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
