import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * complete-mission — Server-side mission completion with score computation.
 *
 * Accepts: { focusMinutes: number, missionsDone: number, streakDays: number }
 * Auth: Bearer token from the mobile client (anon key + user JWT).
 *
 * 1. Computes total_score server-side (prevents client-side score tampering).
 * 2. Upserts guild_scores for every guild the user belongs to, using GREATEST
 *    to ensure scores never regress from stale client state.
 *
 * Time gates are enforced client-side only (UX feature, not a security boundary).
 */

function computeTotalScore(focusMinutes: number, missionsDone: number, streakDays: number): number {
  return focusMinutes * 2 + missionsDone * 15 + streakDays * 10;
}

/**
 * Calendar-month key (YYYY-MM) from the server UTC clock. Guild scores are
 * bucketed per month and reset at the UTC month boundary (1st, 00:00 UTC).
 * Stored in the legacy-named `guild_scores.week_key` column.
 */
function getPeriodKey(): string {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 0-indexed → 1-12
  return `${year}-${String(month).padStart(2, '0')}`;
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

    // Bounds validation — reject negative, NaN, Infinity, or unreasonable values.
    //
    // `focusMinutes` is the user's CUMULATIVE focus for the calendar month (not a
    // single session), so the ceiling must be a monthly max, not a daily one. A
    // 1440 (24h) cap silently 400'd every guild push once an active user passed
    // 24h of monthly focus, freezing their score for the rest of the month.
    // 44640 = 31 days × 1440 min — the largest a month can hold.
    const MAX_MONTHLY_FOCUS_MINUTES = 44640;
    if (
      !Number.isFinite(focusMinutes) || focusMinutes < 0 || focusMinutes > MAX_MONTHLY_FOCUS_MINUTES ||
      !Number.isFinite(missionsDone) || missionsDone < 0 || missionsDone > 50 ||
      !Number.isFinite(streakDays) || streakDays < 0 || streakDays > 3650
    ) {
      return new Response(
        JSON.stringify({ error: 'Score values out of allowed range' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
    const weekKey = getPeriodKey();
    const totalScore = computeTotalScore(focusMinutes, missionsDone, streakDays);

    // Get all guilds the user belongs to
    const { data: memberships, error: memError } = await supabase
      .from('guild_members')
      .select('guild_id')
      .eq('user_id', userId);

    if (memError) {
      throw memError;
    }

    // Upsert score for each guild using GREATEST to prevent regression from stale client state
    const results: { guild_id: string; ok: boolean }[] = [];
    for (const m of memberships ?? []) {
      const { error: upsertError } = await supabase.rpc('upsert_guild_score', {
        p_guild_id: m.guild_id,
        p_user_id: userId,
        p_week_key: weekKey,
        p_focus_minutes: focusMinutes,
        p_missions_done: missionsDone,
        p_streak_days: streakDays,
        p_total_score: totalScore,
      });
      results.push({ guild_id: m.guild_id as string, ok: !upsertError });
    }

    return new Response(
      JSON.stringify({ success: true, weekKey, totalScore, guilds: results }),
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
