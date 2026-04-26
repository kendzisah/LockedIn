-- ────────────────────────────────────────────────────
-- user_stats: per-user counters (source of truth) +
-- cached derived stats (recomputable at any time).
-- One row per auth.users id; seeded by trigger.
-- ────────────────────────────────────────────────────

CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ── Counters (source of truth, monotonic) ──
  total_focus_minutes        BIGINT NOT NULL DEFAULT 0,
  total_sessions             BIGINT NOT NULL DEFAULT 0,
  total_completed_sessions   BIGINT NOT NULL DEFAULT 0,
  total_blocked_attempts     BIGINT NOT NULL DEFAULT 0,
  total_distractions_resisted BIGINT NOT NULL DEFAULT 0,
  total_missions_completed   BIGINT NOT NULL DEFAULT 0,
  total_perfect_days         BIGINT NOT NULL DEFAULT 0,
  total_streak_days          BIGINT NOT NULL DEFAULT 0,
  invites_used               BIGINT NOT NULL DEFAULT 0,
  guild_check_ins            BIGINT NOT NULL DEFAULT 0,
  total_xp                   BIGINT NOT NULL DEFAULT 0,

  -- ── Stateful (NOT counters; can decrement on streak break) ──
  current_streak_days  INTEGER NOT NULL DEFAULT 0,
  longest_streak_days  INTEGER NOT NULL DEFAULT 0,

  -- ── Derived (recomputable from counters) ──
  discipline   INTEGER NOT NULL DEFAULT 1,
  focus        INTEGER NOT NULL DEFAULT 1,
  execution    INTEGER NOT NULL DEFAULT 1,
  consistency  INTEGER NOT NULL DEFAULT 1,
  social       INTEGER NOT NULL DEFAULT 1,
  ovr          INTEGER NOT NULL DEFAULT 1,
  rank_id      TEXT    NOT NULL DEFAULT 'npc',

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_stats_discipline_range  CHECK (discipline  BETWEEN 1 AND 99),
  CONSTRAINT user_stats_focus_range       CHECK (focus       BETWEEN 1 AND 99),
  CONSTRAINT user_stats_execution_range   CHECK (execution   BETWEEN 1 AND 99),
  CONSTRAINT user_stats_consistency_range CHECK (consistency BETWEEN 1 AND 99),
  CONSTRAINT user_stats_social_range      CHECK (social      BETWEEN 1 AND 99),
  CONSTRAINT user_stats_ovr_range         CHECK (ovr         BETWEEN 1 AND 99)
);

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Broad-readable so guild leaderboards can render peer OVR / rank.
-- (No PII on this table; only gameplay metrics.)
CREATE POLICY "Anyone authenticated reads stats"
  ON user_stats FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users insert own stats"
  ON user_stats FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own stats"
  ON user_stats FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Extend new-user trigger to also seed a user_stats row ──
-- Replaces handle_new_user (originally in 00001) to add the user_stats insert.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role) VALUES (NEW.id, 'user');
  INSERT INTO user_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing users (idempotent)
INSERT INTO user_stats (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ── Atomic counter bumps (avoids read-modify-write race) ──

CREATE OR REPLACE FUNCTION public.bump_user_stat(
  p_field TEXT,
  p_delta BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field NOT IN (
    'total_focus_minutes', 'total_sessions', 'total_completed_sessions',
    'total_blocked_attempts', 'total_distractions_resisted',
    'total_missions_completed', 'total_perfect_days', 'total_streak_days',
    'invites_used', 'guild_check_ins', 'total_xp'
  ) THEN
    RAISE EXCEPTION 'Invalid counter field: %', p_field;
  END IF;

  EXECUTE format(
    'UPDATE user_stats SET %I = %I + $1, updated_at = now() WHERE user_id = $2',
    p_field, p_field
  ) USING p_delta, auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_user_stat(TEXT, BIGINT) TO authenticated;

-- ── Streak setter (current_streak_days + longest_streak_days; not a counter) ──

CREATE OR REPLACE FUNCTION public.set_user_streak(
  p_current_streak_days INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_stats
  SET
    current_streak_days = p_current_streak_days,
    longest_streak_days = GREATEST(longest_streak_days, p_current_streak_days),
    updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_streak(INTEGER) TO authenticated;

-- ── Recompute derived stats from counters + streak (idempotent) ──

CREATE OR REPLACE FUNCTION public.recompute_user_stats()
RETURNS TABLE (
  discipline  INTEGER,
  focus       INTEGER,
  execution   INTEGER,
  consistency INTEGER,
  social      INTEGER,
  ovr         INTEGER,
  rank_id     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Capped exponential curve: round(99 * (1 - exp(-counter / k))), floored at 1.
  v_focus := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-(s.total_focus_minutes::numeric) / 12000)))::int));
  v_disc  := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.total_blocked_attempts + s.total_distractions_resisted)::numeric) / 1400)))::int));
  v_exec  := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.total_completed_sessions + s.total_missions_completed)::numeric) / 700)))::int));
  v_cons  := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.total_streak_days + s.total_perfect_days * 2)::numeric) / 240)))::int));
  v_soc   := GREATEST(1, LEAST(99, CEIL(99 * (1 - exp(-((s.invites_used * 8 + s.guild_check_ins * 2)::numeric) / 100)))::int));
  v_ovr   := GREATEST(1, LEAST(99, ROUND((v_focus + v_disc + v_exec + v_cons + v_soc) / 5.0)::int));

  -- Rank from current_streak_days (mirrors RankService thresholds)
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
$$;

GRANT EXECUTE ON FUNCTION public.recompute_user_stats() TO authenticated;
