import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SettingsSheetShell from '../components/SettingsSheetShell';
import { FontFamily } from '../../../design/typography';
import { Analytics } from '../../../services/AnalyticsService';
import { getWeaknessOptions } from '../../missions/MissionEngine';
import { SystemTokens } from '../../home/systemTokens';

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
    <SettingsSheetShell visible={visible} onClose={onClose} title="Focus Areas">
      <Text style={styles.sub}>SELECT 1–3 AREAS</Text>
      <View style={styles.list}>
        {options.map((label) => {
          const on = sel.has(label);
          const atMax = sel.size >= 3 && !on;
          return (
            <Pressable
              key={label}
              onPress={() => !atMax && toggle(label)}
              style={[
                styles.row,
                on && styles.rowOn,
                atMax && styles.rowDisabled,
              ]}
            >
              <View style={[styles.cb, on && styles.cbOn]}>
                {on ? (
                  <MaterialIcons name="check" size={14} color={SystemTokens.textPrimary} />
                ) : null}
              </View>
              <Text style={[styles.rowLabel, on && styles.rowLabelOn]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.save, !canSave && styles.saveOff]}
        onPress={handleUpdate}
        disabled={!canSave}
      >
        <Text style={styles.saveText}>⟐  UPDATE</Text>
      </Pressable>
    </SettingsSheetShell>
  );
};

const styles = StyleSheet.create({
  sub: {
    fontFamily: FontFamily.headingBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: SystemTokens.textMuted,
    marginBottom: 12,
  },
  list: {
    gap: 6,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.06)',
  },
  rowOn: {
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderLeftColor: SystemTokens.glowAccent,
  },
  rowDisabled: { opacity: 0.35 },
  cb: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cbOn: {
    backgroundColor: SystemTokens.glowAccent,
    borderColor: SystemTokens.glowAccent,
  },
  rowLabel: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: SystemTokens.textSecondary,
    letterSpacing: -0.1,
  },
  rowLabelOn: {
    color: SystemTokens.textPrimary,
    fontFamily: FontFamily.headingSemiBold,
  },
  save: {
    paddingVertical: 14,
    backgroundColor: 'rgba(58,102,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.45)',
    alignItems: 'center',
  },
  saveOff: { opacity: 0.4 },
  saveText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 1.8,
    color: SystemTokens.glowAccent,
  },
});

export default WeaknessPickerSheet;
