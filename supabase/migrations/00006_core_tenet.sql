-- ────────────────────────────────────────────────────
-- 00006: Add core_tenet column to audio_tracks
-- ────────────────────────────────────────────────────

ALTER TABLE audio_tracks ADD COLUMN core_tenet TEXT;
