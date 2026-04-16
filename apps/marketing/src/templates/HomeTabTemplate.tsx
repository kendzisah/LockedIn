import type { CSSProperties } from 'react';
import LottieIcon from '../components/LottieIcon';
import { IonFlash, IonCheckmark, IonClose } from '../components/Icons';

export interface HomeTabState {
  greeting: string;
  streak: number;
  streakTierColor: string;
  focusedMinutes: number;
  goalMinutes: number;
  streakBarTarget: string;
  streakBarProgress: number;
  weekDays: ('done' | 'missed' | 'today' | 'future')[];
  missions: { title: string; xp: number; done: boolean }[];
  missionsComplete: number;
}

export const defaultHomeTab: HomeTabState = {
  greeting: 'Good evening',
  streak: 24,
  streakTierColor: '#FFD700',
  focusedMinutes: 47,
  goalMinutes: 60,
  streakBarTarget: '1 Month Streak',
  streakBarProgress: 0.72,
  weekDays: ['done', 'done', 'done', 'done', 'today', 'future', 'future'],
  missions: [
    { title: 'Complete a 30-min focus session', xp: 20, done: true },
    { title: 'Lock in before 9 AM', xp: 15, done: false },
    { title: 'Hit your daily focus goal', xp: 25, done: false },
  ],
  missionsComplete: 1,
};

interface Props { state: HomeTabState }

