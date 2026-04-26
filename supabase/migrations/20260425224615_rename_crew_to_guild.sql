-- ============================================================
-- CREW → GUILD rename
-- ============================================================
--
-- Tables, columns, indexes, RLS policies, and helper functions all
-- move from "crew*" to "guild*". Uses ALTER ... RENAME to preserve
-- live data (no DROP/CREATE on tables).
--
-- Order matters: rename tables + columns first, then drop old policies,
-- then recreate policies against the new names, then rename functions
-- (CREATE OR REPLACE the new ones, DROP the old ones), finally rename
-- indexes for clarity.

-- ── Tables ──
ALTER TABLE public.crews         RENAME TO guilds;
ALTER TABLE public.crew_members  RENAME TO guild_members;
ALTER TABLE public.crew_scores   RENAME TO guild_scores;

-- ── Columns ──
ALTER TABLE public.guild_members RENAME COLUMN crew_id TO guild_id;
ALTER TABLE public.guild_scores  RENAME COLUMN crew_id TO guild_id;

-- ── Indexes ──
ALTER INDEX public.idx_crew_members_user_id   RENAME TO idx_guild_members_user_id;
ALTER INDEX public.idx_crew_members_crew_id   RENAME TO idx_guild_members_guild_id;
ALTER INDEX public.idx_crews_invite_code      RENAME TO idx_guilds_invite_code;
ALTER INDEX public.idx_crews_owner_id         RENAME TO idx_guilds_owner_id;
ALTER INDEX public.idx_crew_scores_crew_week  RENAME TO idx_guild_scores_guild_week;
ALTER INDEX public.idx_crew_scores_user_id    RENAME TO idx_guild_scores_user_id;

-- ── Drop old policies (must be done before recreating with same effective rules) ──
DROP POLICY IF EXISTS "crew_members_can_read_crew"            ON public.guilds;
DROP POLICY IF EXISTS "anyone_can_lookup_crew_by_invite"      ON public.guilds;
DROP POLICY IF EXISTS "authenticated_users_can_create_crew"   ON public.guilds;
DROP POLICY IF EXISTS "owner_can_update_crew"                 ON public.guilds;
DROP POLICY IF EXISTS "owner_can_delete_crew"                 ON public.guilds;

DROP POLICY IF EXISTS "members_can_see_crewmates"             ON public.guild_members;
DROP POLICY IF EXISTS "users_can_join_crew"                   ON public.guild_members;
DROP POLICY IF EXISTS "users_can_leave_or_owner_can_kick"     ON public.guild_members;

DROP POLICY IF EXISTS "members_can_see_crew_scores"           ON public.guild_scores;
DROP POLICY IF EXISTS "users_can_upsert_own_scores"           ON public.guild_scores;
DROP POLICY IF EXISTS "users_can_update_own_scores"           ON public.guild_scores;

-- ── Recreate policies referencing new table + column names ──

-- guilds
CREATE POLICY "guild_members_can_read_guild"
  ON public.guilds FOR SELECT
  USING (
    id IN (SELECT guild_id FROM public.guild_members WHERE user_id = auth.uid())
  );

CREATE POLICY "anyone_can_lookup_guild_by_invite"
  ON public.guilds FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_users_can_create_guild"
  ON public.guilds FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owner_can_update_guild"
  ON public.guilds FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owner_can_delete_guild"
  ON public.guilds FOR DELETE
  USING (auth.uid() = owner_id);

-- guild_members
CREATE POLICY "members_can_see_guildmates"
  ON public.guild_members FOR SELECT
  USING (
    guild_id IN (SELECT guild_id FROM public.guild_members WHERE user_id = auth.uid())
  );

CREATE POLICY "users_can_join_guild"
  ON public.guild_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_leave_or_owner_can_kick_guild"
  ON public.guild_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR guild_id IN (SELECT id FROM public.guilds WHERE owner_id = auth.uid())
  );

-- guild_scores
CREATE POLICY "members_can_see_guild_scores"
  ON public.guild_scores FOR SELECT
  USING (
    guild_id IN (SELECT guild_id FROM public.guild_members WHERE user_id = auth.uid())
  );

CREATE POLICY "users_can_upsert_own_guild_scores"
  ON public.guild_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_guild_scores"
  ON public.guild_scores FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Helper functions ──

