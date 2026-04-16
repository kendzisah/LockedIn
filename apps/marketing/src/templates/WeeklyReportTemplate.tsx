import type { CSSProperties } from 'react';

export interface WeeklyReportState {
  weekStartDate: string;
  daysLockedIn: number;
  totalFocusMinutes: number;
  missionsCompleted: number;
  totalMissions: number;
  streakDays: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
  previousGrade: string;
  percentile: number;
}

export const defaultWeeklyReport: WeeklyReportState = {
  weekStartDate: '2026-04-14T00:00:00.000Z',
  daysLockedIn: 5,
  totalFocusMinutes: 240,
  missionsCompleted: 12,
  totalMissions: 14,
  streakDays: 15,
  grade: 'A',
  previousGrade: 'B+',
  percentile: 88,
};

const gradeColors: Record<WeeklyReportState['grade'], string> = {
  'A+': '#00C2FF',
  A: '#00C2FF',
  'B+': '#3A66FF',
  B: '#3A66FF',
  C: '#9CA3AF',
  D: '#FF4757',
  F: '#FF4757',
};

function getGradeMessage(report: WeeklyReportState) {
  const GRADE_ORDER: Record<string, number> = {
    'A+': 0,
    A: 1,
    'B+': 3,
    B: 4,
    C: 7,
    D: 10,
    F: 12,
  };

  if (!report.previousGrade) {
    return `You got an ${report.grade}!`;
  }

  const curr = GRADE_ORDER[report.grade] ?? 12;
  const prev = GRADE_ORDER[report.previousGrade] ?? 12;

  if (curr < prev) {
    return `You went from ${report.previousGrade} to ${report.grade}! Great progress!`;
  }
  if (curr > prev) {
    return `You went from ${report.previousGrade} to ${report.grade}. Let's bounce back!`;
  }
  return `You held steady at ${report.grade}!`;
}

function statCard(label: string, value: string, accent: string) {
  return (
    <div style={{ ...styles.statCard, borderColor: accent }}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

export default function WeeklyReportTemplate({ state }: { state: WeeklyReportState }) {
  const gradeColor = gradeColors[state.grade];

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.reportTitle}>Your Discipline Report</div>
        </div>
        <div style={{ ...styles.gradePill, backgroundColor: `${gradeColor}22`, color: gradeColor }}>
          {state.grade}
        </div>
      </div>

      <div style={styles.gradeCard}>
        <div style={styles.gradeGradient}>
          <div style={{ ...styles.gradeValue, color: gradeColor }}>{state.grade}</div>
          <div style={styles.gradeLabel}>Weekly Grade</div>
        </div>
      </div>

      <div style={styles.gradeMessage}>{getGradeMessage(state)}</div>

      <div style={styles.statsGrid}>
        {statCard('Days Locked In', `${state.daysLockedIn}/7`, '#00C2FF')}
        {statCard('Focus Minutes', `${state.totalFocusMinutes}`, '#00C2FF')}
        {statCard('Missions', `${state.missionsCompleted}/${state.totalMissions}`, '#00C2FF')}
        {statCard('Day Streak', `${state.streakDays}`, '#00C2FF')}
      </div>

      <div style={styles.percentileSection}>
        <div style={styles.percentileHeader}>
          <div style={styles.percentileLabel}>Your Performance</div>
          <div style={{ ...styles.percentileText, color: '#00C2FF' }}>
            {state.percentile}/100
          </div>
        </div>
        <div style={styles.percentileBar}>
          <div style={{ ...styles.percentileFill, width: `${Math.min(state.percentile, 100)}%`, backgroundColor: '#00C2FF' }} />
        </div>
        <div style={styles.percentileDescription}>Your weekly performance score</div>
      </div>

      <button type="button" style={styles.ctaButton}>Keep Going</button>
    </div>
  );
}

