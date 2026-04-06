import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import SettingsSheetShell from '../components/SettingsSheetShell';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { Analytics } from '../../../services/AnalyticsService';
import { getPrimaryGoals } from '../../missions/MissionEngine';

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
    <SettingsSheetShell visible={visible} onClose={onClose} title="Primary goal">
      <View style={styles.gap}>
        {options.map((g) => {
          const active = sel === g;
          return (
            <Pressable
              key={g}
              onPress={() => setSel(g)}
              style={[styles.opt, active && styles.optOn]}
            >
              <Text style={styles.optText}>{g}</Text>
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

export default GoalPickerSheet;
