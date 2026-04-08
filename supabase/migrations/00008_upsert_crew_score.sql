-- Monotonic score upsert: uses GREATEST so scores never regress from stale client state.
-- Deploy before updating the complete-mission edge function.

CREATE OR REPLACE FUNCTION public.upsert_crew_score(
  p_crew_id uuid,
  p_user_id uuid,
  p_week_key text,
  p_focus_minutes int,
  p_missions_done int,
  p_streak_days int,
  p_total_score int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO crew_scores (crew_id, user_id, week_key, focus_minutes, missions_done, streak_days, total_score)
  VALUES (p_crew_id, p_user_id, p_week_key, p_focus_minutes, p_missions_done, p_streak_days, p_total_score)
  ON CONFLICT (crew_id, user_id, week_key)
  DO UPDATE SET
    focus_minutes = GREATEST(crew_scores.focus_minutes, EXCLUDED.focus_minutes),
    missions_done = GREATEST(crew_scores.missions_done, EXCLUDED.missions_done),
    streak_days   = GREATEST(crew_scores.streak_days,   EXCLUDED.streak_days),
    -- Recompute total_score from the GREATESTed columns to stay consistent
    total_score   = GREATEST(crew_scores.focus_minutes, EXCLUDED.focus_minutes) * 2
                  + GREATEST(crew_scores.missions_done, EXCLUDED.missions_done) * 15
                  + GREATEST(crew_scores.streak_days,   EXCLUDED.streak_days) * 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_crew_score(uuid, uuid, text, int, int, int, int) TO authenticated;
