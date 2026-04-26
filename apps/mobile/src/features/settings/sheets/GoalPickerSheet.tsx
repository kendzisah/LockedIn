import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import SettingsSheetShell from '../components/SettingsSheetShell';
import { FontFamily } from '../../../design/typography';
import { Analytics } from '../../../services/AnalyticsService';
import { getPrimaryGoals } from '../../missions/MissionEngine';
import { SystemTokens } from '../../home/systemTokens';

const ORDER: string[] = [
  'Build a business or side project',
  'Advance my career',
  'Improve my physique',
  'Increase discipline & self-control',
  'Reduce distractions',
  'Improve emotional control',
  'Study with consistency',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  currentGoal: string;
  onSave: (goal: string) => void;
}

const GoalPickerSheet: React.FC<Props> = ({
  visible,
  onClose,
  currentGoal,
  onSave,
}) => {
  const valid = new Set(getPrimaryGoals());
  const options = ORDER.filter((g) => valid.has(g));
  const [sel, setSel] = useState(currentGoal);

  React.useEffect(() => {
    if (visible) setSel(currentGoal);
  }, [visible, currentGoal]);

  const handleUpdate = () => {
    onSave(sel);
    Analytics.track('Settings Changed', { setting: 'primary_goal', value: sel });
    Alert.alert('Missions updated', 'Missions updated for your new goal.');
    onClose();
  };

  return (
    <SettingsSheetShell visible={visible} onClose={onClose} title="Primary Goal">
      <View style={styles.list}>
        {options.map((g) => {
          const active = sel === g;
          return (
            <Pressable
              key={g}
              onPress={() => setSel(g)}
              style={[
                styles.opt,
                active && styles.optOn,
              ]}
            >
              <Text style={[styles.optText, active && styles.optTextOn]}>
                {g}
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
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: SystemTokens.textSecondary,
    letterSpacing: -0.1,
  },
  optTextOn: {
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
  saveText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 1.8,
    color: SystemTokens.glowAccent,
  },
});

export default GoalPickerSheet;
