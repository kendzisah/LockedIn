-- ────────────────────────────────────────────────────
-- Enums
-- ────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE session_phase AS ENUM ('lock_in', 'unlock');
CREATE TYPE session_status AS ENUM ('draft', 'published', 'archived');

-- ────────────────────────────────────────────────────
-- Profiles (minimal: auth.users owns email/identity)
-- ────────────────────────────────────────────────────

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-create profile on user signup (anonymous or email)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────────────
-- Admin bootstrap function (run once from SQL editor)
-- Callable only via service_role (Supabase dashboard or CLI)
-- ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION promote_to_admin(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET role = 'admin' WHERE id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found in profiles', target_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage (from Supabase SQL editor, which runs as service_role):
-- SELECT promote_to_admin('your-user-uuid-here');

-- ────────────────────────────────────────────────────
-- Audio tracks (storage references, NOT raw URLs)
-- ────────────────────────────────────────────────────

CREATE TABLE audio_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'audio',
  storage_path TEXT NOT NULL,            -- e.g. "tracks/2026-02-20/lock_in_10.mp3"
  duration_seconds INTEGER NOT NULL,
  voice_id TEXT,                         -- ElevenLabs voice ID
  script_version TEXT,                   -- version tag
  hash TEXT,                             -- file integrity / dedupe
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audio_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read active tracks"
  ON audio_tracks FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage tracks"
  ON audio_tracks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ────────────────────────────────────────────────────
-- Scheduled sessions (date + phase + duration model)
-- ────────────────────────────────────────────────────

CREATE TABLE scheduled_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date DATE NOT NULL,
  phase session_phase NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (5, 10, 15, 20)),
  audio_track_id UUID NOT NULL REFERENCES audio_tracks(id),
  title TEXT NOT NULL,                     -- display label in mobile UI
  recommended_time_local TIME,             -- nullable, for future personalization
  status session_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (scheduled_date, phase, duration_minutes)
);

ALTER TABLE scheduled_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read active published sessions"
  ON scheduled_sessions FOR SELECT TO authenticated
  USING (status = 'published' AND is_active = true);

CREATE POLICY "Admins manage sessions"
  ON scheduled_sessions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Primary lookup index (mobile query: exact date + phase + duration)
CREATE INDEX idx_scheduled_sessions_lookup
  ON scheduled_sessions (scheduled_date, phase, duration_minutes)
  WHERE status = 'published' AND is_active = true;

-- Fallback query index (nearest previous published session)
CREATE INDEX idx_scheduled_sessions_fallback
  ON scheduled_sessions (phase, duration_minutes, scheduled_date DESC)
  WHERE status = 'published' AND is_active = true;
