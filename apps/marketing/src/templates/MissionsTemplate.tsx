import type { CSSProperties } from 'react';
import { IonShield, IonFlash, IonCalendarOutline, IonCheckmark, IonTimerOutline, IonShieldCheckmarkOutline, IonHeartOutline, IonBarbellOutline, IonFlameIcon, IonCheckmarkCircle, IonFitnessOutline } from '../components/Icons';

export type RankName = 'Recruit' | 'Soldier' | 'Vet' | 'OG' | 'Elite' | 'Legend' | 'Goat' | 'Immortal' | 'Locked In';

/** LEVEL_COLORS — 1:1 match with MissionsTab.tsx in the mobile app. */
export const RANK_COLORS: Record<RankName, string> = {
  Recruit: '#6B7280', Soldier: '#9CA3AF', Vet: '#CD7F32', OG: '#C0C0C0',
  Elite: '#B0A0FF', Legend: '#FFD700', Goat: '#00D68F', Immortal: '#B9F2FF', 'Locked In': '#00C2FF',
};

export const RANK_XP: Record<RankName, number> = {
  Recruit: 0, Soldier: 200, Vet: 450, OG: 700, Elite: 1000,
  Legend: 1350, Goat: 1750, Immortal: 2200, 'Locked In': 2800,
};

const RANK_ORDER: RankName[] = ['Recruit', 'Soldier', 'Vet', 'OG', 'Elite', 'Legend', 'Goat', 'Immortal', 'Locked In'];

type MissionSlot = 'core' | 'goal' | 'weakness';
type MissionIconType = 'timer' | 'shield' | 'heart';

const SLOT_META: Record<MissionSlot, { label: string; color: string }> = {
  core: { label: 'CORE', color: '#3A66FF' },
  goal: { label: 'GOAL', color: '#00C2FF' },
  weakness: { label: 'GROWTH', color: '#B0A0FF' },
};

export interface MissionItem {
  title: string;
  description: string;
  xp: number;
  done: boolean;
  slot: MissionSlot;
  iconType: MissionIconType;
  autoComplete?: boolean;
}

export interface WeeklyMissionItem {
  title: string;
  description: string;
  xp: number;
  done: boolean;
  progress: number;
  progressTarget: number;
  progressLabel: string;
}

export interface GymCheckInState {
  show: boolean;
  isCheckedIn: boolean;
  streak: number;
  weeklyCount: number;
  weekCheckins: boolean[];
}

export interface MissionsState {
  totalXP: number;
  dailyXP: number;
  seasonLabel: string;
  missions: MissionItem[];
  weeklyMissions: WeeklyMissionItem[];
  gymCheckIn: GymCheckInState;
}

export const defaultMissions: MissionsState = {
  totalXP: 845,
  dailyXP: 45,
  seasonLabel: 'Season 1',
  missions: [
    { title: 'First Thing Focus', description: 'Start a focus session within 30 min...', xp: 15, done: false, slot: 'core', iconType: 'timer', autoComplete: true },
    { title: 'Accept One Discomfort', description: 'Do something uncomfortable with...', xp: 20, done: false, slot: 'goal', iconType: 'shield' },
    { title: 'Routine Tracker', description: 'Complete your entire morning rout...', xp: 20, done: false, slot: 'weakness', iconType: 'heart' },
  ],
  weeklyMissions: [
    { title: 'Daily Check-In', description: 'Open the app before 9 AM on 5+ days this week', xp: 20, done: false, progress: 1, progressTarget: 5, progressLabel: '1/5 before 9am' },
  ],
  gymCheckIn: {
    show: true,
    isCheckedIn: false,
    streak: 3,
    weeklyCount: 3,
    weekCheckins: [true, true, false, true, false, false, false],
  },
};

function getRankInfo(xp: number) {
  let rank: RankName = 'Recruit';
  let nextRank: RankName | null = 'Soldier';
  for (let i = RANK_ORDER.length - 1; i >= 0; i--) {
    if (xp >= RANK_XP[RANK_ORDER[i]]) {
      rank = RANK_ORDER[i];
      nextRank = RANK_ORDER[i + 1] || null;
      break;
    }
  }
  const isMax = !nextRank;
  const nextThreshold = nextRank ? RANK_XP[nextRank] : RANK_XP[rank];
  const progress = nextRank
    ? Math.min(1, (xp - RANK_XP[rank]) / (nextThreshold - RANK_XP[rank]))
    : 1;
  return { rank, nextRank, nextThreshold, progress, isMax, color: RANK_COLORS[rank] };
}

