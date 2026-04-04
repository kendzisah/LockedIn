import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import SettingsSheetShell from '../components/SettingsSheetShell';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import {
  NotificationService,
  formatReminderHHmmAs12h,
  persistReminderTimeHHmm,
  readReminderTimeHHmm,
} from '../../../services/NotificationService';
import { useSession } from '../../home/state/SessionProvider';

const HOURS12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINS = [0, 15, 30, 45] as const;

function to24h(h12: number, am: boolean): number {
  if (h12 === 12) return am ? 0 : 12;
  return am ? h12 : h12 + 12;
}

function from24h(h: number): { h12: number; am: boolean } {
  const am = h < 12;
  if (h === 0) return { h12: 12, am: true };
  if (h === 12) return { h12: 12, am: false };
  if (h < 12) return { h12: h, am: true };
  return { h12: h - 12, am: false };
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ReminderTimeSheet: React.FC<Props> = ({ visible, onClose }) => {
  const { state } = useSession();
  const [h12, setH12] = useState(9);
  const [min, setMin] = useState(0);
  const [am, setAm] = useState(true);

  React.useEffect(() => {
    if (!visible) return;
    void (async () => {
      const { hour, minute } = await readReminderTimeHHmm();
      const m = MINS.includes(minute as 0 | 15 | 30 | 45) ? minute : 0;
      const { h12: h, am: a } = from24h(hour);
      setH12(h);
      setMin(m);
      setAm(a);
    })();
  }, [visible]);

  const handleSet = async () => {
    const hour24 = to24h(h12, am);
    await persistReminderTimeHHmm(hour24, min);
    await NotificationService.scheduleAllDailyNotifications(state.consecutiveStreak);
    const label = formatReminderHHmmAs12h({ hour: hour24, minute: min });
    Alert.alert('Reminder set', `Reminder set for ${label}`);
    onClose();
  };

  return (
    <SettingsSheetShell visible={visible} onClose={onClose} title="Daily reminder time">
      <Text style={styles.sub}>We&apos;ll remind you to lock in at this time</Text>
      <View style={styles.pickers}>
        <Picker
          selectedValue={h12}
          onValueChange={(v) => setH12(Number(v))}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {HOURS12.map((h) => (
            <Picker.Item key={h} label={String(h)} value={h} color={Colors.textPrimary} />
          ))}
        </Picker>
        <Picker
          selectedValue={min}
          onValueChange={(v) => setMin(Number(v))}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {MINS.map((m) => (
            <Picker.Item
              key={m}
              label={String(m).padStart(2, '0')}
              value={m}
              color={Colors.textPrimary}
            />
          ))}
        </Picker>
        <Picker
          selectedValue={am ? 'AM' : 'PM'}
          onValueChange={(v) => setAm(v === 'AM')}
          style={styles.pickerSm}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="AM" value="AM" color={Colors.textPrimary} />
          <Picker.Item label="PM" value="PM" color={Colors.textPrimary} />
        </Picker>
      </View>
      <Pressable style={styles.save} onPress={handleSet}>
        <Text style={styles.saveText}>Set Time</Text>
      </Pressable>
    </SettingsSheetShell>
  );
};

const styles = StyleSheet.create({
  sub: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  pickers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: { flex: 1, color: Colors.textPrimary },
  pickerSm: { width: 100, color: Colors.textPrimary },
  pickerItem: { color: Colors.textPrimary },
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

export default ReminderTimeSheet;
