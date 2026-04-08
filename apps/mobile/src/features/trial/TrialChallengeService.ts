import AsyncStorage from '@react-native-async-storage/async-storage';

export type TrialDayType = 1 | 2 | 3;

export type TrialTaskType = 'focusSession' | 'beatFocusTime' | 'missions' | 'disciplineReport';

export interface TrialDay {
  day: TrialDayType;
  focusSessionDone: boolean;
  missionsDone: boolean;
  focusMinutes: number;
}

export interface TrialChallengeState {
  startDate: string;
  days: TrialDay[];
  completed: boolean;
}

const STORAGE_KEY = '@lockedin/trial_challenge';
const TRIAL_DURATION_DAYS = 3;

export class TrialChallengeService {
  /**
   * Initialize a new trial challenge
   */
  static async initializeTrial(): Promise<void> {
    const state: TrialChallengeState = {
      startDate: new Date().toISOString(),
      days: [
        { day: 1, focusSessionDone: false, missionsDone: false, focusMinutes: 0 },
        { day: 2, focusSessionDone: false, missionsDone: false, focusMinutes: 0 },
        { day: 3, focusSessionDone: false, missionsDone: false, focusMinutes: 0 },
      ],
      completed: false,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Check if the trial is currently active
   * @returns true if within 3 days of trial start
   */
  static async isTrialActive(): Promise<boolean> {
    const state = await this.getState();
    if (!state) return false;

    const startDate = new Date(state.startDate);
    const now = new Date();
    const daysDiff = Math.floor(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysDiff < TRIAL_DURATION_DAYS && !state.completed;
  }

  /**
   * Get the current trial day (1, 2, or 3)
   * @returns trial day number, or 0 if trial is not active
   */
  static async getTrialDay(): Promise<TrialDayType | 0> {
    const isActive = await this.isTrialActive();
    if (!isActive) return 0;

    const state = await this.getState();
    if (!state) return 0;

    const startDate = new Date(state.startDate);
    const now = new Date();
    const daysDiff = Math.floor(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const currentDay = (daysDiff + 1) as TrialDayType;
    return currentDay <= TRIAL_DURATION_DAYS ? currentDay : (0 as any);
  }

  /**
   * Update focus minutes for a specific day
   */
  static async updateFocusMinutes(day: TrialDayType, minutes: number): Promise<void> {
    const state = await this.getState();
    if (!state) return;

    const dayData = state.days.find(d => d.day === day);
    if (dayData) {
      dayData.focusMinutes = Math.max(dayData.focusMinutes, minutes);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }

  /**
   * Mark a task as complete for a specific day
   */
  static async completeTrialTask(day: TrialDayType, task: TrialTaskType): Promise<void> {
    const state = await this.getState();
    if (!state) return;

    const dayData = state.days.find(d => d.day === day);
    if (!dayData) return;

    switch (task) {
      case 'focusSession':
        dayData.focusSessionDone = true;
        break;
      case 'beatFocusTime':
        dayData.focusSessionDone = true;
        break;
      case 'missions':
        dayData.missionsDone = true;
        break;
      case 'disciplineReport':
        // All tasks complete on day 3
        if (day === 3) {
          state.completed = true;
        }
        break;
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Get trial progress
   */
  static async getTrialProgress(): Promise<{
    day: number;
    tasksCompleted: number;
    totalTasks: number;
  }> {
    const currentDay = await this.getTrialDay();
    if (currentDay === 0) {
      return { day: 0, tasksCompleted: 0, totalTasks: 0 };
    }

    const state = await this.getState();
    if (!state) {
      return { day: currentDay, tasksCompleted: 0, totalTasks: 0 };
    }

    const dayData = state.days.find(d => d.day === currentDay);
    if (!dayData) {
      return { day: currentDay, tasksCompleted: 0, totalTasks: 0 };
    }

    let tasksCompleted = 0;
    let totalTasks = 0;

    if (currentDay === 1) {
      totalTasks = 1;
      if (dayData.focusSessionDone) tasksCompleted += 1;
    } else if (currentDay === 2) {
      totalTasks = 2;
      if (dayData.focusSessionDone) tasksCompleted += 1;
      if (dayData.missionsDone) tasksCompleted += 1;
    } else if (currentDay === 3) {
      totalTasks = 1; // Discipline Report check
      if (dayData.focusSessionDone) tasksCompleted += 1; // Simplified: treat completion as viewed report
    }

    return { day: currentDay, tasksCompleted, totalTasks };
  }

  /**
   * Get time until trial expires
   * @returns Object with hours and minutes remaining
   */
  static async getTrialTimeRemaining(): Promise<{
    hours: number;
    minutes: number;
    expired: boolean;
  }> {
    const state = await this.getState();
    if (!state) {
      return { hours: 0, minutes: 0, expired: true };
    }

    const startDate = new Date(state.startDate);
    const trialEndDate = new Date(startDate.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now >= trialEndDate) {
      return { hours: 0, minutes: 0, expired: true };
    }

    const totalMinutesRemaining = Math.floor(
      (trialEndDate.getTime() - now.getTime()) / (1000 * 60)
    );
    const hours = Math.floor(totalMinutesRemaining / 60);
    const minutes = totalMinutesRemaining % 60;

    return { hours, minutes, expired: false };
  }

  /**
   * Reset trial (clear all progress)
   */
  static async resetTrial(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Get current trial state
   */
  private static async getState(): Promise<TrialChallengeState | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      return JSON.parse(stored) as TrialChallengeState;
    } catch (error) {
      console.error('Failed to get trial challenge state:', error);
      return null;
    }
  }
}
