import React, { useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useOnboarding } from '../state/OnboardingProvider';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';

const PENDING_SIGNUP_KEY = '@lockedin/pending_signup';
const SIGNUP_PROMPT_DISMISSED_KEY = '@lockedin/signup_prompt_dismissed';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AccountPrompt'>;

const BENEFITS: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { icon: 'sync', label: 'Sync your data across devices' },
  { icon: 'people', label: 'Compete with friends in Crews' },
  { icon: 'phone-portrait-outline', label: 'Restore your streak if you switch phones' },
  { icon: 'person-circle-outline', label: 'Choose a display name and profile pic' },
];

const AccountPromptScreen: React.FC<Props> = () => {
  const { dispatch } = useOnboarding();
  useOnboardingTracking('AccountPrompt', 11);

  const onCreateAccount = useCallback(async () => {
    try {
      await AsyncStorage.setItem(PENDING_SIGNUP_KEY, 'true');
    } catch {}
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  }, [dispatch]);

  const onMaybeLater = useCallback(async () => {
    try {
      await AsyncStorage.setItem(SIGNUP_PROMPT_DISMISSED_KEY, 'onboarding');
    } catch {}
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  }, [dispatch]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBlock}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="shield-checkmark" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Protect your progress</Text>
          <Text style={styles.subtitle}>
            Create a free account so your streak, missions, and stats are never lost — even if you
            switch phones.
          </Text>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map(({ icon, label }) => (
            <View key={label} style={styles.benefitRow}>
              <View style={styles.benefitIconWrap}>
                <Ionicons name={icon} size={20} color={Colors.accent} />
              </View>
              <Text style={styles.benefitText}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onCreateAccount} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Create Free Account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryTap} onPress={onMaybeLater} activeOpacity={0.8}>
          <Text style={styles.secondaryText}>Maybe Later</Text>
        </TouchableOpacity>
        <Text style={styles.finePrint}>You can always sign up later in Settings</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  topBlock: {
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(0,194,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,194,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: 20,
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
    alignSelf: 'center',
  },
  benefits: {
    marginTop: 28,
    gap: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,194,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  footer: {
    padding: 24,
    paddingTop: 12,
  },
  primaryBtn: {
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.25)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.primary,
  },
  secondaryTap: {
    paddingVertical: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  finePrint: {
    marginTop: 12,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});

export default AccountPromptScreen;
