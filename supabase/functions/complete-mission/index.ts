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

/** ISO week key (YYYY-Www) from server UTC clock. */
function getWeekKey(): string {
  const d = new Date();
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

    // Bounds validation — reject negative, NaN, Infinity, or unreasonable values
    if (
      !Number.isFinite(focusMinutes) || focusMinutes < 0 || focusMinutes > 1440 ||
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
    const weekKey = getWeekKey();
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
