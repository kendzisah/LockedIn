/**
 * Launch achievement catalog. Each entry has an id (stable, used as DB PK
 * fragment) and a `condition` that takes the latest UserStatsRow snapshot
 * and returns whether the achievement should now be earned.
 *
 * Add new achievements by appending here — never reorder or rename ids.
 */

import type { UserStatsRow } from '@lockedin/shared-types';

export interface Achievement {
  id: string;
  name: string;
  category: 'session' | 'streak' | 'mission' | 'stat' | 'social';
  description: string;
  condition: (s: UserStatsRow) => boolean;
}

export const ACHIEVEMENT_CATALOG: Achievement[] = [
  // ── Sessions ──
  {
    id: 'first_session',
    name: 'First Lock-In',
    category: 'session',
    description: 'Complete your first focus session.',
    condition: (s) => s.total_completed_sessions >= 1,
  },
  {
    id: 'sessions_10',
    name: 'Locked In x10',
    category: 'session',
    description: 'Complete 10 focus sessions.',
    condition: (s) => s.total_completed_sessions >= 10,
  },
  {
    id: 'sessions_50',
    name: 'Half a Hundred',
    category: 'session',
    description: 'Complete 50 focus sessions.',
    condition: (s) => s.total_completed_sessions >= 50,
  },
  {
    id: 'focus_minutes_500',
    name: 'Deep Diver',
    category: 'session',
    description: 'Log 500 minutes of focus.',
    condition: (s) => s.total_focus_minutes >= 500,
  },

  // ── Streak ──
  {
    id: 'streak_3',
    name: 'Grinder',
    category: 'streak',
    description: 'Reach a 3-day streak.',
    condition: (s) => s.longest_streak_days >= 3,
  },
  {
    id: 'streak_7',
    name: 'Rising',
    category: 'streak',
    description: 'Reach a 7-day streak.',
    condition: (s) => s.longest_streak_days >= 7,
  },
  {
    id: 'streak_30',
    name: 'Elite',
    category: 'streak',
    description: 'Reach a 30-day streak.',
    condition: (s) => s.longest_streak_days >= 30,
  },
  {
    id: 'streak_90',
    name: 'Legend',
    category: 'streak',
    description: 'Reach a 90-day streak.',
    condition: (s) => s.longest_streak_days >= 90,
  },

  // ── Missions / Perfect days ──
  {
    id: 'perfect_day_first',
    name: 'No Skip Day',
    category: 'mission',
    description: 'Complete all 3 daily missions for the first time.',
    condition: (s) => s.total_perfect_days >= 1,
  },
  {
    id: 'perfect_days_10',
    name: 'Perfect Ten',
    category: 'mission',
    description: 'Hit 10 perfect days.',
    condition: (s) => s.total_perfect_days >= 10,
  },

  // ── Stat thresholds ──
  {
    id: 'ovr_25',
    name: 'Above NPC',
    category: 'stat',
    description: 'Reach OVR 25.',
    condition: (s) => s.ovr >= 25,
  },
  {
    id: 'ovr_50',
    name: 'Halfway',
    category: 'stat',
    description: 'Reach OVR 50.',
    condition: (s) => s.ovr >= 50,
  },
  {
    id: 'ovr_75',
    name: 'Locked In',
    category: 'stat',
    description: 'Reach OVR 75.',
    condition: (s) => s.ovr >= 75,
  },

  // ── Social ──
  {
    id: 'first_invite',
    name: 'Mentor Drop',
    category: 'social',
    description: 'Invite your first friend.',
    condition: (s) => s.invites_used >= 1,
  },
];

export const ACHIEVEMENT_BY_ID: Record<string, Achievement> =
  ACHIEVEMENT_CATALOG.reduce(
    (acc, a) => {
      acc[a.id] = a;
      return acc;
    },
    {} as Record<string, Achievement>,
  );
