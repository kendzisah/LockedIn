-- ────────────────────────────────────────────────────
-- user_xp_log: append-only audit trail of XP awards.
-- Insert paired with bump_user_stat('total_xp', xp) on the client.
-- ────────────────────────────────────────────────────

CREATE TABLE user_xp_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  xp          INTEGER NOT NULL CHECK (xp >= 0),
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_xp_log_user_created
  ON user_xp_log (user_id, created_at DESC);

ALTER TABLE user_xp_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own xp log"
  ON user_xp_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own xp log"
  ON user_xp_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
