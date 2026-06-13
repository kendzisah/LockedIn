/**
 * BreakPickerSheet — preset break-length picker for an active Lock In session.
 *
 * Reuses the HUD bottom-sheet shell + chip pattern. Selecting a length pauses
 * the focus timer for that long (auto-resumes at zero). Mounted once in
 * MainNavigator and triggered from both the timer page and the Home focus card.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SettingsSheetShell from '../../settings/components/SettingsSheetShell';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../systemTokens';

interface BreakOption {
  seconds: number;
  label: string;
}

const OPTIONS: BreakOption[] = [
  { seconds: 15, label: '15s' },
  { seconds: 30, label: '30s' },
  { seconds: 60, label: '1m' },
  { seconds: 120, label: '2m' },
  { seconds: 300, label: '5m' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (seconds: number) => void;
}

const BreakPickerSheet: React.FC<Props> = ({ visible, onClose, onSelect }) => {
  const handlePick = (seconds: number) => {
    onSelect(seconds);
    onClose();
  };

  return (
    <SettingsSheetShell visible={visible} onClose={onClose} title="Take a Break">
      <View style={styles.intro}>
        <Ionicons name="pause-circle-outline" size={14} color={SystemTokens.cyan} />
        <Text style={styles.introText}>
          Pause the timer. It resumes automatically when the break ends.
        </Text>
      </View>

      <View style={styles.grid}>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.seconds}
            onPress={() => handlePick(opt.seconds)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipActive]}
          >
            <Text style={styles.chipText}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    </SettingsSheetShell>
  );
};

const styles = StyleSheet.create({
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  introText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 17,
    color: SystemTokens.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexBasis: '31.5%',
    flexGrow: 1,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(58,102,255,0.14)',
    borderLeftColor: SystemTokens.glowAccent,
  },
  chipText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: SystemTokens.textPrimary,
    letterSpacing: -0.5,
  },
});

export default BreakPickerSheet;