export function WeeklyReportFields({
  state,
  onChange,
}: {
  state: WeeklyReportState;
  onChange: (newState: WeeklyReportState) => void;
}) {
  return (
    <>
      <div className="field-group">
        <div className="field-group-title">Weekly Report</div>
        <div className="field">
          <label>Week Start Date</label>
          <input
            type="text"
            value={state.weekStartDate}
            onChange={(e) => onChange({ ...state, weekStartDate: e.target.value })}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Days Locked In</label>
            <input
              type="number"
              value={state.daysLockedIn}
              min={0}
              max={7}
              onChange={(e) => onChange({ ...state, daysLockedIn: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="field">
            <label>Streak Days</label>
            <input
              type="number"
              value={state.streakDays}
              min={0}
              onChange={(e) => onChange({ ...state, streakDays: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Total Focus Minutes</label>
            <input
              type="number"
              value={state.totalFocusMinutes}
              min={0}
              onChange={(e) => onChange({ ...state, totalFocusMinutes: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="field">
            <label>Percentile</label>
            <input
              type="number"
              value={state.percentile}
              min={0}
              max={100}
              onChange={(e) => onChange({ ...state, percentile: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Missions Completed</label>
            <input
              type="number"
              value={state.missionsCompleted}
              min={0}
              onChange={(e) => onChange({ ...state, missionsCompleted: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="field">
            <label>Total Missions</label>
            <input
              type="number"
              value={state.totalMissions}
              min={0}
              onChange={(e) => onChange({ ...state, totalMissions: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Grade</label>
            <select
              value={state.grade}
              onChange={(e) => onChange({ ...state, grade: e.target.value as WeeklyReportState['grade'] })}
            >
              {['A+', 'A', 'B+', 'B', 'C', 'D', 'F'].map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Previous Grade</label>
            <input
              type="text"
              value={state.previousGrade}
              onChange={(e) => onChange({ ...state, previousGrade: e.target.value })}
            />
          </div>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(14,17,22,1) 0%, rgba(20,24,32,1) 100%)',
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    color: '#FFFFFF',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  reportTitle: {
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 800,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  gradePill: {
    padding: '10px 16px',
    borderRadius: 999,
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    minWidth: 72,
    textAlign: 'center' as const,
  },
  gradeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden' as const,
    marginTop: 20,
  },
  gradeGradient: {
    padding: '36px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, rgba(21,26,33,0.98), rgba(14,17,22,1))',
  },
  gradeValue: {
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 800,
    fontSize: 72,
    marginBottom: 8,
  },
  gradeLabel: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: 16,
    color: '#9CA3AF',
  },
  gradeMessage: {
    marginTop: 24,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    lineHeight: '24px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
    marginTop: 30,
  },
  statCard: {
    padding: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 800,
    fontSize: 28,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center' as const,
  },
  percentileSection: {
    marginTop: 30,
  },
  percentileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  percentileLabel: {
    fontFamily: "'Inter Medium', sans-serif",
    fontWeight: 500,
    fontSize: 14,
    color: '#9CA3AF',
  },
  percentileText: {
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 700,
    fontSize: 14,
  },
  percentileBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden' as const,
    background: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  percentileFill: {
    height: '100%',
    width: '0%',
    borderRadius: 4,
  },
  percentileDescription: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    color: '#9CA3AF',
  },
  ctaButton: {
    width: '100%',
    borderRadius: 12,
    padding: '16px 0',
    border: 'none',
    color: '#FFFFFF',
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 600,
    fontSize: 16,
    marginTop: 30,
    cursor: 'pointer',
    background: '#3A66FF',
  },
  statValue: {
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 800,
    fontSize: 28,
    color: '#FFFFFF',
  },
  statLabel: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: 12,
    color: '#9CA3AF',
  },
  progressSection: {
    marginTop: 24,
  },
  progressLabel: {
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 700,
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  progressBarBg: {
    width: '100%',
    height: 14,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.3s ease',
  },
  progressValue: {
    marginTop: 10,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: 13,
    color: '#9CA3AF',
  },
  previousGrade: {
    marginTop: 18,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: 13,
    color: '#FFFFFF',
  },
};
