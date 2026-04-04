/**
 * SignUpScreen — User registration screen.
 *
 * Glassmorphic layout aligned with Missions / onboarding (gradient, orbs, frosted panels).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Dimensions,
  Easing,
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useAuth } from '../AuthProvider';
import type { MainStackParamList } from '../../../types/navigation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SignUpScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'SignUp'
>;

const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const sweepAnim = useRef(new Animated.Value(0)).current;

  const { signUp, signInWithApple, linkAccount, linkAppleAccount, isAnonymous } = useAuth();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(2500),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweepAnim]);

  const validateForm = (): boolean => {
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Invalid email address');
      return false;
    }

    if (!password) {
      setError('Password is required');
      return false;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    const { error: authError } = isAnonymous
      ? await linkAccount(email, password)
      : await signUp(email, password);
    setIsLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    navigation.replace('EditProfile', { source: 'signup' });
  };

  const handleSignInWithApple = async () => {
    setIsLoading(true);
    const { error: authError } = isAnonymous
      ? await linkAppleAccount()
      : await signInWithApple();
    setIsLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    navigation.replace('EditProfile', { source: 'signup' });
  };

  const handleContinueAsGuest = () => {
    navigation.replace('Tabs');
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0E1116', '#111922', '#0E1116']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowOrb} />
      <View style={styles.glowOrb2} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Sign up to save your progress</Text>
              <View style={styles.titleAccent}>
                <LinearGradient
                  colors={[Colors.primary, Colors.accent]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.titleAccentFill}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorGlass}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.formCard}>
              <View style={styles.formCardGlow} />
              <View style={styles.inputGroup}>
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
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="At least 8 characters"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={[styles.inputGroup, styles.inputGroupLast]}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter your password"
                  placeholderTextColor={Colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!isLoading}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handleSignUp}
                activeOpacity={0.9}
                style={[styles.ctaButton, isLoading && styles.ctaButtonDisabled]}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.textPrimary} />
                ) : (
                  <Text style={styles.ctaText}>Sign Up</Text>
                )}
                {!isLoading && (
                  <Animated.View
                    style={[
                      styles.shineOverlay,
                      {
                        transform: [
                          {
                            translateX: sweepAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-160, SCREEN_WIDTH],
                            }),
                          },
                        ],
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <LinearGradient
                      colors={[
                        'transparent',
                        'rgba(255,255,255,0.22)',
                        'rgba(180,210,255,0.35)',
                        'transparent',
                      ]}
                      locations={[0, 0.35, 0.65, 1]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.appleGlass}
                onPress={handleSignInWithApple}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.textPrimary} />
                ) : (
                  <Text style={styles.appleGlassText}>Sign up with Apple</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.signInLinkRow}>
              <Text style={styles.signInMuted}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignIn')} hitSlop={8}>
                <Text style={styles.signInLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.scrollSpacer} />

            <TouchableOpacity onPress={handleContinueAsGuest} hitSlop={12} style={styles.guestTap}>
              <Text style={styles.guestLink}>Continue as Guest</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  glowOrb: {
    position: 'absolute',
    top: 40,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(58,102,255,0.07)',
  },
  glowOrb2: {
    position: 'absolute',
    top: 280,
    right: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(0,194,255,0.05)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  scrollSpacer: {
    flexGrow: 1,
    minHeight: 16,
  },
  header: {
    marginBottom: 22,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    letterSpacing: -0.5,
    color: Colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
  },
  titleAccent: {
    marginTop: 14,
    height: 3,
    width: 48,
    borderRadius: 2,
    overflow: 'hidden',
  },
  titleAccentFill: {
    flex: 1,
  },
  errorGlass: {
    backgroundColor: 'rgba(255,71,87,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.danger,
  },
  formCard: {
    backgroundColor: 'rgba(21,26,33,0.72)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 22,
    overflow: 'hidden',
  },
  formCardGlow: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(58,102,255,0.06)',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupLast: {
    marginBottom: 0,
  },
  label: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: FontFamily.body,
    minHeight: 52,
  },
  actions: {
    gap: 12,
    marginBottom: 20,
  },
  ctaButton: {
    backgroundColor: 'rgba(58,102,255,0.42)',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    borderWidth: 1,
    borderColor: 'rgba(120,160,255,0.55)',
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaButtonDisabled: {
    opacity: 0.65,
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: 0.5,
    color: Colors.textPrimary,
  },
  shineOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 120,
  },
  appleGlass: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  appleGlassText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  signInLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  signInMuted: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textMuted,
  },
  signInLink: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: Colors.accent,
  },
  guestTap: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  guestLink: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
});

export default SignUpScreen;
