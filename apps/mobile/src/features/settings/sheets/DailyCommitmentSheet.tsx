import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SettingsSheetShell from '../components/SettingsSheetShell';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';
import { Analytics } from '../../../services/AnalyticsService';
import { NotificationService } from '../../../services/NotificationService';
import { useSession } from '../../home/state/SessionProvider';

const OPTIONS = [15, 30, 45, 60, 90, 120] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  currentMinutes: number;
  onSave: (minutes: number) => void;
}

const DailyCommitmentSheet: React.FC<Props> = ({
  visible,
  onClose,
  currentMinutes,
  onSave,
}) => {
  const { state } = useSession();
  const [sel, setSel] = useState(currentMinutes);

  React.useEffect(() => {
    if (visible) setSel(currentMinutes);
  }, [visible, currentMinutes]);

  const handleUpdate = async () => {
    onSave(sel);
    await NotificationService.scheduleAllDailyNotifications(state.consecutiveStreak);
    Analytics.track('Settings Changed', {
      setting: 'daily_commitment',
      value: sel,
    });
    onClose();
  };

  return (
    <SettingsSheetShell visible={visible} onClose={onClose} title="Daily Commitment">
      <View style={styles.list}>
        {OPTIONS.map((m) => {
          const active = sel === m;
          return (
            <Pressable
              key={m}
              onPress={() => setSel(m)}
              style={[styles.opt, active && styles.optOn]}
            >
              <Text style={[styles.optText, active && styles.optTextOn]}>
                {m} MINUTES
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable style={styles.save} onPress={handleUpdate}>
        <Text style={styles.saveText}>⟐  UPDATE</Text>
      </Pressable>
    </SettingsSheetShell>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 6,
    marginBottom: 18,
  },
  opt: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.06)',
  },
  optOn: {
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderLeftColor: SystemTokens.glowAccent,
  },
  optText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: SystemTokens.textSecondary,
  },
  optTextOn: {
    color: SystemTokens.textPrimary,
  },
  save: {
    paddingVertical: 14,
    backgroundColor: 'rgba(58,102,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.45)',
    alignItems: 'center',
  },
  saveText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 1.8,
    color: SystemTokens.glowAccent,
  },
});

export default DailyCommitmentSheet;