function MissionIcon({ type, color }: { type: MissionIconType; color: string }) {
  switch (type) {
    case 'timer': return <IonTimerOutline size={18} color={color} />;
    case 'shield': return <IonShieldCheckmarkOutline size={18} color={color} />;
    case 'heart': return <IonHeartOutline size={18} color={color} />;
  }
}

const ICON_COLORS: Record<MissionIconType, string> = {
  timer: '#3A66FF',
  shield: '#B0A0FF',
  heart: '#FF6B81',
};

interface Props { state: MissionsState }

export default function MissionsTemplate({ state }: Props) {
  const info = getRankInfo(state.totalXP);
  const completedCount = state.missions.filter(m => m.done).length;

  return (
    <div style={styles.container}>
      <div style={styles.gradient} />
      <div style={styles.glowOrb} />
      <div style={styles.glowOrb2} />

      <div style={styles.content}>
        <div style={styles.heading}>Missions</div>
        <div style={styles.subheading}>
          {state.seasonLabel} · Complete missions to earn XP and rank up
        </div>

        {/* XP Card */}
        <div style={styles.xpCard}>
          <div style={{ ...styles.xpCardGlow, backgroundColor: `${info.color}08` }} />
          <div style={styles.xpHeader}>
            <div style={{ ...styles.levelBadge, backgroundColor: `${info.color}15` }}>
              <IonShield size={14} color={info.color} />
              <span style={{ ...styles.levelName, color: info.color }}>{info.rank}</span>
            </div>
            <div style={styles.xpCount}>
              <span style={styles.xpCountBold}>{state.totalXP}</span>
              {info.isMax ? ' XP · max rank' : ` / ${info.nextThreshold} XP`}
            </div>
          </div>
          <div style={styles.xpTrack}>
            <div style={{
              ...styles.xpFill,
              width: `${Math.max(info.progress * 100, 2)}%`,
              background: `linear-gradient(90deg, ${info.color}, #00C2FF)`,
            }} />
          </div>
          {state.dailyXP > 0 && (
            <div style={styles.dailyXPNote}>+{state.dailyXP} XP earned today</div>
          )}
        </div>

        {/* Daily Missions Header */}
        <div style={styles.sectionHeader}>
          <div style={styles.sectionLeft}>
            <IonFlash size={16} color="#00C2FF" />
            <span style={styles.sectionTitle}>Today's Missions</span>
          </div>
          <div style={{
            ...styles.completePill,
            ...(completedCount === state.missions.length ? styles.completePillDone : {}),
          }}>
            <span style={{
              ...styles.completePillText,
              ...(completedCount === state.missions.length ? { color: '#00D68F' } : {}),
            }}>{completedCount}/{state.missions.length} Complete</span>
          </div>
        </div>

        {/* Rich Mission Cards */}
        <div style={styles.missionList}>
          {state.missions.map((m, i) => {
            const iconColor = ICON_COLORS[m.iconType];
            const slotMeta = SLOT_META[m.slot];
            return (
              <div key={i} style={{ ...styles.mCard, ...(m.done ? styles.mCardDone : {}) }}>
                {/* Icon box */}
                <div style={{
                  ...styles.mIconBox,
                  backgroundColor: m.done ? 'rgba(0,214,143,0.1)' : `${iconColor}12`,
                  borderColor: m.done ? 'rgba(0,214,143,0.15)' : 'rgba(255,255,255,0.04)',
                }}>
                  {m.done
                    ? <IonCheckmark size={20} color="#00D68F" />
                    : <MissionIcon type={m.iconType} color={iconColor} />}
                </div>
                {/* Content */}
                <div style={styles.mContent}>
                  <div style={styles.mTitleRow}>
                    <span style={{ ...styles.mTitle, ...(m.done ? styles.mTitleDone : {}) }}>{m.title}</span>
                    <div style={{ ...styles.mSlotBadge, backgroundColor: `${slotMeta.color}15` }}>
                      <span style={{ ...styles.mSlotText, color: slotMeta.color }}>{slotMeta.label}</span>
                    </div>
                  </div>
                  <span style={{ ...styles.mDesc, ...(m.done ? { color: '#6B7280' } : {}) }}>{m.description}</span>
                  {!m.done && m.autoComplete && (
                    <div style={styles.mAutoRow}>
                      <IonFlash size={10} color="#00C2FF" />
                      <span style={styles.mAutoText}>Auto-complete</span>
                    </div>
                  )}
                </div>
                {/* XP Badge */}
                <div style={{ ...styles.mXpBadge, ...(m.done ? styles.mXpBadgeDone : {}) }}>
                  <span style={{ ...styles.mXpValue, ...(m.done ? { color: '#6B7280' } : {}) }}>+{m.xp}</span>
                  <span style={{ ...styles.mXpLabel, ...(m.done ? { color: '#6B7280' } : {}) }}>XP</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly Challenges */}
        {state.weeklyMissions.length > 0 && (
          <>
            <div style={styles.weeklyHeader}>
              <IonCalendarOutline size={16} color="#00C2FF" />
              <span style={styles.sectionTitle}>Weekly Challenges</span>
            </div>
            <div style={styles.missionList}>
              {state.weeklyMissions.map((m, i) => {
                const pct = m.progressTarget > 0 ? Math.min(100, (m.progress / m.progressTarget) * 100) : 0;
                return (
                  <div key={i} style={{ ...styles.mCard, ...(m.done ? styles.mCardDone : {}) }}>
                    <div style={{
                      ...styles.mIconBox,
                      backgroundColor: m.done ? 'rgba(0,214,143,0.1)' : 'rgba(0,194,255,0.08)',
                      borderColor: m.done ? 'rgba(0,214,143,0.15)' : 'rgba(255,255,255,0.04)',
                    }}>
                      {m.done
                        ? <IonCheckmark size={20} color="#00D68F" />
                        : <IonTimerOutline size={18} color="#00C2FF" />}
                    </div>
                    <div style={styles.mContent}>
                      <div style={styles.mTitleRow}>
                        <span style={{ ...styles.mTitle, ...(m.done ? styles.mTitleDone : {}) }}>{m.title}</span>
                        <div style={{ ...styles.mSlotBadge, backgroundColor: 'rgba(0,194,255,0.12)' }}>
                          <span style={{ ...styles.mSlotText, color: '#00C2FF' }}>WEEKLY</span>
                        </div>
                      </div>
                      <span style={{ ...styles.mDesc, ...(m.done ? { color: '#6B7280' } : {}) }}>{m.description}</span>
                      {!m.done && (
                        <div style={styles.mProgressRow}>
                          <div style={styles.mProgressTrack}>
                            <div style={{ ...styles.mProgressFill, width: `${pct}%` }} />
                          </div>
                          <span style={styles.mProgressText}>{m.progressLabel}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ ...styles.mXpBadge, ...(m.done ? styles.mXpBadgeDone : {}) }}>
                      <span style={{ ...styles.mXpValue, ...(m.done ? { color: '#6B7280' } : {}) }}>+{m.xp}</span>
                      <span style={{ ...styles.mXpLabel, ...(m.done ? { color: '#6B7280' } : {}) }}>XP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Gym Check-In Card */}
        {state.gymCheckIn.show && (
          <div style={styles.gymCard}>
            {/* Header */}
            <div style={styles.gymHeader}>
              <div style={styles.gymHeaderLeft}>
                <div style={styles.gymIconBox}>
                  <IonBarbellOutline size={18} color="#00D68F" />
                </div>
                <div>
                  <div style={styles.gymTitle}>Gym Check-In</div>
                  <div style={styles.gymSubtitle}>Did you train today?</div>
                </div>
              </div>
              {state.gymCheckIn.streak > 0 && (
                <div style={styles.gymStreakBadge}>
                  <IonFlameIcon size={12} color="#00D68F" />
                  <span style={styles.gymStreakText}>{state.gymCheckIn.streak}d</span>
                </div>
              )}
            </div>

            {/* Check-in button */}
            <div style={{
              ...styles.gymCheckInBtn,
              ...(state.gymCheckIn.isCheckedIn ? styles.gymCheckInBtnDone : {}),
            }}>
              {state.gymCheckIn.isCheckedIn
                ? <IonCheckmarkCircle size={18} color="#FFFFFF" />
                : <IonFitnessOutline size={18} color="#00D68F" />}
              <span style={{
                ...styles.gymCheckInText,
                ...(state.gymCheckIn.isCheckedIn ? { color: '#FFFFFF' } : {}),
              }}>
                {state.gymCheckIn.isCheckedIn ? 'Checked In!' : 'I Trained Today'}
              </span>
            </div>

            {/* Weekly dots */}
            <div style={styles.gymWeekRow}>
              {state.gymCheckIn.weekCheckins.map((checked, i) => (
                <div key={i} style={styles.gymDayCol}>
                  <div style={{
                    ...styles.gymDot,
                    ...(checked ? styles.gymDotChecked : {}),
                  }}>
                    {checked && <IonCheckmark size={10} color="#FFFFFF" />}
                  </div>
                  <span style={{
                    ...styles.gymDayLabel,
                    ...(checked ? { color: '#00D68F' } : {}),
                  }}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </span>
                </div>
              ))}
            </div>

            {/* Weekly counter */}
            <div style={styles.gymCounterRow}>
              <span style={styles.gymCounterValue}>{state.gymCheckIn.weeklyCount}</span>
              <span style={styles.gymCounterLabel}>/7 this week</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MissionsFields({
  state, onChange,
}: { state: MissionsState; onChange: (s: MissionsState) => void }) {
  const info = getRankInfo(state.totalXP);

  return (
    <>
      <div className="field-group">
        <div className="field-group-title">XP & Rank</div>
        <div className="field">
          <label>Total XP — Current Rank: <strong style={{ color: info.color }}>{info.rank}</strong></label>
          <input type="number" value={state.totalXP} min={0}
            onChange={(e) => onChange({ ...state, totalXP: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="field">
          <label>Rank Thresholds</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {RANK_ORDER.map((r) => (
              <button key={r} onClick={() => onChange({ ...state, totalXP: RANK_XP[r] })}
                style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                  border: `1px solid ${info.rank === r ? RANK_COLORS[r] : '#1e2330'}`,
                  background: info.rank === r ? `${RANK_COLORS[r]}20` : 'rgba(255,255,255,0.02)',
                  color: RANK_COLORS[r], fontFamily: "'Inter', sans-serif", fontWeight: 600,
                }}>{r} ({RANK_XP[r]})</button>
            ))}
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Daily XP</label>
            <input type="number" value={state.dailyXP} min={0}
              onChange={(e) => onChange({ ...state, dailyXP: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="field">
            <label>Season Label</label>
            <input type="text" value={state.seasonLabel}
              onChange={(e) => onChange({ ...state, seasonLabel: e.target.value })} />
          </div>
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Daily Missions</div>
        {state.missions.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div className="field" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={m.done} onChange={(e) => {
                const newM = [...state.missions]; newM[i] = { ...m, done: e.target.checked };
                onChange({ ...state, missions: newM });
              }} style={{ accentColor: '#00D68F' }} />
              <input type="text" value={m.title} style={{ flex: 1 }}
                onChange={(e) => { const newM = [...state.missions]; newM[i] = { ...m, title: e.target.value }; onChange({ ...state, missions: newM }); }} />
              <input type="number" value={m.xp} min={0} style={{ width: 50 }}
                onChange={(e) => { const newM = [...state.missions]; newM[i] = { ...m, xp: parseInt(e.target.value) || 0 }; onChange({ ...state, missions: newM }); }} />
            </div>
            <div className="field" style={{ paddingLeft: 24 }}>
              <input type="text" value={m.description} placeholder="Description"
                onChange={(e) => { const newM = [...state.missions]; newM[i] = { ...m, description: e.target.value }; onChange({ ...state, missions: newM }); }} />
            </div>
          </div>
        ))}
      </div>
      <div className="field-group">
        <div className="field-group-title">Weekly Challenges</div>
        {state.weeklyMissions.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div className="field" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={m.done} onChange={(e) => {
                const newM = [...state.weeklyMissions]; newM[i] = { ...m, done: e.target.checked };
                onChange({ ...state, weeklyMissions: newM });
              }} style={{ accentColor: '#00D68F' }} />
              <input type="text" value={m.title} style={{ flex: 1 }}
                onChange={(e) => { const newM = [...state.weeklyMissions]; newM[i] = { ...m, title: e.target.value }; onChange({ ...state, weeklyMissions: newM }); }} />
              <input type="number" value={m.xp} min={0} style={{ width: 50 }}
                onChange={(e) => { const newM = [...state.weeklyMissions]; newM[i] = { ...m, xp: parseInt(e.target.value) || 0 }; onChange({ ...state, weeklyMissions: newM }); }} />
            </div>
            <div className="field" style={{ paddingLeft: 24 }}>
              <input type="text" value={m.description} placeholder="Description"
                onChange={(e) => { const newM = [...state.weeklyMissions]; newM[i] = { ...m, description: e.target.value }; onChange({ ...state, weeklyMissions: newM }); }} />
            </div>
          </div>
        ))}
      </div>
      <div className="field-group">
        <div className="field-group-title">Gym Check-In</div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={state.gymCheckIn.show}
              onChange={(e) => onChange({ ...state, gymCheckIn: { ...state.gymCheckIn, show: e.target.checked } })}
              style={{ accentColor: '#00D68F' }} /> Show Gym Check-In
          </label>
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={state.gymCheckIn.isCheckedIn}
              onChange={(e) => onChange({ ...state, gymCheckIn: { ...state.gymCheckIn, isCheckedIn: e.target.checked } })}
              style={{ accentColor: '#00D68F' }} /> Checked In Today
          </label>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Streak (days)</label>
            <input type="number" value={state.gymCheckIn.streak} min={0}
              onChange={(e) => onChange({ ...state, gymCheckIn: { ...state.gymCheckIn, streak: parseInt(e.target.value) || 0 } })} />
          </div>
          <div className="field">
            <label>Weekly Count</label>
            <input type="number" value={state.gymCheckIn.weeklyCount} min={0} max={7}
              onChange={(e) => onChange({ ...state, gymCheckIn: { ...state.gymCheckIn, weeklyCount: parseInt(e.target.value) || 0 } })} />
          </div>
        </div>
        <div className="field">
          <label>Week Days (click to toggle)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <button key={i} onClick={() => {
                const wc = [...state.gymCheckIn.weekCheckins];
                wc[i] = !wc[i];
                const count = wc.filter(Boolean).length;
                onChange({ ...state, gymCheckIn: { ...state.gymCheckIn, weekCheckins: wc, weeklyCount: count } });
              }} style={{
                width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 600, cursor: 'pointer',
                backgroundColor: state.gymCheckIn.weekCheckins[i] ? '#00D68F' : 'rgba(44,52,64,0.5)',
                color: state.gymCheckIn.weekCheckins[i] ? '#fff' : '#6B7280',
                border: `1px solid ${state.gymCheckIn.weekCheckins[i] ? '#00D68F' : '#1e2330'}`,
              }}>{day}</button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { position: 'absolute', inset: 0, top: 54, overflow: 'hidden' },
  gradient: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0E1116 0%, #111922 40%, #0E1116 100%)' },
  glowOrb: { position: 'absolute', top: 30, left: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(58,102,255,0.04)' },
  glowOrb2: { position: 'absolute', top: 300, right: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(0,194,255,0.03)' },
  content: { position: 'relative', zIndex: 1, padding: '0 20px', overflowY: 'auto', height: '100%', paddingBottom: 40 },

  heading: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 28, color: '#FFFFFF', letterSpacing: -0.5, marginTop: 8 },
  subheading: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 24 },

  xpCard: { backgroundColor: 'rgba(21,26,33,0.65)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 18, marginBottom: 28, overflow: 'hidden', position: 'relative' },
  xpCardGlow: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60 },
  xpHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  levelBadge: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8 },
  levelName: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 14 },
  xpCount: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: '#6B7280' },
  xpCountBold: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, color: '#9CA3AF' },
  xpTrack: { height: 8, backgroundColor: 'rgba(44,52,64,0.5)', borderRadius: 4, overflow: 'hidden', position: 'relative' },
  xpFill: { height: '100%', borderRadius: 4 },
  dailyXPNote: { fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 11, color: '#00D68F', textAlign: 'right', marginTop: 8 },

  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionLeft: { display: 'flex', alignItems: 'center', gap: 6 },
  sectionTitle: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 16, color: '#FFFFFF' },
  completePill: { padding: '5px 10px', backgroundColor: 'rgba(44,52,64,0.4)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' },
  completePillDone: { backgroundColor: 'rgba(0,214,143,0.1)', borderColor: 'rgba(0,214,143,0.15)' },
  completePillText: { fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 11, color: '#00C2FF' },

  missionList: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  weeklyHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 8 },

  /* Rich MissionCard — 1:1 with MissionCard.tsx */
  mCard: {
    display: 'flex', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: 'rgba(21,26,33,0.6)', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.05)',
  },
  mCardDone: {
    backgroundColor: 'rgba(21,26,33,0.35)', borderColor: 'rgba(0,214,143,0.08)',
  },
  mIconBox: {
    width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center',
    justifyContent: 'center', border: '1px solid', flexShrink: 0,
  },
  mContent: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  mTitleRow: { display: 'flex', alignItems: 'center', gap: 6 },
  mTitle: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 14, color: '#FFFFFF' },
  mTitleDone: { color: '#6B7280', textDecoration: 'line-through' },
  mSlotBadge: { padding: '2px 5px', borderRadius: 4 },
  mSlotText: { fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 8, letterSpacing: 0.8 },
  mDesc: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: '#9CA3AF' },
  mAutoRow: { display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 },
  mAutoText: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 10, color: '#00C2FF' },
  mXpBadge: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0,
    padding: '6px 10px', borderRadius: 8,
    backgroundColor: 'rgba(255,200,87,0.08)', border: '1px solid rgba(255,200,87,0.12)',
  },
  mXpBadgeDone: { backgroundColor: 'rgba(44,52,64,0.2)', borderColor: 'rgba(255,255,255,0.03)' },
  mXpValue: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 13, color: '#FFC857' },
  mXpLabel: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 9, color: '#FFC857', marginTop: 1, letterSpacing: 0.5 },

  /* Weekly progress bar */
  mProgressRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 },
  mProgressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(44,52,64,0.5)', overflow: 'hidden' },
  mProgressFill: { height: '100%', borderRadius: 2, backgroundColor: '#00C2FF' },
  mProgressText: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 10, color: '#6B7280' },

  /* Gym Check-In Card — 1:1 with GymCheckInCard.tsx */
  gymCard: {
    backgroundColor: 'rgba(21,26,33,0.6)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.05)', padding: 18, marginTop: 16,
  },
  gymHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  gymHeaderLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  gymIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,214,143,0.1)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    border: '1px solid rgba(0,214,143,0.12)',
  },
  gymTitle: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 15, color: '#FFFFFF' },
  gymSubtitle: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: '#6B7280', marginTop: 1 },
  gymStreakBadge: {
    display: 'flex', alignItems: 'center', gap: 3,
    padding: '4px 8px', backgroundColor: 'rgba(0,214,143,0.1)',
    borderRadius: 8, border: '1px solid rgba(0,214,143,0.12)',
  },
  gymStreakText: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 12, color: '#00D68F' },
  gymCheckInBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 0', borderRadius: 12,
    backgroundColor: 'rgba(0,214,143,0.08)', border: '1px solid rgba(0,214,143,0.15)',
    marginBottom: 18,
  },
  gymCheckInBtnDone: { backgroundColor: '#00D68F', borderColor: '#00D68F' },
  gymCheckInText: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 14, color: '#00D68F' },
  gymWeekRow: { display: 'flex', justifyContent: 'space-between', paddingLeft: 4, paddingRight: 4, marginBottom: 14 },
  gymDayCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 },
  gymDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(44,52,64,0.5)', border: '1px solid rgba(255,255,255,0.04)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  gymDotChecked: { backgroundColor: '#00D68F', borderColor: '#00D68F' },
  gymDayLabel: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 10, color: '#6B7280' },
  gymCounterRow: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2,
    paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)',
  },
  gymCounterValue: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 18, color: '#FFFFFF' },
  gymCounterLabel: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: '#6B7280' },
};
