/**
 * SignInScreen — User login screen.
 *
 * Features:
 * - Email + password input with validation
 * - "Sign In" button (primary blue)
 * - "Sign in with Apple" button (white, standard Apple style)
 * - "Forgot password?" link
 * - "Don't have an account? Sign Up" link
 * - "Continue as Guest" link at bottom
 * - Error display
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../../design/components/ScreenContainer';
import PrimaryButton from '../../../design/components/PrimaryButton';
import { Colors } from '../../../design/colors';
import { FontFamily, Typography } from '../../../design/typography';
import { useAuth } from '../AuthProvider';
import type { MainStackParamList } from '../../../types/navigation';

type SignInScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'SignIn'
>;

const SignInScreen: React.FC<SignInScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signIn, signInWithApple } = useAuth();

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

    return true;
  };

  const handleSignIn = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    const { error: authError } = await signIn(email, password);
    setIsLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // Success - navigate to home
    navigation.replace('Tabs');
  };

  const handleSignInWithApple = async () => {
    setIsLoading(true);
    const { error: authError } = await signInWithApple();
    setIsLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // Success - navigate to home
    navigation.replace('Tabs');
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Reset Password',
      'Password reset is not yet available. Please contact support if you need help.',
      [{ text: 'OK' }],
    );
  };

  const handleContinueAsGuest = () => {
    navigation.replace('Tabs');
  };

  return (
    <ScreenContainer centered={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>
            Welcome back to Locked In
          </Text>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          {/* Email Input */}
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

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Forgot Password Link */}
          <TouchableOpacity
            onPress={handleForgotPassword}
            disabled={isLoading}
          >
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Sign In Button */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title={isLoading ? 'Signing In...' : 'Sign In'}
            onPress={handleSignIn}
            disabled={isLoading}
          />
        </View>

        {/* Apple Sign In Button */}
        <TouchableOpacity
          style={styles.appleButton}
          onPress={handleSignInWithApple}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <Text style={styles.appleButtonText}>Sign in with Apple</Text>
          )}
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View style={styles.signUpLinkContainer}>
          <Text style={styles.signUpLinkText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.signUpLinkButton}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Continue as Guest Link - Footer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={handleContinueAsGuest}>
          <Text style={styles.guestLink}>Continue as Guest</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 24,
    marginBottom: 32,
  },
  title: {
    ...Typography.heading,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  errorContainer: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  errorText: {
    ...Typography.body,
    color: Colors.danger,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: FontFamily.body,
    minHeight: 48,
  },
  forgotLink: {
    ...Typography.body,
    color: Colors.primary,
    textAlign: 'right',
  },
  buttonContainer: {
    marginBottom: 16,
  },
  appleButton: {
    backgroundColor: Colors.textPrimary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  appleButtonText: {
    ...Typography.button,
    color: Colors.background,
  },
  signUpLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpLinkText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  signUpLinkButton: {
    ...Typography.bodyMedium,
    color: Colors.primary,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  guestLink: {
    ...Typography.body,
    color: Colors.textMuted,
  },
});

export default SignInScreen;
