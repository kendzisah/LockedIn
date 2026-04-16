import type { CSSProperties } from 'react';

export interface ExecutionBlockState {
  timerText: string;
  phaseText: string;
  holdHint: string;
  backgroundColor: string;
}

export const defaultExecutionBlock: ExecutionBlockState = {
  timerText: '42:17',
  phaseText: 'You are now Locked In.',
  holdHint: 'Hold to end session',
  backgroundColor: '#090C10',
};

interface Props {
  state: ExecutionBlockState;
}

export default function ExecutionBlockTemplate({ state }: Props) {
  return (
    <div style={{ ...styles.container, backgroundColor: state.backgroundColor }}>
      <div style={styles.centerContent}>
        <div style={styles.timer}>{state.timerText}</div>
        <div style={styles.phaseText}>{state.phaseText}</div>
      </div>

      <div style={styles.holdSection}>
        <div style={styles.holdButton}>
          <div style={styles.holdLockBody}>
            <div style={styles.holdLockShackle} />
          </div>
        </div>
        <div style={styles.holdHint}>{state.holdHint}</div>
      </div>
    </div>
  );
}

export function ExecutionBlockFields({
  state,
  onChange,
}: {
  state: ExecutionBlockState;
  onChange: (s: ExecutionBlockState) => void;
}) {
  const phasePresets = [
    'You are now Locked In.',
    'Stay Locked In.',
    'Execute.',
    'No distractions.',
    'Build the standard.',
  ];

  return (
    <>
      <div className="field-group">
        <div className="field-group-title">Timer</div>
        <div className="field">
          <label>Timer Display</label>
          <input type="text" value={state.timerText}
            onChange={(e) => onChange({ ...state, timerText: e.target.value })} />
        </div>
        <div className="field">
          <label>Phase Text</label>
          <input type="text" value={state.phaseText}
            onChange={(e) => onChange({ ...state, phaseText: e.target.value })} />
        </div>
        <div className="field">
          <label>Presets</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {phasePresets.map((text) => (
              <button key={text} onClick={() => onChange({ ...state, phaseText: text })}
                style={{
                  padding: '6px 10px', textAlign: 'left',
                  background: state.phaseText === text ? 'rgba(0,194,255,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${state.phaseText === text ? 'rgba(0,194,255,0.2)' : '#1e2330'}`,
                  borderRadius: 6, color: state.phaseText === text ? '#00C2FF' : '#9CA3AF',
                  fontSize: 12, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                }}>{text}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Controls</div>
        <div className="field">
          <label>Hold Hint Text</label>
          <input type="text" value={state.holdHint}
            onChange={(e) => onChange({ ...state, holdHint: e.target.value })} />
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Appearance</div>
        <div className="field-row">
          <div className="field">
            <label>Background</label>
            <input type="color" value={state.backgroundColor}
              onChange={(e) => onChange({ ...state, backgroundColor: e.target.value })} />
          </div>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { position: 'absolute', inset: 0, top: 54, display: 'flex', flexDirection: 'column' },
  centerContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingLeft: 32, paddingRight: 32 },
  timer: { fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 72, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', letterSpacing: -1, marginBottom: 24 },
  phaseText: { fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: '#9CA3AF', textAlign: 'center', lineHeight: '24px' },
  holdSection: { position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  holdButton: { width: 56, height: 56, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  holdLockBody: { width: 18, height: 14, borderRadius: 3, backgroundColor: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, position: 'relative' },
  holdLockShackle: { position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 12, height: 10, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderTop: '2px solid #6B7280', borderLeft: '2px solid #6B7280', borderRight: '2px solid #6B7280', background: 'transparent' },
  holdHint: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 11, color: '#6B7280', opacity: 0.4, letterSpacing: 0.3 },
};
