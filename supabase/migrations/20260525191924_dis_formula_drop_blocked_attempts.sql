-- Drop total_blocked_attempts from the DIS formula in recompute_user_stats.
-- DIS now grows ONLY from total_distractions_resisted (mission-driven).
-- Halved denominator from 1400 to 700 so per-mission growth rate is preserved.

CREATE OR REPLACE FUNCTION public.recompute_user_stats()
 RETURNS TABLE(discipline integer, focus integer, execution integer, consistency integer, social integer, ovr integer, rank_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s          user_stats%ROWTYPE;
  v_focus       INTEGER;
  v_disc        INTEGER;
  v_exec        INTEGER;
  v_cons        INTEGER;
  v_soc         INTEGER;
  v_ovr         INTEGER;
  v_rank        TEXT;
BEGIN
  SELECT * INTO s FROM user_stats WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No user_stats row for current user';
  END IF;

  v_focus := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-(s.total_focus_minutes::numeric) / 12000)))::int));
  v_disc  := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.total_distractions_resisted)::numeric) / 700)))::int));
  v_exec  := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.total_completed_sessions + s.total_missions_completed)::numeric) / 700)))::int));
  v_cons  := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.total_streak_days + s.total_perfect_days * 2)::numeric) / 240)))::int));
  v_soc   := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.invites_used * 8 + s.guild_check_ins * 2)::numeric) / 100)))::int));
  v_ovr   := GREATEST(1, LEAST(99, ROUND((v_focus + v_disc + v_exec + v_cons + v_soc) / 5.0)::int));

  v_rank := CASE
    WHEN s.current_streak_days >= 365 THEN 'locked_in'
    WHEN s.current_streak_days >= 180 THEN 'goat'
    WHEN s.current_streak_days >= 90  THEN 'legend'
    WHEN s.current_streak_days >= 60  THEN 'phantom'
    WHEN s.current_streak_days >= 30  THEN 'elite'
    WHEN s.current_streak_days >= 14  THEN 'chosen'
    WHEN s.current_streak_days >= 7   THEN 'rising'
    WHEN s.current_streak_days >= 3   THEN 'grinder'
    ELSE 'npc'
  END;

  UPDATE user_stats
  SET
    discipline  = v_disc,
    focus       = v_focus,
    execution   = v_exec,
    consistency = v_cons,
    social      = v_soc,
    ovr         = v_ovr,
    rank_id     = v_rank,
    updated_at  = now()
  WHERE user_id = auth.uid();

  RETURN QUERY SELECT v_disc, v_focus, v_exec, v_cons, v_soc, v_ovr, v_rank;
END;
$function$;
