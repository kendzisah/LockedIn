-- ────────────────────────────────────────────────────
-- Fix: infinite recursion in profiles RLS policy
--
-- The "Admins read all profiles" policy queries `profiles`
-- to check if the current user is an admin, which triggers
-- the same policy check → infinite recursion.
--
-- Solution: SECURITY DEFINER function `is_admin()` that
-- bypasses RLS to check the role. All admin policies now
-- use this function.
-- ────────────────────────────────────────────────────

-- 1. Create a helper that bypasses RLS (runs as function owner = superuser)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- 2. Fix profiles policies (the recursive ones)
DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;

CREATE POLICY "Admins read all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

-- 3. Update audio_tracks admin policy to use is_admin() for consistency
DROP POLICY IF EXISTS "Admins manage tracks" ON audio_tracks;

CREATE POLICY "Admins manage tracks"
  ON audio_tracks FOR ALL
  USING (is_admin());

-- 4. Update scheduled_sessions admin policy
DROP POLICY IF EXISTS "Admins manage sessions" ON scheduled_sessions;

CREATE POLICY "Admins manage sessions"
  ON scheduled_sessions FOR ALL
  USING (is_admin());

-- 5. Update storage admin policies
DROP POLICY IF EXISTS "Admins upload audio" ON storage.objects;

CREATE POLICY "Admins upload audio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio'
    AND is_admin()
  );

DROP POLICY IF EXISTS "Admins update audio" ON storage.objects;

CREATE POLICY "Admins update audio"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'audio'
    AND is_admin()
  );

DROP POLICY IF EXISTS "Admins delete audio" ON storage.objects;

CREATE POLICY "Admins delete audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio'
    AND is_admin()
  );
