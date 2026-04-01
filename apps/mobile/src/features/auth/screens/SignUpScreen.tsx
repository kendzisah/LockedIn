/**
 * SignUpScreen — User registration screen.
 *
 * Features:
 * - Email + password input with validation
 * - "Sign Up" button (primary blue)
 * - "Sign in with Apple" button (white, standard Apple style)
 * - "Continue as Guest" link
 * - "Already have an account? Sign In" link
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

  const { signUp, signInWithApple } = useAuth();

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
    const { error: authError } = await signUp(email, password);
    setIsLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // Success - navigate to home
    navigation.replace('Home');
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
    navigation.replace('Home');
  };

  const handleContinueAsGuest = () => {
    navigation.replace('Home');
  };

  return (
    <ScreenContainer centered={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Sign up to save your progress
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
              placeholder="At least 8 characters"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
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

        {/* Sign Up Button */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title={isLoading ? 'Signing Up...' : 'Sign Up'}
            onPress={handleSignUp}
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
            <Text style={styles.appleButtonText}>Sign up with Apple</Text>
          )}
        </TouchableOpacity>

        {/* Sign In Link */}
        <View style={styles.signInLinkContainer}>
          <Text style={styles.signInLinkText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.signInLinkButton}>Sign In</Text>
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
  signInLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInLinkText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  signInLinkButton: {
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

export default SignUpScreen;
