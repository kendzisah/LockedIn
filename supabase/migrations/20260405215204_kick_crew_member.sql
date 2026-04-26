
-- Function: crew owner can remove a member from their crew.
-- Uses SECURITY DEFINER to bypass RLS (crew_members_delete only allows self-deletion).
CREATE OR REPLACE FUNCTION public.kick_crew_member(target_crew_id uuid, target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_id uuid := auth.uid();
  crew_owner uuid;
BEGIN
  -- Must be authenticated
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cannot kick yourself (use leaveCrew instead)
  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot remove yourself. Use leave crew instead.';
  END IF;

  -- Verify caller is the crew owner
  SELECT owner_id INTO crew_owner
  FROM public.crews
  WHERE id = target_crew_id;

  IF crew_owner IS NULL THEN
    RAISE EXCEPTION 'Crew not found';
  END IF;

  IF crew_owner != caller_id THEN
    RAISE EXCEPTION 'Only the crew owner can remove members';
  END IF;

  -- Delete the membership
  DELETE FROM public.crew_members
  WHERE crew_id = target_crew_id
    AND user_id = target_user_id
    AND role != 'owner';

  -- Also clean up their scores for this crew
  DELETE FROM public.crew_scores
  WHERE crew_id = target_crew_id
    AND user_id = target_user_id;
END;
$$;
