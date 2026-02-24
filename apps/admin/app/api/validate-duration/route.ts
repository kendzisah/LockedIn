import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@lockedin/supabase-client';
import { requireAdmin } from '../../../lib/require-admin';

/**
 * Advisory duration check — returns audio length vs session slot for info purposes.
 * Duration is the general session length, NOT the required audio length.
 * Always returns valid: true (audio can be any length).
 */
export async function POST(request: NextRequest) {
  // ── Auth gate (defence-in-depth) ──
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const body = await request.json();
  const { audioTrackId, expectedDurationSeconds } = body as {
    audioTrackId: string;
    expectedDurationSeconds: number;
  };

  if (!audioTrackId || !expectedDurationSeconds) {
    return NextResponse.json(
      { error: 'audioTrackId and expectedDurationSeconds are required' },
      { status: 400 },
    );
  }

  // Validate UUID format to prevent injection
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(audioTrackId)) {
    return NextResponse.json(
      { error: 'Invalid audioTrackId format' },
      { status: 400 },
    );
  }

  const { data: track, error } = await supabase
    .from('audio_tracks')
    .select('duration_seconds')
    .eq('id', audioTrackId)
    .single() as { data: { duration_seconds: number } | null; error: unknown };

  if (error || !track) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? 'Track not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    valid: true,
    actualDurationSeconds: track.duration_seconds,
    expectedDurationSeconds,
    diffSeconds: Math.abs(track.duration_seconds - expectedDurationSeconds),
  });
}
