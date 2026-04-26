-- ────────────────────────────────────────────────────
-- user_achievements: per-user earned achievement record.
-- Composite PK (user_id, achievement_id) prevents duplicate awards.
-- ────────────────────────────────────────────────────

CREATE TABLE user_achievements (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user_earned
  ON user_achievements (user_id, earned_at DESC);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Broad-readable so guild leaderboards / profile views can show peer badges.
CREATE POLICY "Anyone authenticated reads achievements"
  ON user_achievements FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users insert own achievements"
  ON user_achievements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
