
-- ============================================================
-- CREW SYSTEM — Tables
-- ============================================================

-- 1. crews — one row per friend group
CREATE TABLE public.crews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  invite_code text NOT NULL UNIQUE,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_members smallint NOT NULL DEFAULT 10,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. crew_members — join table (user ↔ crew)
CREATE TABLE public.crew_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id   uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crew_id, user_id)
);

-- 3. crew_scores — weekly score per user per crew
CREATE TABLE public.crew_scores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id          uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_key         text NOT NULL,  -- ISO week key e.g. '2026-W14'
  focus_minutes    integer NOT NULL DEFAULT 0,
  missions_done    integer NOT NULL DEFAULT 0,
  streak_days      integer NOT NULL DEFAULT 0,
  total_score      integer NOT NULL DEFAULT 0,  -- computed: (focus*2)+(missions*15)+(streak*10)
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crew_id, user_id, week_key)
);

-- Enable RLS on all three tables
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_scores ENABLE ROW LEVEL SECURITY;
