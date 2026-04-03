/**
 * ProfileTab — Glassmorphic profile with stats, weekly report, and settings menus.
 */

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../home/state/SessionProvider';
import { useAuth } from '../AuthProvider';
import { useMissions } from '../../missions/MissionsProvider';
import { getStreakTierInfo } from '../../../design/streakTiers';
import type { MainStackParamList } from '../../../types/navigation';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

const ProfileTab: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { state } = useSession();
  const { user, signOut } = useAuth();
  const { totalXP } = useMissions();

  const streak = state.consecutiveStreak;
  const tierInfo = useMemo(() => getStreakTierInfo(streak), [streak]);
  const focusHours = Math.round((state.lifetimeTotalMinutes / 60) * 10) / 10;
  const initial = (user?.email?.[0] ?? 'U').toUpperCase();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0E1116', '#111922', '#0E1116']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Avatar glow orb */}
      <View style={[styles.avatarGlow, { backgroundColor: `${tierInfo.color}08` }]} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Avatar section */}
          <View style={styles.avatarSection}>
            <View style={[styles.avatarRing, { borderColor: `${tierInfo.color}40` }]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{initial}</Text>
              </View>
            </View>
            <Text style={styles.name}>{user?.email ?? 'Locked In User'}</Text>
            {tierInfo.current && (
              <View style={[styles.tierBadge, { backgroundColor: `${tierInfo.color}12`, borderColor: `${tierInfo.color}25` }]}>
                <Ionicons name="flame" size={12} color={tierInfo.color} />
                <Text style={[styles.tierText, { color: tierInfo.color }]}>
                  {tierInfo.current.label} Streak
                </Text>
              </View>
            )}
          </View>

          {/* Stats grid 2x2 */}
          <View style={styles.statsGrid}>
            <StatCard value={`${streak}`} label="Streak" color={Colors.primary} icon="flame" />
            <StatCard value={`${focusHours}h`} label="Focus Hours" color={Colors.accent} icon="time" />
            <StatCard value={`${state.lifetimeExecutionBlocks}`} label="Lock Ins" color={Colors.success} icon="lock-closed" />
            <StatCard value={`${totalXP}`} label="Total XP" color="#FFC857" icon="star" />
          </View>

          {/* Weekly Report Card */}
          <TouchableOpacity
            style={styles.reportCard}
            onPress={() => navigation.navigate('WeeklyReport')}
            activeOpacity={0.85}
          >
            <View style={styles.reportLeft}>
              <Ionicons name="bar-chart" size={20} color={Colors.success} />
            </View>
            <View style={styles.reportText}>
              <Text style={styles.reportTitle}>Weekly Report Card</Text>
              <Text style={styles.reportSub}>View your progress breakdown</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Account section */}
          <Text style={styles.menuSectionLabel}>Account</Text>
          <View style={styles.menuGroup}>
            <MenuItem icon="person-outline" label="Edit Profile" />
            <MenuItem icon="notifications-outline" label="Notifications" />
            <MenuItem icon="diamond-outline" label="Inner Circle" badge="Premium" isLast />
          </View>

          {/* App section */}
          <Text style={styles.menuSectionLabel}>App</Text>
          <View style={styles.menuGroup}>
            <MenuItem icon="settings-outline" label="Settings" />
            <MenuItem icon="chatbubble-outline" label="Send Feedback" />
            <MenuItem icon="star-outline" label="Rate Locked In" isLast />
          </View>

          <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.7}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

interface StatCardProps { value: string; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
const StatCard: React.FC<StatCardProps> = ({ value, label, color, icon }) => (
  <View style={styles.statCard}>
    <Ionicons name={icon} size={16} color={color} style={{ marginBottom: 8, opacity: 0.7 }} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

interface MenuItemProps { icon: keyof typeof Ionicons.glyphMap; label: string; badge?: string; isLast?: boolean }
const MenuItem: React.FC<MenuItemProps> = ({ icon, label, badge, isLast }) => (
  <TouchableOpacity style={[styles.menuItem, isLast && styles.menuItemLast]} activeOpacity={0.7}>
    <View style={styles.menuIconWrap}>
      <Ionicons name={icon} size={18} color={Colors.textSecondary} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
    {badge && (
      <View style={styles.menuBadge}>
        <Text style={styles.menuBadgeText}>{badge}</Text>
      </View>
    )}
    <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  avatarGlow: {
    position: 'absolute', top: -20, alignSelf: 'center',
    width: 200, height: 200, borderRadius: 100,
  },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginTop: 16, marginBottom: 28 },
  avatarRing: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  avatar: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: 'rgba(21,26,33,0.8)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLetter: { fontFamily: FontFamily.headingBold, fontSize: 28, color: Colors.textPrimary },
  name: { fontFamily: FontFamily.headingSemiBold, fontSize: 17, color: Colors.textPrimary, marginBottom: 8 },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5,
  },
  tierText: { fontFamily: FontFamily.headingSemiBold, fontSize: 11, letterSpacing: 0.3 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '48%' as any,
    backgroundColor: 'rgba(21,26,33,0.6)',
    borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  statValue: { fontFamily: FontFamily.headingBold, fontSize: 24, marginBottom: 4 },
  statLabel: {
    fontFamily: FontFamily.body, fontSize: 11, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  reportCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(21,26,33,0.6)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    padding: 16, marginBottom: 28, gap: 12,
  },
  reportLeft: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(0,214,143,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,214,143,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  reportText: { flex: 1 },
  reportTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 14, color: Colors.textPrimary },
  reportSub: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  menuSectionLabel: {
    fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden', marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(44,52,64,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { flex: 1, fontFamily: FontFamily.body, fontSize: 15, color: Colors.textPrimary },
  menuBadge: {
    backgroundColor: 'rgba(58,102,255,0.15)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(58,102,255,0.2)',
  },
  menuBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 10, color: Colors.primary },

  signOutBtn: {
    alignItems: 'center', paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,71,87,0.15)', borderRadius: 12,
    backgroundColor: 'rgba(255,71,87,0.04)',
  },
  signOutText: { fontFamily: FontFamily.headingSemiBold, fontSize: 15, color: Colors.danger },
});

export default ProfileTab;
