/**
 * MissionData.ts
 * Full mission matrix: 10 Core + 105 Goal (7×15) + 40 Weakness (5×8) = 155 templates.
 *
 * Each template carries XP values per difficulty tier and optional time-gate.
 */

import type { MissionType, CompletionType, MissionDuration, ProgressMetric } from './MissionEngine';

export interface MissionTemplate {
  title: string;
  description: string;
  type: MissionType;
  completionType: CompletionType;
  xp: { easy: number; medium: number; hard: number };
  timeGate?: string;
  /** For core missions, the task description changes per tier. */
  variants?: { easy: string; medium: string; hard: string };
  /** 'daily' (default) or 'weekly'. Weekly missions persist across the week. */
  duration?: MissionDuration;
  /** Target value to auto-complete a weekly mission. */
  progressTarget?: number;
  /** What metric drives progress toward completion. */
  progressMetric?: ProgressMetric;
}

// ──────────────────────────────────────────────
// SLOT 1: Core Missions (10) — universal focus-session variants
// ──────────────────────────────────────────────

export const CORE_MISSIONS: MissionTemplate[] = [
  {
    title: 'Morning Focus Sprint',
    description: 'Complete a focus session before 10 AM',
    type: 'focus_session',
    completionType: 'auto',
    xp: { easy: 15, medium: 20, hard: 25 },
    variants: { easy: '15-min session', medium: '30-min session', hard: '45-min session' },
  },
  {
    title: 'Deep Work Block',
    description: 'Lock in for an extended focus session',
    type: 'focus_session',
    completionType: 'auto',
    xp: { easy: 20, medium: 25, hard: 30 },
    variants: { easy: '30-min block', medium: '45-min block', hard: '60-min block' },
  },
  {
    title: 'Afternoon Lock In',
    description: 'Complete a focus session between 12-5 PM',
    type: 'focus_session',
    completionType: 'auto',
    xp: { easy: 15, medium: 20, hard: 25 },
    variants: { easy: '15-min session', medium: '30-min session', hard: '45-min session' },
  },
  {
    title: 'Evening Focus Session',
    description: 'Lock in during the evening hours (5-9 PM)',
    type: 'focus_session',
    completionType: 'auto',
    xp: { easy: 15, medium: 20, hard: 25 },
    variants: { easy: '15-min session', medium: '25-min session', hard: '40-min session' },
  },
  {
    title: 'Double Lock In',
    description: 'Complete 2 separate focus sessions today',
    type: 'focus_session',
    completionType: 'auto',
    xp: { easy: 20, medium: 25, hard: 30 },
    variants: { easy: '2 × 15-min', medium: '2 × 25-min', hard: '2 × 30-min' },
  },
  {
    title: 'Focus Marathon',
    description: 'Accumulate total focus minutes today',
    type: 'focus_session',
    completionType: 'auto',
    xp: { easy: 20, medium: 25, hard: 35 },
    variants: { easy: '45 total min', medium: '60 total min', hard: '90 total min' },
  },
  {
    title: 'Hit Your Daily Goal',
    description: 'Reach your daily focus commitment',
    type: 'focus_session',
    completionType: 'auto',
    xp: { easy: 25, medium: 25, hard: 30 },
    variants: { easy: 'Hit 100% of daily goal', medium: 'Hit 100% of daily goal', hard: 'Hit 120% of daily goal' },
  },
  {
    title: 'Streak Builder',
    description: 'Maintain your streak by locking in today',
    type: 'focus_session',
    completionType: 'auto',
    xp: { easy: 15, medium: 20, hard: 25 },
    variants: { easy: 'Any session today', medium: '20+ min session', hard: '30+ min session' },
  },
  {
    title: 'First Thing Focus',
    description: 'Start a focus session within 30 min of opening app',
    type: 'focus_session',
    completionType: 'auto',
    xp: { easy: 15, medium: 20, hard: 25 },
    variants: { easy: 'Within 30 min', medium: 'Within 15 min', hard: 'Within 5 min' },
  },
  {
    title: 'Distraction-Free Hour',
    description: 'Complete a session with zero phone unlocks',
    type: 'focus_session',
    completionType: 'auto',
    xp: { easy: 25, medium: 30, hard: 35 },
    variants: { easy: '30 min no unlocks', medium: '45 min no unlocks', hard: '60 min no unlocks' },
  },
];

// ──────────────────────────────────────────────
// SLOT 2: Goal-Specific Missions (15 per goal × 7 goals)
// ──────────────────────────────────────────────

