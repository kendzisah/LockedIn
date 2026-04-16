import type { CSSProperties } from 'react';
import { IonPeopleOutline, IonChevronForward, IonAdd, IonEnterOutline } from '../components/Icons';

export interface SquadItem {
  name: string;
  memberCount: number;
  maxMembers: number;
  myRank: number | null;
  myScore: number;
  topScore: number;
}

export interface SquadsState {
  squads: SquadItem[];
  showJoinButton: boolean;
}

export const defaultSquads: SquadsState = {
  squads: [
    { name: 'D Block', memberCount: 1, maxMembers: 10, myRank: 1, myScore: 75, topScore: 75 },
  ],
  showJoinButton: true,
};

interface Props { state: SquadsState }

function SquadCard({ squad }: { squad: SquadItem }) {
  const fillPct = squad.topScore > 0
    ? Math.min(100, Math.max(0, (squad.myScore / squad.topScore) * 100))
    : 0;
  const isFirst = squad.myRank === 1;

  return (
    <div style={styles.card}>
      <div style={styles.cardGlow} />
      <div style={styles.topRow}>
        <div style={styles.nameCol}>
          <span style={styles.crewName}>{squad.name}</span>
          <div style={styles.memberBadge}>
            <IonPeopleOutline size={12} color="#6B7280" />
            <span style={styles.memberCount}>{squad.memberCount}/{squad.maxMembers}</span>
          </div>
        </div>
        <IonChevronForward size={18} color="#6B7280" />
      </div>
      <div style={styles.statsRow}>
        <div style={styles.statBlock}>
          <span style={{ ...styles.statValue, ...(isFirst ? { color: '#FFD700' } : {}) }}>
            {squad.myRank != null ? `#${squad.myRank}` : '\u2014'}
          </span>
          <span style={styles.statLabel}>Rank</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statBlock}>
          <span style={styles.statValue}>{squad.myScore}</span>
          <span style={styles.statLabel}>Score</span>
        </div>
      </div>
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${fillPct}%` }} />
      </div>
    </div>
  );
}

export default function SquadsTemplate({ state }: Props) {
  return (
    <div style={styles.container}>
      <div style={styles.gradient} />
      <div style={styles.glowOrb} />
      <div style={styles.glowOrb2} />

      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Squads</div>
            <div style={styles.titleAccent}>
              <div style={styles.titleAccentFill} />
            </div>
          </div>
          <div style={styles.addBtn}>
            <IonAdd size={22} color="#3A66FF" />
          </div>
        </div>

        {/* Squad Cards */}
        <div style={styles.cardList}>
          {state.squads.map((squad, i) => (
            <SquadCard key={i} squad={squad} />
          ))}
        </div>
      </div>

      {/* Join button — absolute bottom */}
      {state.showJoinButton && (
        <div style={styles.bottomAction}>
          <div style={styles.joinBtn}>
            <IonEnterOutline size={18} color="#00C2FF" />
            <span style={styles.joinBtnText}>Join a Squad</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SquadsFields({
  state, onChange,
}: { state: SquadsState; onChange: (s: SquadsState) => void }) {
  return (
    <>
      <div className="field-group">
        <div className="field-group-title">Options</div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={state.showJoinButton}
              onChange={(e) => onChange({ ...state, showJoinButton: e.target.checked })}
              style={{ accentColor: '#00C2FF' }} /> Show Join Button
          </label>
        </div>
      </div>
      {state.squads.map((sq, i) => (
        <div key={i} className="field-group">
          <div className="field-group-title">Squad {i + 1}</div>
          <div className="field">
            <label>Name</label>
            <input type="text" value={sq.name}
              onChange={(e) => { const s = [...state.squads]; s[i] = { ...sq, name: e.target.value }; onChange({ ...state, squads: s }); }} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Members</label>
              <input type="number" value={sq.memberCount} min={1}
                onChange={(e) => { const s = [...state.squads]; s[i] = { ...sq, memberCount: parseInt(e.target.value) || 1 }; onChange({ ...state, squads: s }); }} />
            </div>
            <div className="field">
              <label>Max</label>
              <input type="number" value={sq.maxMembers} min={1}
                onChange={(e) => { const s = [...state.squads]; s[i] = { ...sq, maxMembers: parseInt(e.target.value) || 10 }; onChange({ ...state, squads: s }); }} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>My Rank</label>
              <input type="number" value={sq.myRank ?? 0} min={0}
                onChange={(e) => { const v = parseInt(e.target.value) || 0; const s = [...state.squads]; s[i] = { ...sq, myRank: v > 0 ? v : null }; onChange({ ...state, squads: s }); }} />
            </div>
            <div className="field">
              <label>My Score</label>
              <input type="number" value={sq.myScore} min={0}
                onChange={(e) => { const s = [...state.squads]; s[i] = { ...sq, myScore: parseInt(e.target.value) || 0 }; onChange({ ...state, squads: s }); }} />
            </div>
          </div>
          <div className="field">
            <label>Top Score (for progress bar)</label>
            <input type="number" value={sq.topScore} min={0}
              onChange={(e) => { const s = [...state.squads]; s[i] = { ...sq, topScore: parseInt(e.target.value) || 0 }; onChange({ ...state, squads: s }); }} />
          </div>
        </div>
      ))}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { position: 'absolute', inset: 0, top: 54, overflow: 'hidden' },
  gradient: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0E1116 0%, #111922 50%, #0E1116 100%)' },
  glowOrb: { position: 'absolute', top: -40, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(58,102,255,0.06)' },
  glowOrb2: { position: 'absolute', top: 300, left: -100, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(0,194,255,0.04)' },
  content: { position: 'relative', zIndex: 1, padding: '0 24px', overflowY: 'auto', height: '100%' },

  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 20 },
  title: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 28, color: '#FFFFFF', letterSpacing: -0.3 },
  titleAccent: { marginTop: 8, height: 3, width: 40, borderRadius: 2, overflow: 'hidden' },
  titleAccentFill: { height: '100%', background: 'linear-gradient(90deg, #3A66FF, #00C2FF)' },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(58,102,255,0.1)', border: '1px solid rgba(58,102,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  cardList: { display: 'flex', flexDirection: 'column', gap: 12 },

  /* CrewCard — 1:1 */
  card: {
    backgroundColor: 'rgba(21,26,33,0.5)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.04)', padding: 16,
    overflow: 'hidden', position: 'relative',
  },
  cardGlow: {
    position: 'absolute', top: -30, right: -20, width: 100, height: 100,
    borderRadius: 50, backgroundColor: 'rgba(58,102,255,0.05)',
  },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nameCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  crewName: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 17, color: '#FFFFFF', letterSpacing: -0.2 },
  memberBadge: { display: 'flex', alignItems: 'center', gap: 4 },
  memberCount: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: '#6B7280' },

  statsRow: { display: 'flex', alignItems: 'center', marginTop: 14, marginBottom: 14, gap: 16 },
  statBlock: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statValue: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 20, color: '#FFFFFF', letterSpacing: -0.3 },
  statLabel: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: '#6B7280', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.06)' },

  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(44,52,64,0.5)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: '#3A66FF' },

  bottomAction: {
    position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 2,
  },
  joinBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(21,26,33,0.72)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, padding: '14px 0',
  },
  joinBtnText: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 15, color: '#00C2FF' },
};
