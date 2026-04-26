
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

  -- Delete owned crews (cascade handles crew_members + crew_scores for those crews)
  DELETE FROM public.crews WHERE owner_id = caller_id;

  -- Delete crew memberships in other people's crews
  DELETE FROM public.crew_members WHERE user_id = caller_id;

  -- Delete crew scores
  DELETE FROM public.crew_scores WHERE user_id = caller_id;

  -- Delete profile
  DELETE FROM public.profiles WHERE id = caller_id;

  -- Delete auth user (SECURITY DEFINER allows this)
  DELETE FROM auth.users WHERE id = caller_id;
END;
$$;