-- create_crew → create_guild
CREATE OR REPLACE FUNCTION public.create_guild(guild_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_guild_id uuid;
  new_code     text;
  caller_id    uuid := auth.uid();
  guild_count  integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT count(*) INTO guild_count
  FROM public.guilds WHERE owner_id = caller_id;

  IF guild_count >= 3 THEN
    RAISE EXCEPTION 'You can own a maximum of 3 guilds';
  END IF;

  new_code := public.generate_invite_code();

  INSERT INTO public.guilds (name, invite_code, owner_id)
  VALUES (guild_name, new_code, caller_id)
  RETURNING id INTO new_guild_id;

  INSERT INTO public.guild_members (guild_id, user_id, role)
  VALUES (new_guild_id, caller_id, 'owner');

  RETURN jsonb_build_object(
    'guild_id', new_guild_id,
    'invite_code', new_code,
    'name', guild_name
  );
END;
$$;

DROP FUNCTION IF EXISTS public.create_crew(text);

-- generate_invite_code now references guilds (was crews)
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
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.guilds WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- join_crew → join_guild. Also bump invites_used on the guild OWNER's
-- user_stats row so the inviter actually gets Social-stat credit when
-- a code is redeemed (the formula already weights invites_used × 8).
CREATE OR REPLACE FUNCTION public.join_guild(code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_guild record;
  member_count integer;
  caller_id    uuid := auth.uid();
  memberships  integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, name, max_members, owner_id
  INTO target_guild
  FROM public.guilds
  WHERE invite_code = upper(trim(code));

  IF target_guild IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.guild_members
    WHERE guild_id = target_guild.id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'You are already a member of this guild';
  END IF;

  SELECT count(*) INTO member_count
  FROM public.guild_members
  WHERE guild_id = target_guild.id;

  IF member_count >= target_guild.max_members THEN
    RAISE EXCEPTION 'This guild is full';
  END IF;

  SELECT count(*) INTO memberships
  FROM public.guild_members WHERE user_id = caller_id;

  IF memberships >= 5 THEN
    RAISE EXCEPTION 'You can join a maximum of 5 guilds';
  END IF;

  INSERT INTO public.guild_members (guild_id, user_id, role)
  VALUES (target_guild.id, caller_id, 'member');

  -- Credit the guild owner (the inviter) with an invite_used so their
  -- Social stat actually grows. Safe no-op if user_stats row missing.
  UPDATE public.user_stats
  SET invites_used = COALESCE(invites_used, 0) + 1,
      updated_at   = now()
  WHERE user_id = target_guild.owner_id;

  RETURN jsonb_build_object(
    'guild_id', target_guild.id,
    'guild_name', target_guild.name,
    'joined', true
  );
END;
$$;

DROP FUNCTION IF EXISTS public.join_crew(text);

-- kick_crew_member → kick_guild_member
CREATE OR REPLACE FUNCTION public.kick_guild_member(target_guild_id uuid, target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_id   uuid := auth.uid();
  guild_owner uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot remove yourself. Use leave guild instead.';
  END IF;

  SELECT owner_id INTO guild_owner
  FROM public.guilds
  WHERE id = target_guild_id;

  IF guild_owner IS NULL THEN
    RAISE EXCEPTION 'Guild not found';
  END IF;

  IF guild_owner != caller_id THEN
    RAISE EXCEPTION 'Only the guild owner can remove members';
  END IF;

  DELETE FROM public.guild_members
  WHERE guild_id = target_guild_id
    AND user_id = target_user_id
    AND role != 'owner';

  DELETE FROM public.guild_scores
  WHERE guild_id = target_guild_id
    AND user_id = target_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.kick_crew_member(uuid, uuid);

-- upsert_crew_score → upsert_guild_score
CREATE OR REPLACE FUNCTION public.upsert_guild_score(
  p_guild_id uuid,
  p_user_id uuid,
  p_week_key text,
  p_focus_minutes int,
  p_missions_done int,
  p_streak_days int,
  p_total_score int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO guild_scores (guild_id, user_id, week_key, focus_minutes, missions_done, streak_days, total_score)
  VALUES (p_guild_id, p_user_id, p_week_key, p_focus_minutes, p_missions_done, p_streak_days, p_total_score)
  ON CONFLICT (guild_id, user_id, week_key)
  DO UPDATE SET
    focus_minutes = GREATEST(guild_scores.focus_minutes, EXCLUDED.focus_minutes),
    missions_done = GREATEST(guild_scores.missions_done, EXCLUDED.missions_done),
    streak_days   = GREATEST(guild_scores.streak_days,   EXCLUDED.streak_days),
    total_score   = GREATEST(guild_scores.focus_minutes, EXCLUDED.focus_minutes) * 2
                  + GREATEST(guild_scores.missions_done, EXCLUDED.missions_done) * 15
                  + GREATEST(guild_scores.streak_days,   EXCLUDED.streak_days) * 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_guild_score(uuid, uuid, text, int, int, int, int) TO authenticated;

DROP FUNCTION IF EXISTS public.upsert_crew_score(uuid, uuid, text, int, int, int, int);
