
-- ============================================================
-- CREW SYSTEM — RLS Policies
-- ============================================================

-- ── crews ──

-- Members can read their own crews
CREATE POLICY "crew_members_can_read_crew"
  ON public.crews FOR SELECT
  USING (
    id IN (SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid())
  );

-- Any authenticated user can read a crew by invite_code (for join flow)
CREATE POLICY "anyone_can_lookup_crew_by_invite"
  ON public.crews FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can create crews
CREATE POLICY "authenticated_users_can_create_crew"
  ON public.crews FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Only the owner can update crew name
CREATE POLICY "owner_can_update_crew"
  ON public.crews FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Only the owner can delete a crew
CREATE POLICY "owner_can_delete_crew"
  ON public.crews FOR DELETE
  USING (auth.uid() = owner_id);


-- ── crew_members ──

-- Members can see other members of their crews
CREATE POLICY "members_can_see_crewmates"
  ON public.crew_members FOR SELECT
  USING (
    crew_id IN (SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid())
  );

-- Authenticated users can insert themselves (join a crew)
CREATE POLICY "users_can_join_crew"
  ON public.crew_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove themselves; owners can remove anyone
CREATE POLICY "users_can_leave_or_owner_can_kick"
  ON public.crew_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR crew_id IN (SELECT id FROM public.crews WHERE owner_id = auth.uid())
  );


-- ── crew_scores ──

-- Members can see scores in their crews
CREATE POLICY "members_can_see_crew_scores"
  ON public.crew_scores FOR SELECT
  USING (
    crew_id IN (SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid())
  );

-- Users can insert/update only their own scores
CREATE POLICY "users_can_upsert_own_scores"
  ON public.crew_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_scores"
  ON public.crew_scores FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
