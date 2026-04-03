import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WeeklyReport {
  weekStartDate: string;
  daysLockedIn: number;
  totalFocusMinutes: number;
  missionsCompleted: number;
  totalMissions: number;
  streakDays: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
  previousGrade: string | null;
  percentile: number;
}

const STORAGE_KEY = '@lockedin/weekly_reports';

class WeeklyReportService {
  /**
   * Calculate weighted discipline score
   * Weighted as: days locked in (40%), focus minutes vs commitment (30%), missions (30%)
   */
  private calculateWeightedScore(
    daysLockedIn: number,
    totalFocusMinutes: number,
    dailyCommitment: number,
    missionsCompleted: number,
    totalMissions: number
  ): number {
    // Days locked in score: 40% (max 7 days)
    const daysScore = (daysLockedIn / 7) * 100 * 0.4;

    // Focus minutes score: 30% (ratio vs daily commitment * 7)
    const commitmentMinutes = dailyCommitment * 7;
    const focusScore = Math.min((totalFocusMinutes / commitmentMinutes) * 100, 100) * 0.3;

    // Missions score: 30% (ratio of completed vs total)
    const missionsScore = totalMissions > 0
      ? (missionsCompleted / totalMissions) * 100 * 0.3
      : 0;

    return daysScore + focusScore + missionsScore;
  }

  /**
   * Convert weighted score to letter grade
   */
  private scoreToGrade(score: number): WeeklyReport['grade'] {
    if (score >= 95) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 75) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 45) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  }

  /**
   * Generate weekly report from current session state
   */
  generateWeeklyReport(
    sessionState: {
      sessionsCompletedThisWeek: number;
      totalFocusMinutes: number;
    },
    missionsState: {
      completedMissions: number;
      totalMissions: number;
      streak: number;
    },
    dailyCommitment: number
  ): WeeklyReport {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - dayOfWeek);
    weekStartDate.setHours(0, 0, 0, 0);

    // Get days locked in (sessions completed)
    const daysLockedIn = Math.min(sessionState.sessionsCompletedThisWeek, 7);
    const totalFocusMinutes = sessionState.totalFocusMinutes;
    const missionsCompleted = missionsState.completedMissions;
    const totalMissions = missionsState.totalMissions || 21; // Default to 21 (3 per day)
    const streakDays = missionsState.streak;

    // Calculate score
    const score = this.calculateWeightedScore(
      daysLockedIn,
      totalFocusMinutes,
      dailyCommitment,
      missionsCompleted,
      totalMissions
    );

    const grade = this.scoreToGrade(score);

    // Get previous grade
    const lastReport = this.getLastReportSync();
    const previousGrade = lastReport?.grade || null;

    // Calculate percentile (approximation: score / 100 * 100)
    const percentile = Math.min(Math.round((score / 100) * 100), 100);

    return {
      weekStartDate: weekStartDate.toISOString(),
      daysLockedIn,
      totalFocusMinutes,
      missionsCompleted,
      totalMissions,
      streakDays,
      grade,
      previousGrade,
      percentile,
    };
  }

  /**
   * Save report to AsyncStorage
   */
  async saveReport(report: WeeklyReport): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const reports: WeeklyReport[] = existing ? JSON.parse(existing) : [];

      // Avoid duplicates for same week
      const filtered = reports.filter(
        (r) => r.weekStartDate !== report.weekStartDate
      );
      filtered.push(report);

      // Keep last 12 weeks
      const trimmed = filtered.slice(-12);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('[WeeklyReportService] Error saving report:', error);
    }
  }

  /**
   * Get last saved report
   */
  async getLastReport(): Promise<WeeklyReport | null> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const reports: WeeklyReport[] = existing ? JSON.parse(existing) : [];
      return reports.length > 0 ? reports[reports.length - 1] : null;
    } catch (error) {
      console.error('[WeeklyReportService] Error getting last report:', error);
      return null;
    }
  }

  /**
   * Sync version for use in selectors
   */
  private getLastReportSync(): WeeklyReport | null {
    try {
      // Note: This should ideally use AsyncStorage, but for sync access,
      // consider using a context or state management solution
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get all reports
   */
  async getAllReports(): Promise<WeeklyReport[]> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      return existing ? JSON.parse(existing) : [];
    } catch (error) {
      console.error('[WeeklyReportService] Error getting reports:', error);
      return [];
    }
  }

  /**
   * Determine if report should be shown
   * Returns true if: it's Sunday and report hasn't been shown yet
   */
  async shouldShowReport(): Promise<boolean> {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday

      // Check if today is Sunday
      if (dayOfWeek !== 0) {
        return false;
      }

      // Check if we've shown a report this week
      const shownKey = '@lockedin/report_shown_week';
      const shownWeek = await AsyncStorage.getItem(shownKey);
      const weekNumber = this.getWeekNumber(now);

      if (shownWeek === weekNumber.toString()) {
        return false; // Already shown this week
      }

      return true;
    } catch (error) {
      console.error('[WeeklyReportService] Error checking shouldShowReport:', error);
      return false;
    }
  }

  /**
   * Mark report as shown
   */
  async markReportAsShown(): Promise<void> {
    try {
      const now = new Date();
      const weekNumber = this.getWeekNumber(now);
      await AsyncStorage.setItem('@lockedin/report_shown_week', weekNumber.toString());
    } catch (error) {
      console.error('[WeeklyReportService] Error marking report as shown:', error);
    }
  }

  /**
   * Get week number for a date
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

export default new WeeklyReportService();
