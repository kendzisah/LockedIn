import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SettingsSheetShell from '../components/SettingsSheetShell';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { Analytics } from '../../../services/AnalyticsService';
import { getStatsForWeakness, getWeaknessOptions } from '../../missions/MissionEngine';
import StatPills from '../components/StatPills';

interface Props {
  visible: boolean;
  onClose: () => void;
  current: string[];
  onSave: (w: string[]) => void;
}

const WeaknessPickerSheet: React.FC<Props> = ({
  visible,
  onClose,
  current,
  onSave,
}) => {
  const options = useMemo(() => getWeaknessOptions(), []);
  const [sel, setSel] = useState<Set<string>>(() => new Set(current));

  React.useEffect(() => {
    if (visible) setSel(new Set(current));
  }, [visible, current]);

  const toggle = (key: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < 3) {
        next.add(key);
      }
      return next;
    });
  };

  const handleUpdate = () => {
    const arr = [...sel];
    if (arr.length === 0) return;
    onSave(arr);
    Analytics.track('Settings Changed', { setting: 'weaknesses', value: arr.join(',') });
    onClose();
  };

  const canSave = sel.size >= 1;

  return (
    <SettingsSheetShell visible={visible} onClose={onClose} title="Focus areas">
      <Text style={styles.sub}>Select 1–3 areas</Text>
      <View style={styles.gap}>
        {options.map((label) => {
          const on = sel.has(label);
          const atMax = sel.size >= 3 && !on;
          return (
            <Pressable
              key={label}
              onPress={() => !atMax && toggle(label)}
              style={[styles.row, atMax && styles.rowDisabled]}
            >
              <View style={[styles.cb, on && styles.cbOn]}>
                {on ? (
                  <MaterialIcons name="check" size={16} color={Colors.textPrimary} />
                ) : null}
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{label}</Text>
                <StatPills stats={getStatsForWeakness(label)} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        style={[styles.save, !canSave && styles.saveOff]}
        onPress={handleUpdate}
        disabled={!canSave}
      >
        <Text style={styles.saveText}>Update</Text>
      </Pressable>
    </SettingsSheetShell>
  );
};

const styles = StyleSheet.create({
  sub: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  gap: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  rowDisabled: { opacity: 0.35 },
  rowBody: {
    flex: 1,
    paddingTop: 2,
  },
  cb: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cbOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rowLabel: {
    flex: 1,
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
  saveOff: { opacity: 0.4 },
  saveText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
});

export default WeaknessPickerSheet;
