/**
 * ProfileTab — Glassmorphic profile with stats, weekly report, and settings menus.
 */

import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as StoreReview from 'expo-store-review';
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

const FORMSPREE_URL = 'https://formspree.io/f/xwvwngjo';

const ProfileTab: React.FC = () => {
  const tabNav = useNavigation();
  const navigation = tabNav.getParent<NavProp>();
  const { state } = useSession();
  const { user, signOut, isAnonymous } = useAuth();
  const { totalXP } = useMissions();

  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const streak = state.consecutiveStreak;
  const tierInfo = useMemo(() => getStreakTierInfo(streak), [streak]);
  const focusHours = Math.round((state.lifetimeTotalMinutes / 60) * 10) / 10;
  const initial = (user?.email?.[0] ?? 'U').toUpperCase();

  const handleFeedback = useCallback(() => setFeedbackVisible(true), []);
  const handleRate = useCallback(async () => {
    try {
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview();
      }
    } catch {
      // silently fail if review dialog unavailable
    }
  }, []);
  const handlePremium = useCallback(() => {
    navigation?.navigate('PaywallOffer');
  }, [navigation]);
  const handleEditProfile = useCallback(() => {
    navigation?.navigate('EditProfile', { source: 'profile' });
  }, [navigation]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0E1116', '#111922', '#0E1116']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
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

          {/* Guest banner */}
          {isAnonymous && (
            <View style={styles.guestCard}>
              <View style={styles.guestBadge}>
                <Text style={styles.guestBadgeText}>Guest Account</Text>
              </View>
              <Text style={styles.guestMsg}>
                Create an account to keep your progress forever
              </Text>
              <TouchableOpacity
                style={styles.guestSignUpBtn}
                onPress={() => navigation?.navigate('SignUp')}
                activeOpacity={0.85}
              >
                <Text style={styles.guestSignUpText}>Sign Up</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation?.navigate('SignIn')}
                style={{ marginTop: 8, alignItems: 'center' }}
              >
                <Text style={styles.guestSignInText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

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
            onPress={() => navigation?.navigate('WeeklyReport')}
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
            {!isAnonymous && (
              <MenuItem icon="person-outline" label="Edit Profile" onPress={handleEditProfile} />
            )}
            <MenuItem icon="notifications-outline" label="Notifications" />
            <MenuItem icon="diamond-outline" label="Inner Circle" badge="Premium" isLast onPress={handlePremium} />
          </View>

          {/* App section */}
          <Text style={styles.menuSectionLabel}>App</Text>
          <View style={styles.menuGroup}>
            <MenuItem icon="chatbubble-outline" label="Send Feedback" onPress={handleFeedback} />
            <MenuItem icon="star-outline" label="Rate Locked In" isLast onPress={handleRate} />
          </View>

          <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.7}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        userEmail={user?.email ?? undefined}
      />
    </View>
  );
};

// ─── Feedback Modal ──────────────────────────────────────

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail?: string;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ visible, onClose, userEmail }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const canSend = message.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    Keyboard.dismiss();
    setSending(true);

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          email: userEmail ?? 'anonymous',
          _subject: 'Locked In App Feedback',
        }),
      });

      if (res.ok) {
        setSent(true);
        setTimeout(() => {
          handleClose();
        }, 1800);
      } else {
        Alert.alert('Error', 'Failed to send feedback. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    setSent(false);
    setSending(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable style={fb.overlay} onPress={handleClose}>
        <Pressable style={fb.card} onPress={(e) => e.stopPropagation()}>
          {sent ? (
            <View style={fb.sentContainer}>
              <View style={fb.sentIconWrap}>
                <Ionicons name="checkmark-circle" size={36} color={Colors.success} />
              </View>
              <Text style={fb.sentTitle}>Thank you!</Text>
              <Text style={fb.sentSub}>Your feedback helps us improve Locked In.</Text>
            </View>
          ) : (
            <>
              <View style={fb.heroIcon}>
                <Ionicons name="chatbubble-ellipses" size={22} color={Colors.accent} />
              </View>

              <Text style={fb.title}>Send Feedback</Text>
              <Text style={fb.subtitle}>
                Tell us what you love, what's broken, or what you'd like to see next.
              </Text>

              <TextInput
                ref={inputRef}
                style={fb.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Your feedback..."
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
                maxLength={2000}
                autoFocus
              />

              <View style={fb.charRow}>
                <Text style={fb.charCount}>{message.length}/2000</Text>
              </View>

              <TouchableOpacity
                style={[fb.sendBtn, !canSend && fb.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!canSend}
                activeOpacity={0.85}
              >
                {sending ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <View style={fb.sendBtnInner}>
                    <Ionicons name="send" size={15} color={Colors.primary} />
                    <Text style={fb.sendBtnText}>Send Feedback</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleClose} style={fb.cancelBtn} activeOpacity={0.8}>
                <Text style={fb.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Stat Card ───────────────────────────────────────────

interface StatCardProps { value: string; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
const StatCard: React.FC<StatCardProps> = ({ value, label, color, icon }) => (
  <View style={styles.statCard}>
    <Ionicons name={icon} size={16} color={color} style={{ marginBottom: 8, opacity: 0.7 }} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── Menu Item ───────────────────────────────────────────

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
  isLast?: boolean;
  onPress?: () => void;
}
const MenuItem: React.FC<MenuItemProps> = ({ icon, label, badge, isLast, onPress }) => (
  <TouchableOpacity
    style={[styles.menuItem, isLast && styles.menuItemLast]}
    activeOpacity={0.7}
    onPress={onPress}
  >
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

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  avatarGlow: {
    position: 'absolute', top: -20, alignSelf: 'center',
    width: 200, height: 200, borderRadius: 100,
  },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  avatarSection: { alignItems: 'center', marginTop: 16, marginBottom: 12 },
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

  guestCard: {
    backgroundColor: 'rgba(44,52,64,0.4)',
    borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  guestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(21,26,33,0.6)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  guestBadgeText: {
    fontFamily: FontFamily.headingSemiBold, fontSize: 11, color: '#FFC857',
  },
  guestMsg: {
    fontFamily: FontFamily.body, fontSize: 14,
    color: Colors.textSecondary, marginTop: 8,
  },
  guestSignUpBtn: {
    marginTop: 12, width: '100%' as any,
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(58,102,255,0.25)',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  guestSignUpText: {
    fontFamily: FontFamily.headingSemiBold, fontSize: 15, color: Colors.primary,
  },
  guestSignInText: {
    fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.accent,
  },
  signOutBtn: {
    alignItems: 'center', paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,71,87,0.15)', borderRadius: 12,
    backgroundColor: 'rgba(255,71,87,0.04)',
  },
  signOutText: { fontFamily: FontFamily.headingSemiBold, fontSize: 15, color: Colors.danger },
});

const fb = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(18,22,28,0.97)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0,194,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,194,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 20,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(44,52,64,0.3)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 120,
    maxHeight: 200,
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  charRow: {
    alignItems: 'flex-end',
    marginTop: 6,
    marginBottom: 16,
  },
  charCount: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  sendBtn: {
    borderRadius: 14,
    backgroundColor: 'rgba(58,102,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.2)',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  sendBtnDisabled: {
    opacity: 0.35,
    backgroundColor: 'rgba(44,52,64,0.3)',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  sendBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 15,
    color: Colors.primary,
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
  sentContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  sentIconWrap: {
    marginBottom: 14,
  },
  sentTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 20,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  sentSub: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

export default ProfileTab;
