
-- ============================================================
-- CREW SYSTEM — Helper Functions
-- ============================================================

-- Generate a unique 6-char invite code (excludes ambiguous chars: 0,O,I,L,1)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars  text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code   text := '';
  i      integer;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    -- Ensure uniqueness
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.crews WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- Get ISO week key for a given timestamp (e.g. '2026-W14')
CREATE OR REPLACE FUNCTION public.get_iso_week(ts timestamptz DEFAULT now())
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(ts, 'IYYY') || '-W' || lpad(to_char(ts, 'IW'), 2, '0');
$$;

-- Create a crew + auto-add the owner as first member (atomic)
CREATE OR REPLACE FUNCTION public.create_crew(crew_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_crew_id uuid;
  new_code    text;
  caller_id   uuid := auth.uid();
  crew_count  integer;
BEGIN
  -- Guard: must be authenticated
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard: max 3 crews per user (as owner)
  SELECT count(*) INTO crew_count
  FROM public.crews WHERE owner_id = caller_id;

  IF crew_count >= 3 THEN
    RAISE EXCEPTION 'You can own a maximum of 3 crews';
  END IF;

  -- Generate unique invite code
  new_code := public.generate_invite_code();

  -- Insert crew
  INSERT INTO public.crews (name, invite_code, owner_id)
  VALUES (crew_name, new_code, caller_id)
  RETURNING id INTO new_crew_id;

  -- Auto-add owner as first member with 'owner' role
  INSERT INTO public.crew_members (crew_id, user_id, role)
  VALUES (new_crew_id, caller_id, 'owner');

  RETURN jsonb_build_object(
    'crew_id', new_crew_id,
    'invite_code', new_code,
    'name', crew_name
  );
END;
$$;

-- Join a crew by invite code (atomic)
CREATE OR REPLACE FUNCTION public.join_crew(code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_crew  record;
  member_count integer;
  caller_id    uuid := auth.uid();
  memberships  integer;
BEGIN
  -- Guard: must be authenticated
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find the crew
  SELECT id, name, max_members, owner_id
  INTO target_crew
  FROM public.crews
  WHERE invite_code = upper(trim(code));

  IF target_crew IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.crew_members
    WHERE crew_id = target_crew.id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'You are already a member of this crew';
  END IF;

  -- Check crew capacity
  SELECT count(*) INTO member_count
  FROM public.crew_members
  WHERE crew_id = target_crew.id;

  IF member_count >= target_crew.max_members THEN
    RAISE EXCEPTION 'This crew is full';
  END IF;

  -- Guard: user can be in max 5 crews
  SELECT count(*) INTO memberships
  FROM public.crew_members WHERE user_id = caller_id;

  IF memberships >= 5 THEN
    RAISE EXCEPTION 'You can join a maximum of 5 crews';
  END IF;

  -- Join
  INSERT INTO public.crew_members (crew_id, user_id, role)
  VALUES (target_crew.id, caller_id, 'member');

  RETURN jsonb_build_object(
    'crew_id', target_crew.id,
    'crew_name', target_crew.name,
    'joined', true
  );
END;
$$;