export const GOAL_MISSIONS: Record<string, MissionTemplate[]> = {
  'Improve my physique': [
    { title: 'Gym Check-In', description: 'Log your workout or training session', type: 'workout_check', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Cold Shower Challenge', description: 'Take a cold shower (2+ minutes)', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Hydration Goal', description: 'Drink 2+ liters of water today', type: 'lifestyle', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 }, timeGate: 'After 3 PM' },
    { title: 'No Junk Food Today', description: 'Avoid processed food and sugar all day', type: 'lifestyle', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 8 PM' },
    { title: 'Morning Workout', description: 'Complete a workout before 10 AM', type: 'workout_check', completionType: 'self-report', xp: { easy: 25, medium: 25, hard: 30 } },
    { title: 'Step Count Goal', description: 'Hit 8,000+ steps today', type: 'lifestyle', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 5 PM' },
    { title: 'Sleep Before Midnight', description: 'Be in bed with phone locked by 12 AM', type: 'lifestyle', completionType: 'hybrid', xp: { easy: 20, medium: 20, hard: 25 }, timeGate: 'After 11 PM' },
    { title: 'Meal Prep Session', description: 'Prepare meals for tomorrow', type: 'lifestyle', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'No Alcohol Today', description: 'Stay sober for the full day', type: 'discipline', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 9 PM' },
    { title: 'Stretching / Mobility', description: 'Complete a 10+ min stretching routine', type: 'workout_check', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'Track Your Macros', description: 'Log all meals and macronutrients today', type: 'lifestyle', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 6 PM' },
    { title: 'Active Recovery Day', description: 'Walk, swim, or do light activity for 20+ min', type: 'workout_check', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'No Eating After 8 PM', description: 'Close your eating window by 8 PM', type: 'lifestyle', completionType: 'hybrid', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 8 PM' },
    { title: 'Protein Goal', description: 'Hit your daily protein target', type: 'lifestyle', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 6 PM' },
    { title: 'Cardio Session', description: 'Complete 20+ min of cardio', type: 'workout_check', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
  ],

  'Build a business or side project': [
    { title: 'Ship One Thing', description: 'Complete and publish/deploy one deliverable', type: 'planning', completionType: 'self-report', xp: { easy: 25, medium: 30, hard: 35 } },
    { title: 'Write 3 Daily Priorities', description: 'List your top 3 tasks for today', type: 'planning', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'Revenue-Generating Task', description: 'Work on something directly tied to income', type: 'planning', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Learn Something New', description: 'Spend 20+ min learning a skill for your project', type: 'reading', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Outreach / Networking', description: 'Send 3 messages to potential clients/partners', type: 'social', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Content Creation', description: 'Create 1 piece of content for your brand', type: 'planning', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Review Weekly Progress', description: 'Assess milestones and adjust your plan', type: 'reflection', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'No Distractions Until Noon', description: 'Zero social media/entertainment before 12 PM', type: 'no_social', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 12 PM' },
    { title: 'Deep Work on Core Feature', description: '60+ min on your most important project task', type: 'focus_session', completionType: 'self-report', xp: { easy: 25, medium: 30, hard: 35 } },
    { title: 'Customer Research', description: 'Talk to or research 1 potential customer', type: 'social', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Financial Check-In', description: 'Review revenue, expenses, or runway', type: 'planning', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Inbox Zero', description: 'Clear all business-related messages by end of day', type: 'planning', completionType: 'hybrid', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 5 PM' },
    { title: 'Pitch Practice', description: 'Practice explaining your project to someone', type: 'social', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Document a Process', description: 'Write down one workflow or SOP', type: 'journal', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'End-of-Day Review', description: "Write what you accomplished and tomorrow's plan", type: 'reflection', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 }, timeGate: 'After 6 PM' },
  ],

  'Increase discipline & self-control': [
    { title: 'No Social Media Today', description: 'Avoid all social media apps for 24 hours', type: 'no_social', completionType: 'hybrid', xp: { easy: 25, medium: 30, hard: 35 }, timeGate: 'After 9 PM' },
    { title: 'Cold Exposure', description: 'Cold shower or ice bath for 2+ minutes', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Make Your Bed', description: 'Make your bed within 5 min of waking up', type: 'discipline', completionType: 'self-report', xp: { easy: 10, medium: 10, hard: 15 } },
    { title: 'No Excuses Workout', description: "Exercise even if you don't feel like it", type: 'workout_check', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Eat Clean All Day', description: 'No processed food, sugar, or fast food', type: 'lifestyle', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 8 PM' },
    { title: 'Wake Up on First Alarm', description: 'No snooze — get up immediately', type: 'discipline', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Phone-Free First Hour', description: 'No phone for 60 min after waking', type: 'no_social', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Delayed Gratification', description: 'Resist one temptation and write what it was', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Do the Hard Thing First', description: 'Complete your hardest task before anything fun', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'No YouTube / Netflix', description: 'Zero streaming entertainment today', type: 'no_social', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 9 PM' },
    { title: 'Read 10 Pages', description: 'Read 10 pages of a non-fiction book', type: 'reading', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Evening Planning', description: "Plan tomorrow's schedule before bed", type: 'planning', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 }, timeGate: 'After 7 PM' },
    { title: 'Say No to One Thing', description: 'Decline a distraction or unproductive invite', type: 'discipline', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Posture Check', description: 'Maintain good posture during all focus sessions', type: 'discipline', completionType: 'self-report', xp: { easy: 10, medium: 15, hard: 20 } },
    { title: 'No Complaining', description: 'Go the full day without complaining', type: 'discipline', completionType: 'hybrid', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 8 PM' },
  ],

  'Advance my career': [
    { title: 'Industry Reading', description: 'Read an article or chapter related to your field', type: 'reading', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Skill Building Session', description: 'Spend 30+ min learning a professional skill', type: 'reading', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Network Outreach', description: 'Connect with 1 person in your industry', type: 'social', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Update Your Portfolio', description: 'Add or improve one item in your portfolio/resume', type: 'planning', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Deep Work on Key Project', description: '60+ min on your highest-impact work task', type: 'focus_session', completionType: 'self-report', xp: { easy: 25, medium: 30, hard: 35 } },
    { title: 'Write Down Career Goals', description: 'Revisit and refine your 6-month career vision', type: 'planning', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'No Distractions Until Lunch', description: 'Zero non-work apps before 12 PM', type: 'no_social', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 12 PM' },
    { title: 'Ask for Feedback', description: 'Request constructive feedback from a peer or mentor', type: 'social', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Public Learning', description: 'Share something you learned online (LinkedIn, X)', type: 'social', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Organize Your Workspace', description: 'Clean desk, close tabs, organize files', type: 'planning', completionType: 'self-report', xp: { easy: 10, medium: 15, hard: 20 } },
    { title: 'Practice a Presentation', description: 'Rehearse a pitch, talk, or meeting delivery', type: 'social', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'End-of-Day Wins Log', description: 'Write 3 professional accomplishments from today', type: 'journal', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 }, timeGate: 'After 5 PM' },
    { title: 'Apply to One Opportunity', description: 'Submit an application, pitch, or proposal', type: 'planning', completionType: 'self-report', xp: { easy: 25, medium: 30, hard: 35 } },
    { title: 'Mentor or Help Someone', description: 'Share your knowledge with someone junior', type: 'social', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Plan Next Week', description: 'Map out your professional priorities for the week', type: 'planning', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
  ],

  'Study with consistency': [
    { title: 'Study Block', description: 'Complete a dedicated 45-min study session', type: 'focus_session', completionType: 'auto', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Review Your Notes', description: "Spend 15+ min reviewing today's material", type: 'journal', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Flashcard Session', description: 'Complete 20+ flashcards or practice problems', type: 'reading', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Teach What You Learned', description: 'Explain a concept out loud or to someone', type: 'social', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'No Phone While Studying', description: 'Keep phone locked during all study sessions', type: 'no_social', completionType: 'auto', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Study Before Fun', description: 'Complete study session before any entertainment', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Morning Study Session', description: 'Study for 30+ min before noon', type: 'focus_session', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Summarize One Topic', description: 'Write a 1-paragraph summary of what you learned', type: 'journal', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Double Study Day', description: 'Complete 2 separate study sessions', type: 'focus_session', completionType: 'auto', xp: { easy: 25, medium: 30, hard: 35 } },
    { title: 'Clear Study Space', description: 'Organize desk and remove all distractions before starting', type: 'planning', completionType: 'self-report', xp: { easy: 10, medium: 10, hard: 15 } },
    { title: 'Practice Problems', description: 'Solve 5+ problems without looking at answers', type: 'reading', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: "Plan Tomorrow's Study", description: "Write out exactly what you'll study tomorrow", type: 'planning', completionType: 'self-report', xp: { easy: 10, medium: 15, hard: 20 }, timeGate: 'After 6 PM' },
    { title: 'No Social Media Until Done', description: 'Zero social apps until all study is complete', type: 'no_social', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Study Group / Discussion', description: 'Discuss material with a peer for 15+ min', type: 'social', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Weekly Review', description: 'Go over everything from this week for 30+ min', type: 'reflection', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
  ],

  'Reduce distractions': [
    { title: 'No Social Media Until Noon', description: 'Zero social apps before 12 PM', type: 'no_social', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 12 PM' },
    { title: 'App Blocker Active', description: 'Keep distracting apps blocked for 4+ hours', type: 'no_social', completionType: 'auto', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Notification Detox', description: 'Turn off all non-essential notifications for the day', type: 'no_social', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Single-Task Session', description: 'Focus on one task only for 30+ min (no tab-switching)', type: 'focus_session', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Phone in Another Room', description: 'Keep phone out of reach during one focus session', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'No YouTube Today', description: 'Avoid YouTube entirely for 24 hours', type: 'no_social', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 9 PM' },
    { title: 'Screen Time Under X Hours', description: 'Keep total screen time below your threshold', type: 'no_social', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 8 PM' },
    { title: 'Close All Tabs', description: 'Start each focus session with a clean browser', type: 'planning', completionType: 'self-report', xp: { easy: 10, medium: 15, hard: 20 } },
    { title: 'Airplane Mode Focus', description: 'Do one focus session in airplane mode', type: 'focus_session', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'No News Today', description: 'Avoid news apps and websites all day', type: 'no_social', completionType: 'hybrid', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 8 PM' },
    { title: 'Phone-Free Meals', description: 'Eat every meal today without phone present', type: 'discipline', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 7 PM' },
    { title: 'Evening Digital Sunset', description: 'No screens after 9 PM', type: 'no_social', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 9 PM' },
    { title: 'Batch Communication', description: 'Check messages only 2 times today', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Unsubscribe from 3 Things', description: 'Remove 3 email lists, notifications, or follows', type: 'planning', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'Grayscale Mode', description: 'Put phone in grayscale for the full day', type: 'discipline', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
  ],

  'Improve emotional control': [
    { title: 'Journaling Session', description: 'Write about your emotional state for 10+ min', type: 'journal', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Breathing Exercise', description: 'Complete a 5+ min breathing or box breathing session', type: 'reflection', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'No Reactive Messaging', description: 'Wait 10 min before replying to anything that triggers you', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Gratitude List', description: "Write 3 things you're grateful for today", type: 'journal', completionType: 'self-report', xp: { easy: 10, medium: 15, hard: 20 } },
    { title: 'Identify Your Triggers', description: 'Write down 1 emotional trigger you noticed today', type: 'journal', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 5 PM' },
    { title: 'Mindful Walk', description: 'Take a 15+ min walk with no phone', type: 'lifestyle', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'No Complaining', description: 'Go the full day without complaining', type: 'discipline', completionType: 'hybrid', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 8 PM' },
    { title: 'Forgiveness Practice', description: "Let go of one thing that's been bothering you", type: 'reflection', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Phone-Free Evening', description: 'No phone after 8 PM', type: 'no_social', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 8 PM' },
    { title: 'Listen Without Interrupting', description: "In one conversation, only listen — don't react", type: 'social', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Positive Self-Talk', description: 'Replace 3 negative thoughts with constructive ones', type: 'reflection', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'Sleep Routine', description: 'Start wind-down routine 30 min before bed', type: 'lifestyle', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 10 PM' },
    { title: 'Accept One Discomfort', description: 'Do something uncomfortable without avoiding it', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Limit Negative Content', description: 'Avoid toxic content (news, drama, rage bait) all day', type: 'no_social', completionType: 'hybrid', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 8 PM' },
    { title: 'End-of-Day Reflection', description: 'Write about your emotional wins and losses today', type: 'reflection', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 }, timeGate: 'After 7 PM' },
  ],
};

// ──────────────────────────────────────────────
// SLOT 3: Weakness Missions (8 per weakness × 5 weaknesses)
// ──────────────────────────────────────────────

export const WEAKNESS_MISSIONS: Record<string, MissionTemplate[]> = {
  'I scroll when I should execute': [
    { title: 'Phone Down, Work Up', description: 'Start a focus session within 5 min of opening app', type: 'focus_session', completionType: 'auto', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'No Social Before Work', description: 'Zero social media until first focus session is done', type: 'no_social', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Delete One Time-Waster', description: 'Remove or hide one app that wastes your time', type: 'discipline', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'App Timer Enforced', description: 'Set a 30-min daily limit on your most-used scroll app', type: 'no_social', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Lock In First, Scroll Later', description: 'Complete daily focus goal before any entertainment', type: 'focus_session', completionType: 'auto', xp: { easy: 25, medium: 30, hard: 35 } },
    { title: 'Replace Scroll with Action', description: 'Every time you catch yourself scrolling, do 10 pushups', type: 'discipline', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Airplane Mode Morning', description: 'Stay in airplane mode for 1st hour after waking', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Screen Time Check', description: 'Keep social media screen time under 30 minutes today', type: 'no_social', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 8 PM' },
    { title: 'Never Miss Twice', description: 'Maintain your streak — lock in every day this week', type: 'focus_session', completionType: 'auto', xp: { easy: 20, medium: 20, hard: 25 }, duration: 'weekly', progressTarget: 7, progressMetric: 'days_active' },
    { title: 'Daily Check-In', description: 'Open the app before 9 AM on 5+ days this week', type: 'focus_session', completionType: 'auto', xp: { easy: 10, medium: 15, hard: 20 }, duration: 'weekly', progressTarget: 5, progressMetric: 'first_open_before_9am' },
    { title: 'Weekly Consistency Score', description: 'Lock in on 5+ days this week', type: 'focus_session', completionType: 'auto', xp: { easy: 25, medium: 30, hard: 35 }, duration: 'weekly', progressTarget: 5, progressMetric: 'days_active' },
  ],

  'I start strong, then fall off': [
    { title: 'Show Up Today', description: 'Complete at least 1 focus session (any length)', type: 'focus_session', completionType: 'auto', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'Minimum Viable Session', description: "Even if you don't want to, lock in for 10 min", type: 'focus_session', completionType: 'auto', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'Streak Check-In', description: 'Acknowledge your streak and commit to keeping it', type: 'discipline', completionType: 'self-report', xp: { easy: 10, medium: 15, hard: 20 } },
    { title: 'Write Why You Started', description: 'Write 1 sentence about why you began this journey', type: 'journal', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Easy Win', description: 'Complete the easiest mission first to build momentum', type: 'discipline', completionType: 'self-report', xp: { easy: 10, medium: 15, hard: 20 } },
    { title: 'No Zero Days', description: 'Do at least one productive thing, no matter how small', type: 'discipline', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'Recommit Ritual', description: 'Re-read your goals and restate your commitment', type: 'reflection', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Tell Someone Your Goal', description: "Share today's goal with a friend for accountability", type: 'social', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Never Miss Twice', description: 'Maintain your streak — lock in every day this week', type: 'focus_session', completionType: 'auto', xp: { easy: 20, medium: 20, hard: 25 }, duration: 'weekly', progressTarget: 7, progressMetric: 'days_active' },
    { title: 'Daily Check-In', description: 'Open the app before 9 AM on 5+ days this week', type: 'focus_session', completionType: 'auto', xp: { easy: 10, medium: 15, hard: 20 }, duration: 'weekly', progressTarget: 5, progressMetric: 'first_open_before_9am' },
    { title: 'Weekly Consistency Score', description: 'Lock in on 5+ days this week', type: 'focus_session', completionType: 'auto', xp: { easy: 25, medium: 30, hard: 35 }, duration: 'weekly', progressTarget: 5, progressMetric: 'days_active' },
  ],

  'I get emotionally reactive': [
    { title: 'Pause Before Responding', description: 'Wait 10 seconds before reacting to any trigger', type: 'discipline', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Trigger Journal', description: 'Write down what triggered you and your reaction', type: 'journal', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 5 PM' },
    { title: 'Box Breathing Session', description: 'Complete 3 min of box breathing when stressed', type: 'reflection', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'Reframe One Negative', description: 'Take a negative thought and find a constructive angle', type: 'reflection', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'No Arguing Today', description: 'Walk away from or de-escalate any conflict', type: 'discipline', completionType: 'hybrid', xp: { easy: 20, medium: 25, hard: 30 }, timeGate: 'After 8 PM' },
    { title: 'Emotional Score', description: 'Rate your emotional control 1-10 at end of day', type: 'reflection', completionType: 'self-report', xp: { easy: 10, medium: 15, hard: 20 }, timeGate: 'After 7 PM' },
    { title: 'Silent Focus', description: 'Complete a focus session in total silence', type: 'focus_session', completionType: 'auto', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Limit Rage Content', description: 'Avoid all outrage/drama content today', type: 'no_social', completionType: 'hybrid', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 8 PM' },
    { title: 'Never Miss Twice', description: 'Maintain your streak — lock in every day this week', type: 'focus_session', completionType: 'auto', xp: { easy: 20, medium: 20, hard: 25 }, duration: 'weekly', progressTarget: 7, progressMetric: 'days_active' },
    { title: 'Daily Check-In', description: 'Open the app before 9 AM on 5+ days this week', type: 'focus_session', completionType: 'auto', xp: { easy: 10, medium: 15, hard: 20 }, duration: 'weekly', progressTarget: 5, progressMetric: 'first_open_before_9am' },
    { title: 'Weekly Consistency Score', description: 'Lock in on 5+ days this week', type: 'focus_session', completionType: 'auto', xp: { easy: 25, medium: 30, hard: 35 }, duration: 'weekly', progressTarget: 5, progressMetric: 'days_active' },
  ],

  'I relapse into distractions': [
    { title: 'Temptation Bundling', description: 'Only allow a reward after completing a focus session', type: 'discipline', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Environment Reset', description: 'Remove one distraction from your physical space', type: 'planning', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'Relapse Log', description: 'Write down when you relapsed and what triggered it', type: 'journal', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 6 PM' },
    { title: 'Lock In Marathon', description: 'Keep phone locked for 2+ hours straight', type: 'focus_session', completionType: 'auto', xp: { easy: 25, medium: 30, hard: 35 } },
    { title: 'One App Deleted', description: 'Delete or log out of your biggest distraction app', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Pre-Commitment', description: "Write out exactly when and what you'll work on today", type: 'planning', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 } },
    { title: 'Distraction Tally', description: 'Count every time you get distracted today', type: 'journal', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 }, timeGate: 'After 6 PM' },
    { title: 'Reward Only After Goal', description: 'No entertainment until daily focus goal is hit', type: 'focus_session', completionType: 'auto', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Never Miss Twice', description: 'Maintain your streak — lock in every day this week', type: 'focus_session', completionType: 'auto', xp: { easy: 20, medium: 20, hard: 25 }, duration: 'weekly', progressTarget: 7, progressMetric: 'days_active' },
    { title: 'Daily Check-In', description: 'Open the app before 9 AM on 5+ days this week', type: 'focus_session', completionType: 'auto', xp: { easy: 10, medium: 15, hard: 20 }, duration: 'weekly', progressTarget: 5, progressMetric: 'first_open_before_9am' },
    { title: 'Weekly Consistency Score', description: 'Lock in on 5+ days this week', type: 'focus_session', completionType: 'auto', xp: { easy: 25, medium: 30, hard: 35 }, duration: 'weekly', progressTarget: 5, progressMetric: 'days_active' },
  ],

  'I lack daily consistency': [
    { title: 'Same Time, Every Day', description: 'Start your focus session at the same time as yesterday', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Morning Anchor', description: 'Complete one productive action within 30 min of waking', type: 'discipline', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Never Miss Twice', description: 'Maintain your streak — lock in every day this week', type: 'focus_session', completionType: 'auto', xp: { easy: 20, medium: 20, hard: 25 }, duration: 'weekly', progressTarget: 7, progressMetric: 'days_active' },
    { title: 'Evening Prep', description: "Prepare tomorrow's workspace/outfit/plan before bed", type: 'planning', completionType: 'self-report', xp: { easy: 15, medium: 15, hard: 20 }, timeGate: 'After 7 PM' },
    { title: 'Daily Check-In', description: 'Open the app before 9 AM on 5+ days this week', type: 'focus_session', completionType: 'auto', xp: { easy: 10, medium: 15, hard: 20 }, duration: 'weekly', progressTarget: 5, progressMetric: 'first_open_before_9am' },
    { title: 'Routine Tracker', description: 'Complete your entire morning routine as planned', type: 'discipline', completionType: 'self-report', xp: { easy: 20, medium: 25, hard: 30 } },
    { title: 'Bedtime Alarm', description: 'Be in bed by your target time', type: 'lifestyle', completionType: 'self-report', xp: { easy: 15, medium: 20, hard: 25 } },
    { title: 'Weekly Consistency Score', description: 'Lock in on 5+ days this week', type: 'focus_session', completionType: 'auto', xp: { easy: 25, medium: 30, hard: 35 }, duration: 'weekly', progressTarget: 5, progressMetric: 'days_active' },
  ],
};
