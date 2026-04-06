import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SettingsSheetShell from '../components/SettingsSheetShell';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
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
    <SettingsSheetShell visible={visible} onClose={onClose} title="Daily commitment">
      <View style={styles.gap}>
        {OPTIONS.map((m) => {
          const active = sel === m;
          return (
            <Pressable
              key={m}
              onPress={() => setSel(m)}
              style={[styles.opt, active && styles.optOn]}
            >
              <Text style={styles.optText}>{m} minutes</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable style={styles.save} onPress={handleUpdate}>
        <Text style={styles.saveText}>Update</Text>
      </Pressable>
    </SettingsSheetShell>
  );
};

const styles = StyleSheet.create({
  gap: { gap: 8 },
  opt: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optOn: {
    backgroundColor: 'rgba(58,102,255,0.15)',
    borderColor: Colors.primary,
  },
  optText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  save: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
});

export default DailyCommitmentSheet;
