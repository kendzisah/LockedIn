-- recompute_user_stats: derive rank_id from total rank XP (sum of the five
-- per-stat XP buckets) to match the app's RankHelpers.rankFromXp, replacing the
-- legacy streak-based thresholds. The numeric `ovr` + per-stat numeric columns
-- stay on the legacy counter formula — the app renders OVR/stat *letters* from
-- the *_xp columns client-side and no longer reads these for display.
--
-- NOTE: this repo's local migration history has drifted behind production; the
-- `per_stat_xp_unified_model` migration (which adds the *_xp columns this
-- function reads) lives on remote but not in this folder. This file mirrors the
-- migration applied to the remote DB (version 20260613042542).

CREATE OR REPLACE FUNCTION public.recompute_user_stats()
 RETURNS TABLE(discipline integer, focus integer, execution integer, consistency integer, social integer, ovr integer, rank_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s          user_stats%ROWTYPE;
  v_focus    INTEGER;
  v_disc     INTEGER;
  v_exec     INTEGER;
  v_cons     INTEGER;
  v_soc      INTEGER;
  v_ovr      INTEGER;
  v_rank     TEXT;
  v_rank_xp  BIGINT;
BEGIN
  SELECT * INTO s FROM user_stats WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No user_stats row for current user';
  END IF;

  -- Legacy numeric stat ratings (1-99). Retained for back-compat / admin.
  v_focus := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-(s.total_focus_minutes::numeric) / 12000)))::int));
  v_disc  := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.total_distractions_resisted)::numeric) / 700)))::int));
  v_exec  := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.total_completed_sessions + s.total_missions_completed)::numeric) / 700)))::int));
  v_cons  := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.total_streak_days + s.total_perfect_days * 2)::numeric) / 240)))::int));
  v_soc   := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.invites_used * 8 + s.guild_check_ins * 2)::numeric) / 100)))::int));
  v_ovr   := GREATEST(1, LEAST(99, ROUND((v_focus + v_disc + v_exec + v_cons + v_soc) / 5.0)::int));

  -- Total rank XP = sum of the five per-stat XP buckets, with the same legacy
  -- fallbacks the client (UserStatsLite.*Counter) uses for pre-migration rows.
  v_rank_xp :=
      (CASE WHEN s.focus_xp       > 0 THEN s.focus_xp       ELSE LEAST(35000, s.total_focus_minutes) END)
    + (CASE WHEN s.discipline_xp  > 0 THEN s.discipline_xp  ELSE s.total_distractions_resisted * 30 END)
    + (CASE WHEN s.execution_xp   > 0 THEN s.execution_xp   ELSE s.total_completed_sessions * 15 + s.total_missions_completed * 15 + s.total_perfect_days * 50 END)
    + (CASE WHEN s.consistency_xp > 0 THEN s.consistency_xp ELSE s.total_streak_days * 30 + s.total_perfect_days * 30 END)
    + (CASE WHEN s.social_xp      > 0 THEN s.social_xp      ELSE s.invites_used * 200 + s.guild_check_ins * 30 END);

  -- XP thresholds mirror DesignKit RankTiers.all.
  v_rank := CASE
    WHEN v_rank_xp >= 90000 THEN 'locked_in'
    WHEN v_rank_xp >= 65000 THEN 'goat'
    WHEN v_rank_xp >= 42000 THEN 'legend'
    WHEN v_rank_xp >= 22000 THEN 'phantom'
    WHEN v_rank_xp >= 10000 THEN 'elite'
    WHEN v_rank_xp >= 3000  THEN 'chosen'
    WHEN v_rank_xp >= 800   THEN 'rising'
    WHEN v_rank_xp >= 100   THEN 'grinder'
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

-- One-time backfill: recompute every existing row's rank_id with the XP formula
-- so admin queries reflect the same rank the app shows, immediately.
UPDATE user_stats us
SET rank_id = CASE
    WHEN xp.total >= 90000 THEN 'locked_in'
    WHEN xp.total >= 65000 THEN 'goat'
    WHEN xp.total >= 42000 THEN 'legend'
    WHEN xp.total >= 22000 THEN 'phantom'
    WHEN xp.total >= 10000 THEN 'elite'
    WHEN xp.total >= 3000  THEN 'chosen'
    WHEN xp.total >= 800   THEN 'rising'
    WHEN xp.total >= 100   THEN 'grinder'
    ELSE 'npc'
  END,
  updated_at = now()
FROM (
  SELECT user_id,
      (CASE WHEN focus_xp       > 0 THEN focus_xp       ELSE LEAST(35000, total_focus_minutes) END)
    + (CASE WHEN discipline_xp  > 0 THEN discipline_xp  ELSE total_distractions_resisted * 30 END)
    + (CASE WHEN execution_xp   > 0 THEN execution_xp   ELSE total_completed_sessions * 15 + total_missions_completed * 15 + total_perfect_days * 50 END)
    + (CASE WHEN consistency_xp > 0 THEN consistency_xp ELSE total_streak_days * 30 + total_perfect_days * 30 END)
    + (CASE WHEN social_xp      > 0 THEN social_xp      ELSE invites_used * 200 + guild_check_ins * 30 END) AS total
  FROM user_stats
) xp
WHERE us.user_id = xp.user_id;
