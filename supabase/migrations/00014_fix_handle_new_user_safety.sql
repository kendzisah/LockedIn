-- ────────────────────────────────────────────────────
-- Make handle_new_user defensive: a failure in user_stats
-- seeding must never block auth.users INSERT.
--
-- Symptom that triggered this: anonymous sign-ins broke after
-- 00011 extended handle_new_user with the user_stats insert.
-- Likely root cause: a missing GRANT or search_path quirk under
-- SECURITY DEFINER. Either way, the seed should fail-soft:
-- StatsService.refresh() will lazily create the row on demand.
-- ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- profiles row is required by RLS-dependent code; allow conflict so
  -- repeat triggers (e.g. user re-creation in the same id) don't fail.
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;

  -- user_stats row is best-effort. If it fails for any reason,
  -- log and continue — the app reads via StatsService which will
  -- treat a missing row as "no stats yet" and recompute lazily.
  BEGIN
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: failed to seed user_stats for %: % (%)',
      NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;
