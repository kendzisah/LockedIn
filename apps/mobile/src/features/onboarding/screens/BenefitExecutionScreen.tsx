import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import BenefitTemplate from '../components/BenefitTemplate';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BenefitExecution'>;

const Graphic: React.FC = () => (
  <View style={styles.phoneFrame}>
    <View style={styles.phoneScreen}>
      <Text style={styles.timerLabel}>FOCUS SESSION</Text>
      <Text style={styles.timerValue}>01:28:47</Text>
      <View style={styles.lockBadge}>
        <Ionicons name="lock-closed" size={14} color={Colors.accent} />
        <Text style={styles.lockText}>HOLD TO UNLOCK</Text>
      </View>
    </View>
  </View>
);

const BenefitExecutionScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('BenefitExecution');
  return (
    <BenefitTemplate
      panelLabel="FOCUS SESSIONS"
      step={10}
      headline="FOCUS SESSIONS"
      headlineColor={Colors.primary}
      body="Set your timer. The system seals your distractions. Apps you selected? Gone. Try to open them and the system blocks you. Hold to quit early — but the system tracks that too."
      callout="+35 XP per 30-min session"
      calloutColor={Colors.accent}
      graphic={<Graphic />}
      onContinue={() => navigation.navigate('BenefitMissions')}
    />
  );
};

const styles = StyleSheet.create({
  phoneFrame: {
    width: 180,
    height: 220,
    borderRadius: 24,
    backgroundColor: '#0E1116',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 8,
    shadowColor: '#3A66FF',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#151A21',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  timerLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
  },
  timerValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    color: Colors.textPrimary,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,194,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,194,255,0.2)',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  lockText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.accent,
  },
});

export default BenefitExecutionScreen;
