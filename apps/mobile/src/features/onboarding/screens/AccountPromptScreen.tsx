import React, { useCallback, useEffect } from 'react';
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
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { useAuth } from '../../auth/AuthProvider';

const SIGNUP_PROMPT_DISMISSED_KEY = '@lockedin/signup_prompt_dismissed';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AccountPrompt'>;

const BENEFITS: string[] = [
  'Your rank and OVR are saved permanently',
  'Never lose your streak — even if you switch phones',
  'Save every XP point and achievement you earn',
  'Compete in guild leaderboards with your squad',
  'Get personalized weekly system reports',
  'Sync your stats across multiple devices',
  'Customize your display name and avatar',
];

const AccountPromptScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('AccountPrompt');
  const { isAuthenticated } = useAuth();

  // If the user is already signed in (e.g. signed in earlier from the
  // Definition screen, or returning mid-flow), skip this screen entirely
  // and continue to Commitment. No point asking them to create an account.
  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('Commitment');
    }
  }, [isAuthenticated, navigation]);

  const onCreateAccount = useCallback(() => {
    navigation.navigate('OnboardingAuth', { mode: 'signup' });
  }, [navigation]);

  const onSignIn = useCallback(() => {
    navigation.navigate('OnboardingAuth', { mode: 'signin' });
  }, [navigation]);

  const onMaybeLater = useCallback(async () => {
    try {
      await AsyncStorage.setItem(SIGNUP_PROMPT_DISMISSED_KEY, 'onboarding');
    } catch {}
    navigation.navigate('Commitment');
  }, [navigation]);

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
          <Text style={styles.title}>LOCK IN YOUR PROGRESS</Text>
          <Text style={styles.subtitle}>
            Your stats, rank, and streak are tied to your account. Create one to make sure nothing is lost.
          </Text>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map((label) => (
            <View key={label} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.benefitText}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onCreateAccount} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Save my character</Text>
        </TouchableOpacity>
        <View style={styles.signInRow}>
          <Text style={styles.signInHint}>Already have an account?</Text>
          <TouchableOpacity onPress={onSignIn} hitSlop={8}>
            <Text style={styles.signInLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.secondaryTap} onPress={onMaybeLater} activeOpacity={0.8}>
          <Text style={styles.secondaryText}>Maybe Later</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
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
  signInRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  signInHint: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  signInLink: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.accent,
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
