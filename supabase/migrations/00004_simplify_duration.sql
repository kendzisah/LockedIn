-- ────────────────────────────────────────────────────
-- Migration 00004: Simplify to single 5-min duration
-- ────────────────────────────────────────────────────
-- All daily sessions are ~5 min. Each day has exactly 1 lock_in + 1 unlock slot.
-- duration_minutes column is kept (always 5) for backwards compatibility.

-- 1. Drop the old CHECK constraint that allowed 5/10/15/20
ALTER TABLE scheduled_sessions
  DROP CONSTRAINT IF EXISTS scheduled_sessions_duration_minutes_check;

ALTER TABLE scheduled_sessions
  ADD CONSTRAINT scheduled_sessions_duration_minutes_check
  CHECK (duration_minutes = 5);

-- 2. Update UNIQUE constraint: (scheduled_date, phase) since duration is always 5
ALTER TABLE scheduled_sessions
  DROP CONSTRAINT IF EXISTS scheduled_sessions_scheduled_date_phase_duration_minutes_key;

ALTER TABLE scheduled_sessions
  ADD CONSTRAINT scheduled_sessions_scheduled_date_phase_key
  UNIQUE (scheduled_date, phase);

-- 3. Recreate indexes without duration_minutes dimension

DROP INDEX IF EXISTS idx_scheduled_sessions_lookup;
CREATE INDEX idx_scheduled_sessions_lookup
  ON scheduled_sessions (scheduled_date, phase)
  WHERE status = 'published' AND is_active = true;

DROP INDEX IF EXISTS idx_scheduled_sessions_fallback;
CREATE INDEX idx_scheduled_sessions_fallback
  ON scheduled_sessions (phase, scheduled_date DESC)
  WHERE status = 'published' AND is_active = true;

-- 4. Backfill: set any non-5-min rows to 5 (in case old data exists)
UPDATE scheduled_sessions
  SET duration_minutes = 5
  WHERE duration_minutes != 5;
