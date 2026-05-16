-- Fix infinite recursion in guild_members SELECT policy.
--
-- The original policy queried public.guild_members from inside its own
-- USING clause. Postgres re-applies RLS on the inner subquery, so the
-- policy recurses on itself and the planner errors out with code 42P17:
--   "infinite recursion detected in policy for relation 'guild_members'"
--
-- Fix: route every "is the user in this guild?" check through a
-- SECURITY DEFINER helper that runs the lookup as the function owner
-- (bypassing RLS for that single read). Policies then call the helper
-- instead of querying guild_members directly.

-- Helper: returns the set of guild_ids the current user belongs to.
-- Marked STABLE so the planner can cache it within a single query.
CREATE OR REPLACE FUNCTION public.user_guild_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT guild_id
  FROM public.guild_members
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.user_guild_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.user_guild_ids() TO authenticated;

-- Replace the recursive guild_members SELECT policy.
DROP POLICY IF EXISTS "members_can_see_guildmates" ON public.guild_members;
CREATE POLICY "members_can_see_guildmates"
  ON public.guild_members FOR SELECT
  USING (
    guild_id IN (SELECT public.user_guild_ids())
  );

-- Replace the guilds SELECT policy that triggered the same recursion
-- path when joining through guild_members.
DROP POLICY IF EXISTS "guild_members_can_read_guild" ON public.guilds;
CREATE POLICY "guild_members_can_read_guild"
  ON public.guilds FOR SELECT
  USING (
    id IN (SELECT public.user_guild_ids())
  );

-- Same recursive shape on guild_scores — route through the helper.
DROP POLICY IF EXISTS "members_can_see_guild_scores" ON public.guild_scores;
CREATE POLICY "members_can_see_guild_scores"
  ON public.guild_scores FOR SELECT
  USING (
    guild_id IN (SELECT public.user_guild_ids())
  );
