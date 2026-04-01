import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GymCheckInState {
  checkins: Record<string, boolean>;
  weeklyCount: number;
  monthlyCount: number;
  currentWeekStart: string;
}

const STORAGE_KEY = '@lockedin/gym_checkin';

class GymCheckInService {
  /**
   * Initialize or get current check-in state
   */
  private async getState(): Promise<GymCheckInState> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return this.initializeState();
      }

      const state: GymCheckInState = JSON.parse(stored);

      // Check if week has changed
      const weekStart = this.getWeekStartDate();
      if (state.currentWeekStart !== weekStart) {
        // Week changed, reset weekly count
        return {
          ...state,
          checkins: {},
          weeklyCount: 0,
          currentWeekStart: weekStart,
        };
      }

      return state;
    } catch (error) {
      console.error('[GymCheckInService] Error getting state:', error);
      return this.initializeState();
    }
  }

  /**
   * Initialize default state
   */
  private initializeState(): GymCheckInState {
    return {
      checkins: {},
      weeklyCount: 0,
      monthlyCount: 0,
      currentWeekStart: this.getWeekStartDate(),
    };
  }

  /**
   * Save state to AsyncStorage
   */
  private async setState(state: GymCheckInState): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[GymCheckInService] Error saving state:', error);
    }
  }

  /**
   * Check in for a specific date (or today if not provided)
   */
  async checkIn(date?: string): Promise<void> {
    const dateStr = date || this.getTodayDateString();
    const state = await this.getState();

    // Only increment counts if this is a new check-in for this date
    if (!state.checkins[dateStr]) {
      state.checkins[dateStr] = true;
      state.weeklyCount += 1;
      state.monthlyCount += 1;
    } else {
      // Toggle off
      state.checkins[dateStr] = false;
      state.weeklyCount = Math.max(0, state.weeklyCount - 1);
      state.monthlyCount = Math.max(0, state.monthlyCount - 1);
    }

    await this.setState(state);
  }

  /**
   * Check if already checked in today
   */
  async isCheckedInToday(): Promise<boolean> {
    const state = await this.getState();
    const todayStr = this.getTodayDateString();
    return state.checkins[todayStr] === true;
  }

  /**
   * Get weekly check-in count (0-7)
   */
  async getWeeklyCount(): Promise<number> {
    const state = await this.getState();
    return state.weeklyCount;
  }

  /**
   * Get monthly check-in count
   */
  async getMonthlyCount(): Promise<number> {
    const state = await this.getState();
    return state.monthlyCount;
  }

  /**
   * Get consecutive days with check-ins
   */
  async getStreak(): Promise<number> {
    const state = await this.getState();
    let streak = 0;
    const today = new Date();

    // Start from today and count backwards
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = this.formatDate(checkDate);

      if (state.checkins[dateStr] === true) {
        streak++;
      } else if (i > 0) {
        // Break if we find a gap (don't break on first iteration in case today isn't checked in)
        break;
      }
    }

    return streak;
  }

  /**
   * Get check-in status for a specific week (Monday-Sunday)
   * Returns array of 7 booleans
   */
  async getWeekCheckIns(): Promise<boolean[]> {
    const state = await this.getState();
    const weekStart = new Date(state.currentWeekStart);
    const checkins: boolean[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = this.formatDate(date);
      checkins.push(state.checkins[dateStr] === true);
    }

    return checkins;
  }

  /**
   * Get all check-in data
   */
  async getState_Public(): Promise<GymCheckInState> {
    return this.getState();
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get today's date string
   */
  private getTodayDateString(): string {
    return this.formatDate(new Date());
  }

  /**
   * Get week start date (Monday) as YYYY-MM-DD
   */
  private getWeekStartDate(): string {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);

    return this.formatDate(weekStart);
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[GymCheckInService] Error clearing data:', error);
    }
  }
}

export default new GymCheckInService();
