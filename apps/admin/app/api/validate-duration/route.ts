import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@lockedin/supabase-client';

/**
 * Advisory duration check — returns audio length vs session slot for info purposes.
 * Duration is the general session length, NOT the required audio length.
 * Always returns valid: true (audio can be any length).
 */
export async function POST(request: NextRequest) {
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
    valid: true, // duration is advisory, not a hard constraint
    actualDurationSeconds: track.duration_seconds,
    expectedDurationSeconds,
    diffSeconds: Math.abs(track.duration_seconds - expectedDurationSeconds),
  });
}
