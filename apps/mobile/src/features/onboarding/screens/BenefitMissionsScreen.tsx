import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import BenefitTemplate from '../components/BenefitTemplate';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BenefitMissions'>;

interface MissionRow {
  title: string;
  xp: number;
  done: boolean;
  stat: { label: string; color: string };
}

const SAMPLE: MissionRow[] = [
  { title: 'Morning Focus Sprint', xp: 25, done: false, stat: { label: '+FOCUS', color: '#00C2FF' } },
  { title: 'Digital Sunset',       xp: 35, done: true,  stat: { label: '+DISCIPLINE', color: '#3A66FF' } },
  { title: 'Cold Discipline',      xp: 15, done: false, stat: { label: '+DISCIPLINE', color: '#3A66FF' } },
];

const Graphic: React.FC = () => (
  <View style={styles.card}>
    {SAMPLE.map((m) => (
      <View key={m.title} style={styles.row}>
        <View style={[styles.checkbox, m.done && styles.checkboxDone]}>
          {m.done ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
        <Text style={[styles.title, m.done && styles.titleDone]} numberOfLines={1}>
          {m.title}
        </Text>
        <View style={[styles.statPill, { backgroundColor: `${m.stat.color}26`, borderColor: `${m.stat.color}55` }]}>
          <Text style={[styles.statText, { color: m.stat.color }]}>{m.stat.label}</Text>
        </View>
        <Text style={styles.xp}>+{m.xp}</Text>
      </View>
    ))}
    <View style={styles.bonusRow}>
      <Text style={styles.bonusText}>Complete all 3:</Text>
      <Text style={styles.bonusXP}>+50 XP BONUS</Text>
    </View>
  </View>
);

const BenefitMissionsScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('BenefitMissions');
  return (
    <BenefitTemplate
      step={11}
      headline="DAILY MISSIONS"
      headlineColor={Colors.success}
      body="3 missions every day, built around your goal and weaknesses. Each mission targets a specific stat. Complete them all for bonus XP."
      graphic={<Graphic />}
      onContinue={() => navigation.navigate('BenefitRanks')}
    />
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  titleDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  statPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  xp: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    color: Colors.accent,
    width: 32,
    textAlign: 'right',
  },
  bonusRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bonusText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  bonusXP: {
    fontFamily: FontFamily.headingBold,
    fontSize: 12,
    color: Colors.warning,
    letterSpacing: 0.5,
  },
});

export default BenefitMissionsScreen;
