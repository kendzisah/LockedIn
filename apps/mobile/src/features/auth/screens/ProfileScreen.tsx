/**
 * ProfileScreen — User profile screen.
 *
 * Features:
 * - Display user email or "Guest" status
 * - Basic stats: current streak, lifetime minutes, program day
 * - "Link Account" button if anonymous (navigates to sign up)
 * - "Sign Out" button
 * - Complete dark theme matching app aesthetic
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
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

type ProfileScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'Profile'
>;

interface UserStats {
  currentStreak: number;
  lifetimeMinutes: number;
  programDay: number;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, isAnonymous, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<UserStats>({
    currentStreak: 0,
    lifetimeMinutes: 0,
    programDay: 1,
  });

  // In a real app, these would be fetched from Supabase
  // For now, using placeholder data
  useEffect(() => {
    // Simulate loading stats (would call API here)
    // setStats({ currentStreak: 12, lifetimeMinutes: 1240, programDay: 15 });
  }, [user]);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            const { error } = await signOut();
            setIsLoading(false);

            if (error) {
              Alert.alert('Error', error.message);
              return;
            }

            // Navigate to sign in after successful sign out
            navigation.replace('SignIn');
          },
        },
      ],
    );
  };

  const handleLinkAccount = () => {
    navigation.navigate('SignUp');
  };

  const displayEmail = user?.email || 'No email';
  const statusLabel = isAnonymous ? 'Guest Account' : 'Account Linked';
  const statusColor = isAnonymous ? Colors.textMuted : Colors.success;

  return (
    <ScreenContainer centered={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.label}>Email / Status</Text>
              <Text style={styles.email}>{displayEmail}</Text>
              <View style={styles.statusBadge}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: statusColor },
                  ]}
                />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {statusLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.currentStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats.lifetimeMinutes}
              </Text>
              <Text style={styles.statLabel}>Total Minutes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.programDay}</Text>
              <Text style={styles.statLabel}>Program Day</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {isAnonymous && (
            <PrimaryButton
              title="Link Account"
              onPress={handleLinkAccount}
              disabled={isLoading}
              style={styles.actionButton}
            />
          )}
          <PrimaryButton
            title={isLoading ? 'Signing Out...' : 'Sign Out'}
            onPress={handleSignOut}
            disabled={isLoading}
            secondary={!isAnonymous}
            style={styles.actionButton}
          />
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    ...Typography.heading,
    color: Colors.textPrimary,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  cardContent: {
    gap: 12,
  },
  label: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  email: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    ...Typography.hero,
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
    gap: 12,
  },
  actionButton: {
    width: '100%',
  },
});

export default ProfileScreen;
