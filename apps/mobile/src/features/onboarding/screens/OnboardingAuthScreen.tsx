/**
 * OnboardingAuthScreen — Inline account creation / sign-in inside the
 * onboarding flow. Reached from AccountPromptScreen → "Save my character".
 *
 * Modes:
 *   - signup (default): display name + email + password + confirm password
 *   - signin           : email + password (no name)
 *
 * Apple Sign In works in both modes (Supabase resolves new vs returning).
 *
 * Cancel (X top-left) → navigation.goBack() returns user to AccountPrompt.
 * Success → navigate('Commitment') to continue onboarding.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useAuth } from '../../auth/AuthProvider';
import { useOnboarding } from '../state/OnboardingProvider';
import AppleAuthButton from '../../auth/components/AppleAuthButton';
import { Analytics } from '../../../services/AnalyticsService';
import { SupabaseService } from '../../../services/SupabaseService';
import { SubscriptionService } from '../../../services/SubscriptionService';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';

const MAX_NAME_LEN = 20;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingAuth'>;

const OnboardingAuthScreen: React.FC<Props> = ({ navigation, route }) => {
  useOnboardingTracking('OnboardingAuth');

  const initialMode = route.params?.mode ?? 'signup';
  const [mode, setMode] = useState<'signup' | 'signin'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;
  const authBusy = useRef(false);
  const { signUp, signIn, signInWithApple, isAuthenticated } = useAuth();
  const { dispatch } = useOnboarding();

  // If the user is already authenticated (signed in earlier this session),
  // there's no reason to render the auth form. Skip to Commitment so the
  // onboarding flow continues from where they'd otherwise land post-auth.
  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('Commitment');
    }
  }, [isAuthenticated, navigation]);

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }
  }, [screenOpacity]);

  const persistDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const client = SupabaseService.getClient();
    const userId = SupabaseService.getCurrentUserId();
    if (!client || !userId) return;
    try {
      await client
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', userId);
    } catch (e) {
      console.warn('[OnboardingAuth] persistDisplayName failed:', e);
    }
  }, []);

  const onSuccess = useCallback(
    async (method: 'email' | 'apple', wasSignUp: boolean) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Analytics.track('Account Created', {
        method,
        was_anonymous: true,
        was_sign_up: wasSignUp,
        source_nudge: 'onboarding',
      });
      Analytics.trackAF('af_complete_registration', { method });
      if (wasSignUp && displayName.trim()) {
        await persistDisplayName(displayName);
      }

      // Check subscription status synchronously — SubscriptionProvider's
      // reactive useEffect doesn't fire fast enough to influence the
      // navigation decision, so we ask RevenueCat directly here.
      // Subscribed → skip the rest of onboarding and land on Home.
      // Not subscribed → continue through Commitment → Paywall as normal.
      let subscribed = false;
      try {
        const userId = SupabaseService.getCurrentUserId();
        if (userId && SubscriptionService.isInitialized()) {
          subscribed = await SubscriptionService.logIn(userId);
        }
      } catch (e) {
        console.warn('[OnboardingAuth] subscription check failed:', e);
      }

      if (subscribed) {
        Analytics.track('Subscription Restored on Sign In', {
          method,
          source: 'onboarding',
        });
        // Skip the rest of the funnel (Commitment / ScheduleSession /
        // SocialProof / Paywall) — they're already paying, no need to sell.
        dispatch({ type: 'COMPLETE_ONBOARDING' });
      } else {
        navigation.replace('Commitment');
      }
    },
    [displayName, navigation, persistDisplayName, dispatch],
  );

  const validateSignUp = (): string | null => {
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) return 'Display name must be at least 2 characters';
    if (!email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email address';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const validateSignIn = (): string | null => {
    if (!email.trim()) return 'Email is required';
    if (!password) return 'Password is required';
    return null;
  };

  const handleSubmit = async () => {
    if (authBusy.current || isLoading) return;

    const validationError =
      mode === 'signup' ? validateSignUp() : validateSignIn();
    if (validationError) {
      setError(validationError);
      return;
    }

    authBusy.current = true;
    setIsLoading(true);
    setError('');
    try {
      const fn = mode === 'signup' ? signUp : signIn;
      const { error: authError } = await fn(email.trim(), password);
      if (authError) {
        setError(authError.message);
        Analytics.track('Sign Up Failed', {
          method: 'email',
          mode,
          error_code: authError.code,
        });
        return;
      }
      await onSuccess('email', mode === 'signup');
    } finally {
      setIsLoading(false);
      authBusy.current = false;
    }
  };

  const handleApple = async () => {
    if (authBusy.current || isLoading) return;
    authBusy.current = true;
    setIsLoading(true);
    setError('');
    try {
      const { error: authError } = await signInWithApple();
      if (authError) {
        if (authError.code !== 'ERR_CANCELED') {
          setError(authError.message);
          Analytics.track('Sign Up Failed', {
            method: 'apple',
            mode,
            error_code: authError.code,
          });
        }
        return;
      }
      await onSuccess('apple', true);
    } finally {
      setIsLoading(false);
      authBusy.current = false;
    }
  };

  const handleCancel = () => {
    Haptics.selectionAsync();
    navigation.goBack();
  };

  const switchMode = (next: 'signup' | 'signin') => {
    setMode(next);
    setError('');
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <LinearGradient
        colors={[Colors.background, '#111922', Colors.background]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glow} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={handleCancel}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>
              {mode === 'signup' ? 'CREATE YOUR ACCOUNT' : 'SIGN IN'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signup'
                ? 'Save your stats, rank, and streak permanently.'
                : 'Welcome back. Enter your credentials.'}
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.formCard}>
              {mode === 'signup' ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Display name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="What should we call you?"
                    placeholderTextColor={Colors.textMuted}
                    value={displayName}
                    onChangeText={(t) => setDisplayName(t.slice(0, MAX_NAME_LEN))}
                    editable={!isLoading}
                    maxLength={MAX_NAME_LEN}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                  <Text style={styles.helper}>
                    {displayName.length}/{MAX_NAME_LEN}
                  </Text>
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  editable={!isLoading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    mode === 'signup'
                      ? 'At least 8 characters'
                      : 'Your password'
                  }
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                  secureTextEntry
                  autoCapitalize="none"
                  returnKeyType={mode === 'signup' ? 'next' : 'done'}
                />
              </View>

              {mode === 'signup' ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter your password"
                    placeholderTextColor={Colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    editable={!isLoading}
                    secureTextEntry
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'signup' ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            {appleAvailable ? (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <AppleAuthButton
                  onPress={handleApple}
                  disabled={isLoading}
                  buttonType={
                    mode === 'signup'
                      ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                      : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                  }
                />
              </>
            ) : null}

            <View style={styles.switchRow}>
              <Text style={styles.switchHint}>
                {mode === 'signup'
                  ? 'Already have an account?'
                  : "Don't have an account?"}
              </Text>
              <TouchableOpacity
                onPress={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
                hitSlop={8}
              >
                <Text style={styles.switchLink}>
                  {mode === 'signup' ? 'Sign in' : 'Create one'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  glow: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(58,102,255,0.06)',
  },
  topBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  title: {
    marginTop: 8,
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,71,87,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.4)',
  },
  errorText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.danger,
    textAlign: 'center',
  },
  formCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(21,26,33,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 14,
  },
  field: {},
  label: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    color: Colors.textPrimary,
    fontFamily: FontFamily.body,
    fontSize: 15,
  },
  helper: {
    marginTop: 4,
    alignSelf: 'flex-end',
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: Colors.primary,
    borderRadius: 28,
    paddingVertical: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A66FF',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: -0.1,
    color: Colors.textPrimary,
  },
  dividerRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  switchRow: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  switchHint: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  switchLink: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.accent,
  },
});

export default OnboardingAuthScreen;
