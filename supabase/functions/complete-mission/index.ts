import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * complete-mission — Server-side mission completion with time-gate enforcement.
 *
 * Accepts: { timeGate?: string, focusMinutes: number, missionsDone: number, streakDays: number }
 * Auth: Bearer token from the mobile client (anon key + user JWT).
 *
 * 1. Validates the time gate against the server clock (UTC-based, converted to user's offset).
 * 2. Computes total_score server-side (prevents client-side score tampering).
 * 3. Upserts crew_scores for every crew the user belongs to.
 */

function computeTotalScore(focusMinutes: number, missionsDone: number, streakDays: number): number {
  return focusMinutes * 2 + missionsDone * 15 + streakDays * 10;
}

/** Check if a time gate like "After 9 PM" is satisfied given a UTC offset in minutes. */
function isTimeGateUnlocked(timeGate: string | undefined, utcOffsetMinutes: number): boolean {
  if (!timeGate) return true;
  const match = timeGate.match(/After (\d{1,2})\s*(AM|PM)/i);
  if (!match) return true;
  let hour = parseInt(match[1], 10);
  if (match[2].toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (match[2].toUpperCase() === 'AM' && hour === 12) hour = 0;

  // Compute user's local hour from server UTC + their offset
  const now = new Date();
  const userLocalMs = now.getTime() + utcOffsetMinutes * 60 * 1000;
  const userLocal = new Date(userLocalMs);
  const userHour = userLocal.getUTCHours();

  return userHour >= hour;
}

/** ISO week key (YYYY-Www) from a UTC timestamp adjusted by offset. */
function getWeekKey(utcOffsetMinutes: number): string {
  const now = new Date();
  const localMs = now.getTime() + utcOffsetMinutes * 60 * 1000;
  const d = new Date(localMs);
  // Reset to midnight UTC (we've already offset)
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      timeGate,
      utcOffsetMinutes = 0,
      focusMinutes,
      missionsDone,
      streakDays,
    } = await req.json();

    // Validate required fields
    if (
      typeof focusMinutes !== 'number' ||
      typeof missionsDone !== 'number' ||
      typeof streakDays !== 'number'
    ) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: focusMinutes, missionsDone, streakDays' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Server-side time gate check
    if (!isTimeGateUnlocked(timeGate, utcOffsetMinutes)) {
      return new Response(
        JSON.stringify({ error: 'time_gate_locked', message: `Mission locked until ${timeGate}` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create a Supabase client authenticated as the calling user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      },
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userId = user.id;
    const weekKey = getWeekKey(utcOffsetMinutes);
    const totalScore = computeTotalScore(focusMinutes, missionsDone, streakDays);

    // Get all crews the user belongs to
    const { data: memberships, error: memError } = await supabase
      .from('crew_members')
      .select('crew_id')
      .eq('user_id', userId);

    if (memError) {
      throw memError;
    }

    // Upsert score for each crew
    const results: { crew_id: string; ok: boolean }[] = [];
    for (const m of memberships ?? []) {
      const { error: upsertError } = await supabase.from('crew_scores').upsert(
        {
          crew_id: m.crew_id,
          user_id: userId,
          week_key: weekKey,
          focus_minutes: focusMinutes,
          missions_done: missionsDone,
          streak_days: streakDays,
          total_score: totalScore,
        },
        { onConflict: 'crew_id,user_id,week_key' },
      );
      results.push({ crew_id: m.crew_id as string, ok: !upsertError });
    }

    return new Response(
      JSON.stringify({ success: true, weekKey, totalScore, crews: results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
