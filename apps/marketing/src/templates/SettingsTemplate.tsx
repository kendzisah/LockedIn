import type { CSSProperties } from 'react';
import { MaterialIcon } from '../components/Icons';

export interface SettingsState {
  displayName: string;
  email: string;
  isGuest: boolean;
  dailyCommitment: number;
  primaryGoal: string;
  focusAreas: number;
  blockedApps: number;
  pushEnabled: boolean;
  reminderTime: string;
  streakAlerts: boolean;
  squadNotifs: boolean;
  isPro: boolean;
  version: string;
}

export const defaultSettings: SettingsState = {
  displayName: 'Ken Dzisah',
  email: 'ken@lockedin.app',
  isGuest: false,
  dailyCommitment: 180,
  primaryGoal: 'Increase discipline & self-control',
  focusAreas: 3,
  blockedApps: 12,
  pushEnabled: true,
  reminderTime: '6:00 AM',
  streakAlerts: true,
  squadNotifs: true,
  isPro: true,
  version: '1.4.2',
};

interface Props { state: SettingsState }

/** 1:1 match with SettingsRow.tsx — icon column + label + value/toggle + chevron */
function SettingsRow({
  icon, iconColor = '#9CA3AF', label, value, valueColor = '#9CA3AF',
  showChevron = true, toggle, toggleValue,
}: {
  icon: string; iconColor?: string; label: string; value?: string;
  valueColor?: string; showChevron?: boolean; toggle?: boolean; toggleValue?: boolean;
}) {
  return (
    <div style={styles.row}>
      <div style={styles.iconCol}>
        <MaterialIcon name={icon} size={20} color={iconColor} />
      </div>
      <span style={styles.rowLabel}>{label}</span>
      {toggle ? (
        <div style={{ ...styles.toggle, ...(toggleValue ? styles.toggleOn : {}) }}>
          <div style={{ ...styles.toggleThumb, ...(toggleValue ? styles.toggleThumbOn : {}) }} />
        </div>
      ) : (
        <div style={styles.rowRight}>
          {value && <span style={{ ...styles.rowValue, color: valueColor }}>{value}</span>}
          {showChevron && <MaterialIcon name="chevron_right" size={18} color="#6B7280" />}
        </div>
      )}
    </div>
  );
}

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{label}</div>
      <div style={styles.card}>{children}</div>
    </div>
  );
}

function Separator() {
  return <div style={styles.separator} />;
}

