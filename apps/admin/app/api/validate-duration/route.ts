import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@lockedin/supabase-client';

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

  // Fetch the audio track to get its actual stored duration
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

  const tolerance = 0.1; // 10%
  const actualDuration = track.duration_seconds;
  const diff = Math.abs(actualDuration - expectedDurationSeconds);
  const isValid = diff <= expectedDurationSeconds * tolerance;

  return NextResponse.json({
    valid: isValid,
    actualDurationSeconds: actualDuration,
    expectedDurationSeconds,
    diffSeconds: diff,
  });
}
