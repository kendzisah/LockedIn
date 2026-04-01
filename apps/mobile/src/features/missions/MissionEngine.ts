/**
 * MissionEngine.ts
 * Generates and manages daily missions personalized by user's primary goal
 */

export type MissionType = 'focus_session' | 'workout_check' | 'reflection' | 'no_social' | 'journal' | 'reading' | 'planning' | 'custom';

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  completed: boolean;
  xp: number;
}

/**
 * Generates a deterministic ID based on day and seed
 * Ensures same missions for same day
 */
const generateMissionId = (dayOfYear: number, index: number): string => {
  return `mission_${dayOfYear}_${index}`;
};

/**
 * Get the day of year (0-365) for deterministic mission generation
 */
const getDayOfYear = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
};

/**
 * Mission definitions for each primary goal
 */
const MISSION_TEMPLATES = {
  'Improve my physique': [
    {
      title: 'Deep Focus Session',
      description: 'Complete a 45-minute focused work session without distractions',
      type: 'focus_session' as const,
      xp: 25,
    },
    {
      title: 'Workout Check-In',
      description: 'Log your workout or complete a training session',
      type: 'workout_check' as const,
      xp: 30,
    },
    {
      title: 'No Social Media Before Noon',
      description: 'Avoid social media until after 12 PM',
      type: 'no_social' as const,
      xp: 20,
    },
  ],
  'Build a business or side project': [
    {
      title: 'Deep Work Session',
      description: 'Dedicate 60 minutes to your business or side project',
      type: 'focus_session' as const,
      xp: 30,
    },
    {
      title: 'Write 3 Daily Priorities',
      description: 'Document your top 3 goals for your project today',
      type: 'planning' as const,
      xp: 15,
    },
    {
      title: 'Review Progress',
      description: 'Check milestones and assess what you accomplished',
      type: 'reflection' as const,
      xp: 20,
    },
  ],
  'Increase discipline & self-control': [
    {
      title: 'Morning Focus Ritual',
      description: 'Start your day with a 30-minute focused work block',
      type: 'focus_session' as const,
      xp: 25,
    },
    {
      title: 'No Social Media Today',
      description: 'Eliminate distracting apps for the entire day',
      type: 'no_social' as const,
      xp: 30,
    },
    {
      title: 'Evening Reflection',
      description: 'Reflect on your self-control victories today',
      type: 'reflection' as const,
      xp: 20,
    },
  ],
  'Advance my career': [
    {
      title: 'Focused Work Session',
      description: 'Complete 50 minutes of deep, career-focused work',
      type: 'focus_session' as const,
      xp: 25,
    },
    {
      title: 'Industry Reading',
      description: 'Read an article or chapter relevant to your career',
      type: 'reading' as const,
      xp: 15,
    },
    {
      title: 'Plan Your Growth',
      description: 'Outline one actionable step toward your career goal',
      type: 'planning' as const,
      xp: 20,
    },
  ],
  'Study with consistency': [
    {
      title: 'Study Session',
      description: 'Complete a dedicated 45-minute study block',
      type: 'focus_session' as const,
      xp: 25,
    },
    {
      title: 'Review Your Notes',
      description: 'Review and organize today\'s learning',
      type: 'journal' as const,
      xp: 15,
    },
    {
      title: 'Stay Distraction-Free',
      description: 'Keep your study environment clear of interruptions',
      type: 'no_social' as const,
      xp: 20,
    },
  ],
  'Reduce distractions': [
    {
      title: 'Focus Session',
      description: 'Complete 45 minutes of distraction-free work',
      type: 'focus_session' as const,
      xp: 25,
    },
    {
      title: 'No Social Media',
      description: 'Avoid all social media apps today',
      type: 'no_social' as const,
      xp: 30,
    },
    {
      title: 'End-of-Day Reflection',
      description: 'Reflect on moments you stayed disciplined',
      type: 'reflection' as const,
      xp: 20,
    },
  ],
  'Improve emotional control': [
    {
      title: 'Mindful Focus Session',
      description: 'Complete 30 minutes of focused work with intention',
      type: 'focus_session' as const,
      xp: 20,
    },
    {
      title: 'Emotional Check-In',
      description: 'Journal about your emotional state today',
      type: 'journal' as const,
      xp: 20,
    },
    {
      title: 'Reflection & Reset',
      description: 'Reflect on your emotional triggers and wins',
      type: 'reflection' as const,
      xp: 25,
    },
  ],
};

/**
 * Default missions (used if goal not matched)
 */
const DEFAULT_MISSIONS = [
  {
    title: 'Focus Session',
    description: 'Complete a 45-minute focused work session',
    type: 'focus_session' as const,
    xp: 25,
  },
  {
    title: 'Daily Reflection',
    description: 'Reflect on your progress and wins today',
    type: 'reflection' as const,
    xp: 15,
  },
  {
    title: 'No Social Media',
    description: 'Avoid social media for the day',
    type: 'no_social' as const,
    xp: 20,
  },
];

/**
 * Generate 3 daily missions personalized by primary goal
 * @param goal - User's primary goal
 * @param date - Date for mission generation (defaults to today)
 * @returns Array of 3 Mission objects
 */
export const getMissionsForGoal = (goal: string, date: Date = new Date()): Mission[] => {
  const dayOfYear = getDayOfYear(date);

  // Select template based on goal
  const template = MISSION_TEMPLATES[goal as keyof typeof MISSION_TEMPLATES] || DEFAULT_MISSIONS;

  // Generate missions from template
  return template.map((missionTemplate, index) => ({
    id: generateMissionId(dayOfYear, index),
    title: missionTemplate.title,
    description: missionTemplate.description,
    type: missionTemplate.type,
    completed: false,
    xp: missionTemplate.xp,
  }));
};

/**
 * Get all valid primary goals
 */
export const getPrimaryGoals = (): string[] => {
  return Object.keys(MISSION_TEMPLATES);
};

/**
 * Calculate total XP from an array of missions
 */
export const calculateTotalXP = (missions: Mission[]): number => {
  return missions.reduce((total, mission) => total + mission.xp, 0);
};

/**
 * Get count of completed missions
 */
export const getCompletedCount = (missions: Mission[]): number => {
  return missions.filter(m => m.completed).length;
};
