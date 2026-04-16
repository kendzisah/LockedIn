import type { CSSProperties } from 'react';

export interface DurationPickerState {
  title: string;
  subtitle: string;
  durations: number[];
  cancelLabel: string;
  highlightedIndex: number | null;
}

export const defaultDurationPicker: DurationPickerState = {
  title: 'Lock In',
  subtitle: 'How long do you want to lock in?',
  durations: [15, 30, 45, 60, 90, 120],
  cancelLabel: 'Cancel',
  highlightedIndex: null,
};

interface Props {
  state: DurationPickerState;
}

function formatDuration(mins: number): { value: string; label?: string } {
  if (mins >= 60 && mins % 60 === 0) return { value: `${mins / 60}h` };
  return { value: `${mins}`, label: 'min' };
}

export default function DurationPickerTemplate({ state }: Props) {
  return (
    <div style={styles.container}>
      {/* Background — blurred home screen hint */}
      <div style={styles.bgBase} />
      <div style={styles.bgImage} />
      <div style={styles.bgOverlayDark} />

      {/* Modal overlay */}
      <div style={styles.overlay}>
        {/* Modal card */}
        <div style={styles.card}>
          <div style={styles.title}>{state.title}</div>
          <div style={styles.subtitle}>{state.subtitle}</div>

          {/* Duration grid */}
          <div style={styles.grid}>
            {state.durations.map((mins, i) => {
              const { value, label } = formatDuration(mins);
              const isHighlighted = state.highlightedIndex === i;
              return (
                <div
                  key={i}
                  style={{
                    ...styles.option,
                    ...(isHighlighted ? styles.optionHighlighted : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.optionValue,
                      ...(isHighlighted ? styles.optionValueHighlighted : {}),
                    }}
                  >
                    {value}
                  </span>
                  {label && (
                    <span style={styles.optionLabel}>{label}</span>
                  )}
                </div>
              );
            })}
            {/* Custom option */}
            <div style={styles.option}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00C2FF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={styles.optionLabel}>Custom</span>
            </div>
          </div>

          {/* Cancel */}
          <div style={styles.cancel}>{state.cancelLabel}</div>
        </div>
      </div>
    </div>
  );
}

export function DurationPickerFields({
  state,
  onChange,
}: {
  state: DurationPickerState;
  onChange: (s: DurationPickerState) => void;
}) {
  return (
    <>
      <div className="field-group">
        <div className="field-group-title">Dialog Text</div>
        <div className="field">
          <label>Title</label>
          <input
            type="text"
            value={state.title}
            onChange={(e) => onChange({ ...state, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Subtitle</label>
          <input
            type="text"
            value={state.subtitle}
            onChange={(e) => onChange({ ...state, subtitle: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Cancel Label</label>
          <input
            type="text"
            value={state.cancelLabel}
            onChange={(e) => onChange({ ...state, cancelLabel: e.target.value })}
          />
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Duration Options</div>
        <div className="field">
          <label>Durations (comma-separated minutes)</label>
          <input
            type="text"
            value={state.durations.join(', ')}
            onChange={(e) => {
              const nums = e.target.value
                .split(',')
                .map((s) => parseInt(s.trim()))
                .filter((n) => !isNaN(n) && n > 0);
              if (nums.length > 0) {
                onChange({ ...state, durations: nums });
              }
            }}
          />
        </div>
        <div className="field">
          <label>Highlighted Option (index, or -1 for none)</label>
          <input
            type="number"
            value={state.highlightedIndex ?? -1}
            min={-1}
            max={state.durations.length - 1}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              onChange({
                ...state,
                highlightedIndex: v >= 0 ? v : null,
              });
            }}
          />
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'absolute',
    inset: 0,
    top: 54,
    overflow: 'hidden',
  },
  // Faint home screen background behind modal
  bgBase: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#0E1116',
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'url(/black_waves.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: 0.2,
    filter: 'blur(6px)',
  },
  bgOverlayDark: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '0 32px',
  },
  // Modal card — matches modalCard style
  card: {
    backgroundColor: '#151A21',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    border: '1px solid #2C3440',
  },
  title: {
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 700,
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 400,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    marginBottom: 20,
    lineHeight: '20px',
  },
  // Duration grid
  grid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  option: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#2C3440',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    transition: 'background-color 0.15s',
  },
  optionHighlighted: {
    backgroundColor: '#3A66FF',
    boxShadow: '0 0 16px rgba(58,102,255,0.3)',
  },
  optionValue: {
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 800,
    fontSize: 22,
    color: '#FFFFFF',
  },
  optionValueHighlighted: {
    color: '#FFFFFF',
  },
  optionLabel: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 400,
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  cancel: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 400,
    fontSize: 15,
    color: '#6B7280',
    paddingTop: 12,
    paddingBottom: 4,
    textAlign: 'center' as const,
  },
};
