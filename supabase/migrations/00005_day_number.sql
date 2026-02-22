-- ────────────────────────────────────────────────────
-- 00005: Add day_number to audio_tracks for 90-day program
-- ────────────────────────────────────────────────────

-- Add day_number column (nullable for onboarding/ambient tracks)
ALTER TABLE audio_tracks ADD COLUMN day_number INTEGER;

-- Enforce valid range for program tracks
ALTER TABLE audio_tracks ADD CONSTRAINT chk_day_number
  CHECK (day_number IS NULL OR (day_number >= 1 AND day_number <= 90));

-- Deterministic single-row guarantee: one active track per (day, category, version)
CREATE UNIQUE INDEX idx_audio_tracks_active_day
  ON audio_tracks (day_number, category, script_version)
  WHERE is_active = true AND day_number IS NOT NULL;

-- Fast lookup index for the mobile query pattern
CREATE INDEX idx_audio_tracks_day_lookup
  ON audio_tracks (day_number, category)
  WHERE is_active = true;
