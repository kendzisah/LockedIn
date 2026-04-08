-- Account deletion from the mobile app (SECURITY DEFINER). Deploy before shipping Settings delete flow.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.crews WHERE owner_id = caller_id;
  DELETE FROM public.crew_members WHERE user_id = caller_id;
  DELETE FROM public.crew_scores WHERE user_id = caller_id;
  DELETE FROM public.profiles WHERE id = caller_id;

  DELETE FROM auth.users WHERE id = caller_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
