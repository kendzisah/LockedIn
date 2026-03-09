type Phase = 'lock_in' | 'unlock' | 'execution_block';

const LOCK_IN_MESSAGES = [
  'You Are Aligned. Now Execute.',
  'The standard is set.',
  'Identity activated.',
  'The day is yours to prove.',
  'Discipline begins with intention.',
];

const EXECUTION_BLOCK_MESSAGES = [
  'Distraction Resisted. Standard Raised.',
  'You chose focus.',
  'Execution over impulse.',
  'Discipline reinforced.',
  'You did what most avoid.',
];

const UNLOCK_MESSAGES = [
  'You Kept Your Word Today.',
  'Integrity strengthened.',
  'Consistency compounds.',
  'You showed up.',
  'Progress locked in.',
];

const MESSAGES: Record<Phase, string[]> = {
  lock_in: LOCK_IN_MESSAGES,
  execution_block: EXECUTION_BLOCK_MESSAGES,
  unlock: UNLOCK_MESSAGES,
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getCompletionMessage(phase: Phase): string {
  return pickRandom(MESSAGES[phase]);
}

interface StreakCheckpoint {
  headline: string;
  sub: string;
  detail: string;
  showWarning: boolean;
}

export function getStreakCheckpoint(streak: number): StreakCheckpoint {
  const detail = `You've shown up ${streak} day${streak === 1 ? '' : 's'} in a row.`;
  const showWarning = streak >= 7;

  if (streak >= 90) {
    return { headline: 'Consistency Is Compounding.', sub: 'You became what you practiced.', detail, showWarning };
  }
  if (streak >= 60) {
    return { headline: 'Consistency Is Compounding.', sub: 'Identity reinforced.', detail, showWarning };
  }
  if (streak >= 30) {
    return { headline: 'Consistency Is Compounding.', sub: 'This is no longer temporary.', detail, showWarning };
  }
  if (streak >= 14) {
    return { headline: 'Consistency Is Compounding.', sub: 'Standards rising.', detail, showWarning };
  }
  if (streak >= 7) {
    return { headline: 'Consistency Is Compounding.', sub: 'Consistency forming.', detail, showWarning };
  }
  if (streak >= 3) {
    return { headline: 'Consistency Is Compounding.', sub: 'Momentum started.', detail, showWarning };
  }
  return { headline: 'Consistency Is Compounding.', sub: 'Momentum started.', detail, showWarning };
}