export default function HomeTabTemplate({ state }: Props) {
  const progress = Math.min(1, state.focusedMinutes / state.goalMinutes);

  return (
    <div style={styles.container}>
      <div style={styles.gradient} />
      <div style={styles.glowOrb} />

      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.greeting}>{state.greeting}</div>
            <div style={styles.title}>Lock In.</div>
          </div>
          <div style={{
            ...styles.streakPill,
            backgroundColor: `${state.streakTierColor}15`,
            borderColor: `${state.streakTierColor}30`,
          }}>
            <LottieIcon src="/lottie/fire.json" width={22} height={22} />
            <span style={{ ...styles.streakNum, color: state.streakTierColor }}>
              {state.streak}
            </span>
          </div>
        </div>

        {/* DayDots */}
        <div style={styles.dayDotsRow}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
            const s = state.weekDays[i] || 'future';
            return (
              <div key={i} style={styles.dayDotCol}>
                <span style={{
                  ...styles.dayDotLabel,
                  color: s === 'today' ? '#00C2FF' : '#6B7280',
                }}>{d}</span>
                <div style={{
                  ...styles.dayDot,
                  ...(s === 'done' ? styles.dayDotDone : {}),
                  ...(s === 'missed' ? styles.dayDotMissed : {}),
                  ...(s === 'today' ? styles.dayDotToday : {}),
                  ...(s === 'future' ? styles.dayDotFuture : {}),
                }}>
                  {s === 'done' && <IonCheckmark size={10} color="#fff" />}
                  {s === 'missed' && <IonClose size={10} color="#FF4757" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* FocusRing — smooth SVG circle bar */}
        <div style={styles.ringContainer}>
          <div style={styles.ringGlow} />
          <div style={styles.ringOuter}>
            <svg width={210} height={210} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
              {/* Track */}
              <circle cx={105} cy={105} r={97} fill="none" stroke="rgba(44,52,64,0.6)" strokeWidth={8} />
              {/* Progress fill */}
              <circle
                cx={105} cy={105} r={97} fill="none"
                stroke="#3A66FF" strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 97}`}
                strokeDashoffset={`${2 * Math.PI * 97 * (1 - progress)}`}
                style={{ filter: 'drop-shadow(0 0 4px rgba(58,102,255,0.6))' }}
              />
            </svg>
            <div style={styles.innerGlass}>
              <div style={styles.focusedNum}>{state.focusedMinutes}</div>
              <div style={styles.focusedUnit}>min</div>
              <div style={styles.focusedLabel}>focused today</div>
            </div>
          </div>
          <div style={styles.goalLine}>
            Daily goal: <span style={{ color: '#00C2FF' }}>{state.focusedMinutes}</span>
            <span style={{ color: '#6B7280' }}> / </span>
            <span style={{ color: '#00C2FF' }}>{state.goalMinutes}</span>
            <span style={{ color: '#6B7280' }}> min</span>
          </div>
        </div>

        {/* StreakBar */}
        <div style={styles.streakCard}>
          <div style={styles.streakLabelRow}>
            <div style={styles.streakDayBadge}>
              <LottieIcon src="/lottie/dark-fire.json" width={18} height={18} autoplay={state.streak > 0} loop={state.streak > 0} />
              <span style={{ ...styles.streakDayCount, color: state.streakTierColor }}>
                {state.streak}
              </span>
            </div>
            <span style={styles.streakTarget}>{state.streakBarTarget}</span>
          </div>
          <div style={styles.streakTrack}>
            <div style={{
              ...styles.streakFill,
              width: `${state.streakBarProgress * 100}%`,
              backgroundColor: state.streakTierColor,
            }} />
          </div>
        </div>

        {/* CompactMissions */}
        <div style={styles.missionsCard}>
          <div style={styles.missionsHeader}>
            <div style={styles.missionsLeft}>
              <IonFlash size={14} color="#00C2FF" />
              <span style={styles.missionsTitle}>Today's Missions</span>
            </div>
            <div style={styles.missionsPill}>
              <span style={styles.missionsPillText}>
                {state.missionsComplete}/{state.missions.length}
              </span>
            </div>
          </div>
          {state.missions.map((m, i) => (
            <div key={i} style={styles.missionRow}>
              <div style={{
                ...styles.missionCheck,
                ...(m.done ? styles.missionCheckDone : {}),
              }}>
                {m.done && <IonCheckmark size={9} color="#fff" />}
              </div>
              <span style={{
                ...styles.missionText,
                ...(m.done ? styles.missionTextDone : {}),
              }}>{m.title}</span>
              <span style={{
                ...styles.missionXp,
                ...(m.done ? { opacity: 0.4 } : {}),
              }}>+{m.xp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeTabFields({
  state, onChange,
}: { state: HomeTabState; onChange: (s: HomeTabState) => void }) {
  const tierPresets = [
    { label: 'Default (gray)', color: '#4B5563' },
    { label: '3 Day (orange)', color: '#FF6B35' },
    { label: '7 Day (gold)', color: '#FFD700' },
    { label: '1 Month (green)', color: '#00D68F' },
    { label: '3 Month (cyan)', color: '#00C2FF' },
    { label: '6 Month (purple)', color: '#8B5CF6' },
    { label: '1 Year (pink)', color: '#FF006E' },
  ];

  return (
    <>
      <div className="field-group">
        <div className="field-group-title">Header</div>
        <div className="field">
          <label>Greeting</label>
          <input type="text" value={state.greeting}
            onChange={(e) => onChange({ ...state, greeting: e.target.value })} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Streak</label>
            <input type="number" value={state.streak} min={0}
              onChange={(e) => onChange({ ...state, streak: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="field">
            <label>Streak Tier Color</label>
            <input type="color" value={state.streakTierColor}
              onChange={(e) => onChange({ ...state, streakTierColor: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Tier Presets</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tierPresets.map((t) => (
              <button key={t.color} onClick={() => onChange({ ...state, streakTierColor: t.color })}
                style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${state.streakTierColor === t.color ? t.color : '#1e2330'}`,
                  background: state.streakTierColor === t.color ? `${t.color}20` : 'rgba(255,255,255,0.02)',
                  color: state.streakTierColor === t.color ? t.color : '#6B7280',
                  fontFamily: "'Inter', sans-serif",
                }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Focus Ring</div>
        <div className="field-row">
          <div className="field">
            <label>Focused (min)</label>
            <input type="number" value={state.focusedMinutes} min={0}
              onChange={(e) => onChange({ ...state, focusedMinutes: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="field">
            <label>Goal (min)</label>
            <input type="number" value={state.goalMinutes} min={1}
              onChange={(e) => onChange({ ...state, goalMinutes: parseInt(e.target.value) || 60 })} />
          </div>
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Streak Bar</div>
        <div className="field">
          <label>Target Label</label>
          <input type="text" value={state.streakBarTarget}
            onChange={(e) => onChange({ ...state, streakBarTarget: e.target.value })} />
        </div>
        <div className="field">
          <label>Progress (0-1)</label>
          <input type="range" min={0} max={1} step={0.01} value={state.streakBarProgress}
            onChange={(e) => onChange({ ...state, streakBarProgress: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: state.streakTierColor }} />
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Weekly Calendar</div>
        <div className="field">
          <label>Days (click to cycle)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['M','T','W','T','F','S','S'].map((d, i) => {
              const s = state.weekDays[i];
              const colors: Record<string, string> = { done: '#3A66FF', missed: '#FF4757', today: '#00C2FF', future: '#2C3440' };
              return (
                <button key={i} onClick={() => {
                  const order: typeof state.weekDays[0][] = ['done', 'missed', 'today', 'future'];
                  const next = order[(order.indexOf(s) + 1) % order.length];
                  const newDays = [...state.weekDays];
                  newDays[i] = next;
                  onChange({ ...state, weekDays: newDays as any });
                }} style={{
                  width: 36, height: 36, borderRadius: 18, border: `2px solid ${colors[s]}`,
                  background: s === 'done' || s === 'missed' ? `${colors[s]}30` : 'transparent',
                  color: colors[s], fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Inter', sans-serif",
                }}>{d}</button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Missions</div>
        {state.missions.map((m, i) => (
          <div key={i} className="field" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={m.done} onChange={(e) => {
              const newM = [...state.missions];
              newM[i] = { ...m, done: e.target.checked };
              onChange({ ...state, missions: newM, missionsComplete: newM.filter(x => x.done).length });
            }} style={{ accentColor: '#00D68F' }} />
            <input type="text" value={m.title} style={{ flex: 1 }}
              onChange={(e) => {
                const newM = [...state.missions];
                newM[i] = { ...m, title: e.target.value };
                onChange({ ...state, missions: newM });
              }} />
            <input type="number" value={m.xp} min={0} style={{ width: 50 }}
              onChange={(e) => {
                const newM = [...state.missions];
                newM[i] = { ...m, xp: parseInt(e.target.value) || 0 };
                onChange({ ...state, missions: newM });
              }} />
          </div>
        ))}
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { position: 'absolute', inset: 0, top: 54, overflow: 'hidden' },
  gradient: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0E1116 0%, #111922 50%, #0E1116 100%)' },
  glowOrb: { position: 'absolute', top: -80, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(58,102,255,0.06)' },
  content: { position: 'relative', zIndex: 1, padding: '0 20px', height: '100%', display: 'flex', flexDirection: 'column' },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 20 },
  greeting: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 14, color: '#6B7280', marginBottom: 2 },
  title: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 28, color: '#FFFFFF', letterSpacing: -0.5 },
  streakPill: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, borderWidth: 1, borderStyle: 'solid' },
  streakNum: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 700, fontSize: 17 },

  dayDotsRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' },
  dayDotCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 32 },
  dayDotLabel: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 11, letterSpacing: 0.3 },
  dayDot: { width: 22, height: 22, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dayDotDone: { backgroundColor: 'rgba(58,102,255,0.25)', border: '1px solid rgba(58,102,255,0.4)' },
  dayDotMissed: { backgroundColor: 'rgba(255,71,87,0.15)', border: '1px solid rgba(255,71,87,0.25)' },
  dayDotToday: { border: '1.5px solid #00C2FF', backgroundColor: 'transparent' },
  dayDotFuture: { backgroundColor: 'rgba(44,52,64,0.3)', opacity: 0.4 },

  ringContainer: { alignItems: 'center', display: 'flex', flexDirection: 'column', marginTop: 4, marginBottom: 4, alignSelf: 'center' },
  ringGlow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(58,102,255,0.05)', top: -15 },
  ringOuter: { width: 210, height: 210, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  innerGlass: { width: 164, height: 164, borderRadius: 82, backgroundColor: 'rgba(21,26,33,0.7)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  focusedNum: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 40, color: '#FFFFFF', letterSpacing: -1.5 },
  focusedUnit: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 14, color: '#9CA3AF', marginTop: -2 },
  focusedLabel: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 11, color: '#6B7280', marginTop: 4 },
  goalLine: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: '#6B7280', marginTop: 14 },

  streakCard: { backgroundColor: 'rgba(21,26,33,0.5)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.04)', padding: 14, marginBottom: 12 },
  streakLabelRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  streakDayBadge: { display: 'flex', alignItems: 'center', gap: 4 },
  streakDayCount: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 14 },
  streakTarget: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: '#6B7280' },
  streakTrack: { height: 6, backgroundColor: 'rgba(44,52,64,0.5)', borderRadius: 3, overflow: 'hidden' },
  streakFill: { height: '100%', borderRadius: 3, transition: 'width 0.3s ease' },

  missionsCard: { backgroundColor: 'rgba(21,26,33,0.5)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.04)', padding: 14 },
  missionsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  missionsLeft: { display: 'flex', alignItems: 'center', gap: 6 },
  missionsTitle: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 14, color: '#FFFFFF' },
  missionsPill: { padding: '4px 10px', backgroundColor: 'rgba(44,52,64,0.4)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' },
  missionsPillText: { fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 11, color: '#00C2FF' },
  missionRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' },
  missionCheck: { width: 18, height: 18, borderRadius: 9, border: '1.5px solid #2C3440', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  missionCheckDone: { backgroundColor: '#00D68F', borderColor: '#00D68F' },
  missionText: { flex: 1, fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: '#9CA3AF' },
  missionTextDone: { textDecoration: 'line-through', opacity: 0.5 },
  missionXp: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 12, color: '#FFC857' },
};
