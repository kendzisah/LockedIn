
-- ============================================================
-- CREW SYSTEM — Performance Indexes
-- ============================================================

-- Fast lookup: find crews a user belongs to
CREATE INDEX idx_crew_members_user_id ON public.crew_members(user_id);

-- Fast lookup: find members of a crew
CREATE INDEX idx_crew_members_crew_id ON public.crew_members(crew_id);

-- Fast lookup: invite code join flow
CREATE INDEX idx_crews_invite_code ON public.crews(invite_code);

-- Fast lookup: crews owned by a user
CREATE INDEX idx_crews_owner_id ON public.crews(owner_id);

-- Fast lookup: leaderboard query (scores for a crew in a given week, sorted)
CREATE INDEX idx_crew_scores_crew_week ON public.crew_scores(crew_id, week_key, total_score DESC);

-- Fast lookup: a user's scores across crews
CREATE INDEX idx_crew_scores_user_id ON public.crew_scores(user_id);