export default function SettingsTemplate({ state }: Props) {
  const goalShort = state.primaryGoal.length > 22
    ? state.primaryGoal.slice(0, 21) + '\u2026'
    : state.primaryGoal;

  return (
    <div style={styles.container}>
      <div style={styles.gradient} />
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.headerTitle}>Settings</div>

        {/* Profile Card */}
        <div style={styles.profileCard}>
          <div style={styles.avatar}>
            <MaterialIcon
              name={state.isGuest ? 'person_outline' : 'person'}
              size={28}
              color="#6B7280"
            />
          </div>
          <div style={styles.profileInfo}>
            <div style={styles.profileName}>
              {state.isGuest ? 'Guest Account' : state.displayName}
            </div>
            <div style={styles.profileEmail}>
              {state.isGuest ? 'Sign up to save your progress' : state.email}
            </div>
          </div>
          <MaterialIcon
            name="chevron_right"
            size={20}
            color={state.isGuest ? '#00C2FF' : '#6B7280'}
          />
        </div>

        {/* Your Plan */}
        <SettingsSection label="Your plan">
          <SettingsRow icon="timer" label="Daily commitment" value={`${state.dailyCommitment} min`} />
          <Separator />
          <SettingsRow icon="flag" label="Primary goal" value={goalShort} />
          <Separator />
          <SettingsRow icon="psychology" label="Focus areas" value={`${state.focusAreas} selected`} />
          <Separator />
          <SettingsRow icon="block" label="Blocked apps" value={state.blockedApps > 0 ? `${state.blockedApps} app${state.blockedApps === 1 ? '' : 's'}` : 'None'} />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection label="Notifications">
          <SettingsRow icon="notifications" label="Push notifications" toggle toggleValue={state.pushEnabled} />
          <Separator />
          <SettingsRow icon="alarm" label="Daily reminder time" value={state.reminderTime} />
          <Separator />
          <SettingsRow icon="local_fire_department" label="Streak protection alerts" toggle toggleValue={state.streakAlerts} />
          <Separator />
          <SettingsRow icon="group" label="Squad notifications" toggle toggleValue={state.squadNotifs} />
        </SettingsSection>

        {/* Subscription */}
        <SettingsSection label="Subscription">
          {state.isPro ? (
            <>
              <SettingsRow icon="verified" iconColor="#00D68F" label="Locked In Pro" value="Active" valueColor="#00D68F" showChevron={false} />
              <Separator />
              <SettingsRow icon="credit_card" label="Manage subscription" />
              <Separator />
              <SettingsRow icon="refresh" label="Restore purchases" />
            </>
          ) : (
            <>
              <SettingsRow icon="star" iconColor="#FFC857" label="Upgrade to Pro" />
              <Separator />
              <SettingsRow icon="refresh" label="Restore purchases" />
            </>
          )}
        </SettingsSection>

        {/* Account */}
        <SettingsSection label="Account">
          {state.isGuest ? (
            <>
              <SettingsRow icon="person_add" iconColor="#00C2FF" label="Create account" />
              <Separator />
              <SettingsRow icon="login" label="Sign in to existing account" />
              <Separator />
              <SettingsRow icon="delete_outline" iconColor="#FF4757" label="Reset all data" />
            </>
          ) : (
            <>
              <SettingsRow icon="lock" label="Change password" />
              <Separator />
              <SettingsRow icon="logout" label="Sign out" showChevron={false} />
              <Separator />
              <SettingsRow icon="delete_outline" iconColor="#FF4757" label="Delete account" />
            </>
          )}
        </SettingsSection>

        {/* About */}
        <SettingsSection label="About">
          <SettingsRow icon="chat" label="Send feedback" />
          <Separator />
          <SettingsRow icon="star_rate" label="Rate Locked In" />
          <Separator />
          <SettingsRow icon="share" label="Share with a friend" />
          <Separator />
          <SettingsRow icon="privacy_tip" label="Privacy policy" />
          <Separator />
          <SettingsRow icon="description" label="Terms of service" />
          <Separator />
          <SettingsRow icon="info_outline" label="Version" value={state.version} showChevron={false} />
        </SettingsSection>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

export function SettingsFields({
  state, onChange,
}: { state: SettingsState; onChange: (s: SettingsState) => void }) {
  return (
    <>
      <div className="field-group">
        <div className="field-group-title">Profile</div>
        <div className="field">
          <label>Display Name</label>
          <input type="text" value={state.displayName}
            onChange={(e) => onChange({ ...state, displayName: e.target.value })} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="text" value={state.email}
            onChange={(e) => onChange({ ...state, email: e.target.value })} />
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={state.isGuest}
              onChange={(e) => onChange({ ...state, isGuest: e.target.checked })}
              style={{ accentColor: '#00C2FF' }} /> Guest Mode
          </label>
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Plan</div>
        <div className="field-row">
          <div className="field">
            <label>Daily Commitment (min)</label>
            <input type="number" value={state.dailyCommitment} min={1}
              onChange={(e) => onChange({ ...state, dailyCommitment: parseInt(e.target.value) || 60 })} />
          </div>
          <div className="field">
            <label>Focus Areas</label>
            <input type="number" value={state.focusAreas} min={0}
              onChange={(e) => onChange({ ...state, focusAreas: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="field">
          <label>Primary Goal</label>
          <input type="text" value={state.primaryGoal}
            onChange={(e) => onChange({ ...state, primaryGoal: e.target.value })} />
        </div>
        <div className="field">
          <label>Blocked Apps</label>
          <input type="number" value={state.blockedApps} min={0}
            onChange={(e) => onChange({ ...state, blockedApps: parseInt(e.target.value) || 0 })} />
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Notifications</div>
        <div className="field">
          <label>Reminder Time</label>
          <input type="text" value={state.reminderTime}
            onChange={(e) => onChange({ ...state, reminderTime: e.target.value })} />
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={state.pushEnabled}
              onChange={(e) => onChange({ ...state, pushEnabled: e.target.checked })} /> Push Notifications
          </label>
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={state.streakAlerts}
              onChange={(e) => onChange({ ...state, streakAlerts: e.target.checked })} /> Streak Alerts
          </label>
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={state.squadNotifs}
              onChange={(e) => onChange({ ...state, squadNotifs: e.target.checked })} /> Squad Notifications
          </label>
        </div>
      </div>
      <div className="field-group">
        <div className="field-group-title">Subscription</div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={state.isPro}
              onChange={(e) => onChange({ ...state, isPro: e.target.checked })}
              style={{ accentColor: '#00D68F' }} /> Pro Subscriber
          </label>
        </div>
        <div className="field">
          <label>Version</label>
          <input type="text" value={state.version}
            onChange={(e) => onChange({ ...state, version: e.target.value })} />
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { position: 'absolute', inset: 0, top: 54, overflow: 'hidden' },
  gradient: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0E1116 0%, #111922 40%, #0E1116 100%)' },
  content: { position: 'relative', zIndex: 1, padding: '0 20px', overflowY: 'auto', height: '100%' },

  /* Header — matches app's headerTitle style */
  headerTitle: {
    fontFamily: "'Inter Tight', sans-serif", fontWeight: 700, fontSize: 20,
    color: '#FFFFFF', paddingTop: 8, paddingBottom: 16,
  },

  /* Profile Card — 1:1 with profileCard style */
  profileCard: {
    display: 'flex', alignItems: 'center', gap: 12,
    backgroundColor: '#151A21', borderRadius: 12, padding: 16, marginBottom: 20,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#2C3440',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 17, color: '#FFFFFF',
  },
  profileEmail: {
    fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: '#9CA3AF', marginTop: 2,
  },

  /* Sections — 1:1 with SettingsSection */
  section: { marginBottom: 20 },
  sectionTitle: {
    fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 12,
    color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1,
    paddingLeft: 16, marginBottom: 8,
  },
  card: {
    backgroundColor: '#151A21', borderRadius: 12, overflow: 'hidden',
  },

  /* Rows — 1:1 with SettingsRow (minHeight 52, icon column 36px) */
  row: {
    display: 'flex', alignItems: 'center', minHeight: 52, padding: '0 16px',
  },
  iconCol: {
    width: 36, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0,
  },
  rowLabel: {
    flex: 1, fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 15,
    color: '#FFFFFF', marginRight: 8,
  },
  rowRight: {
    display: 'flex', alignItems: 'center', gap: 4, maxWidth: '42%',
  },
  rowValue: {
    fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 14, color: '#9CA3AF',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  /* Separator — hairline, inset to match icon column */
  separator: {
    height: 1, backgroundColor: '#2C3440', marginLeft: 52,
  },

  /* Toggle — 1:1 with Switch trackColor/thumbColor */
  toggle: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: '#2C3440',
    padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  toggleOn: { backgroundColor: '#3A66FF' },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF',
    transition: 'transform 0.2s',
  },
  toggleThumbOn: { transform: 'translateX(18px)' },
};
