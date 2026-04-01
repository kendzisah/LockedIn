import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StreakRecoveryState {
  lastRecoveryDate: string | null;
  recoveriesUsedThisWeek: number;
  weekStartDate: string;
}

const STORAGE_KEY = '@lockedin/streak_recovery';
const MAX_RECOVERIES_PER_WEEK = 2;
const REQUIRED_SESSION_MINUTES = 15;

export class StreakRecoveryService {
  /**
   * Check if user can currently use a recovery
   * @returns true if user hasn't used recovery today and < 2 recoveries this week
   */
  static async canRecover(): Promise<boolean> {
    const state = await this.getState();
    const today = this.getTodayString();

    // Check if already used recovery today
    if (state.lastRecoveryDate === today) {
      return false;
    }

    // Check if exceeded weekly limit
    if (state.recoveriesUsedThisWeek >= MAX_RECOVERIES_PER_WEEK) {
      return false;
    }

    return true;
  }

  /**
   * Use a recovery and update streak
   * Recovery requires completing a 15-minute focus session
   * @param currentStreak Current streak number
   * @returns Object with newStreak and recovered flag
   */
  static async useRecovery(
    currentStreak: number
  ): Promise<{ newStreak: number; recovered: boolean }> {
    const canUse = await this.canRecover();

    if (!canUse) {
      return { newStreak: currentStreak, recovered: false };
    }

    const state = await this.getState();
    const today = this.getTodayString();

    // Update recovery usage
    state.lastRecoveryDate = today;
    state.recoveriesUsedThisWeek += 1;

    // Reset week counter if needed
    const weekStart = this.getWeekStartDate();
    if (weekStart !== state.weekStartDate) {
      state.weekStartDate = weekStart;
      state.recoveriesUsedThisWeek = 1;
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // Recovery successful: keep streak at current value (save from reset)
    return {
      newStreak: currentStreak,
      recovered: true,
    };
  }

  /**
   * Get current recovery status
   * @returns Object with available flag, used count, and max per week
   */
  static async getRecoveryStatus(): Promise<{
    available: boolean;
    usedThisWeek: number;
    maxPerWeek: number;
  }> {
    const available = await this.canRecover();
    const state = await this.getState();

    return {
      available,
      usedThisWeek: state.recoveriesUsedThisWeek,
      maxPerWeek: MAX_RECOVERIES_PER_WEEK,
    };
  }

  /**
   * Reset recovery state (typically called during app initialization)
   */
  static async resetState(): Promise<void> {
    const initialState: StreakRecoveryState = {
      lastRecoveryDate: null,
      recoveriesUsedThisWeek: 0,
      weekStartDate: this.getWeekStartDate(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
  }

  /**
   * Get current recovery state
   */
  private static async getState(): Promise<StreakRecoveryState> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) {
        await this.resetState();
        return {
          lastRecoveryDate: null,
          recoveriesUsedThisWeek: 0,
          weekStartDate: this.getWeekStartDate(),
        };
      }

      const state = JSON.parse(stored) as StreakRecoveryState;

      // Reset weekly counter if the stored week has ended
      const weekStart = this.getWeekStartDate();
      if (weekStart !== state.weekStartDate) {
        state.weekStartDate = weekStart;
        state.recoveriesUsedThisWeek = 0;
      }

      return state;
    } catch (error) {
      console.error('Failed to get streak recovery state:', error);
      await this.resetState();
      return {
        lastRecoveryDate: null,
        recoveriesUsedThisWeek: 0,
        weekStartDate: this.getWeekStartDate(),
      };
    }
  }

  /**
   * Get today's date as ISO string (YYYY-MM-DD)
   */
  private static getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get the start of the current week (Monday) as ISO string
   */
  private static getWeekStartDate(): string {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(today.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  }
}
