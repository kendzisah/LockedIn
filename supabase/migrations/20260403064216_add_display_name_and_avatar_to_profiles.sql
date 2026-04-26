
-- Add display_name and avatar_url to profiles
ALTER TABLE public.profiles
  ADD COLUMN display_name text CHECK (char_length(display_name) BETWEEN 1 AND 20),
  ADD COLUMN avatar_url text;

-- Allow users to read any profile (needed for crew leaderboard to show names/avatars)
-- Check if policy exists first by using CREATE POLICY IF NOT EXISTS pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'anyone_can_read_profiles'
  ) THEN
    CREATE POLICY "anyone_can_read_profiles"
      ON public.profiles FOR SELECT
      USING (true);
  END IF;
END $$;

-- Allow users to update their own profile (display_name, avatar_url)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_can_update_own_profile'
  ) THEN
    CREATE POLICY "users_can_update_own_profile"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
