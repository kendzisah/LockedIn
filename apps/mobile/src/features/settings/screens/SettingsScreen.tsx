/**
 * Unified Settings (Profile tab) — plan, notifications, subscription, account, about.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as StoreReview from 'expo-store-review';
import Constants from 'expo-constants';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { User } from '@supabase/supabase-js';
import type { MainStackParamList } from '../../../types/navigation';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useAuth } from '../../auth/AuthProvider';
import { useSession } from '../../home/state/SessionProvider';
import { useOnboarding } from '../../onboarding/state/OnboardingProvider';
import { useSubscription } from '../../subscription/SubscriptionProvider';
import { useMissions } from '../../missions/MissionsProvider';
import { SupabaseService } from '../../../services/SupabaseService';
import { LockModeService } from '../../../services/LockModeService';
import {
  KEY_NOTIF_USER_DISABLED,
  NotificationService,
  formatReminderHHmmAs12h,
  readReminderTimeHHmm,
} from '../../../services/NotificationService';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HAS_ACTIVE_CREW_STORAGE_KEY } from '../../leaderboard/CrewService';
import SettingsSection from '../components/SettingsSection';
import SettingsRow from '../components/SettingsRow';
import DailyCommitmentSheet from '../sheets/DailyCommitmentSheet';
import GoalPickerSheet from '../sheets/GoalPickerSheet';
import WeaknessPickerSheet from '../sheets/WeaknessPickerSheet';
import ReminderTimeSheet from '../sheets/ReminderTimeSheet';
import ChangePasswordSheet from '../sheets/ChangePasswordSheet';
import DeleteAccountSheet from '../sheets/DeleteAccountSheet';
import ResetDataSheet from '../sheets/ResetDataSheet';
import {
  PRIVACY_POLICY_URL,
  TERMS_URL,
  iosAppStoreReviewUrl,
  iosShareMessage,
} from '../settingsConstants';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

const FORMSPREE_URL = 'https://formspree.io/f/xwvwngjo';
const KEY_NOTIF_STREAK = '@lockedin/notif_streak_alerts';
const KEY_NOTIF_CREW = '@lockedin/notif_crew_updates';

function hasEmailIdentity(user: User | null): boolean {
  if (!user || user.is_anonymous) return false;
  const ids = user.identities ?? [];
  return ids.some((i) => i.provider === 'email');
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

const SettingsScreen: React.FC = () => {
  const tabNav = useNavigation();
  const navigation = tabNav.getParent<NavProp>();
  const { user, signOut, isAnonymous } = useAuth();
  const { state: session, dispatch: sessionDispatch } = useSession();
  const { state: ob, dispatch: obDispatch, isHydrated: obHydrated } = useOnboarding();
  const { isSubscribed, restorePurchases } = useSubscription();
  const { regenerateTodaysMissions } = useMissions();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [permStatus, setPermStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [userDisabledPush, setUserDisabledPush] = useState(false);
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [crewNotifs, setCrewNotifs] = useState(true);
  const [reminderLabel, setReminderLabel] = useState('9:00 AM');
  const [hasCrew, setHasCrew] = useState(false);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [blockedAppCount, setBlockedAppCount] = useState(0);

  const [sheetDaily, setSheetDaily] = useState(false);
  const [sheetGoal, setSheetGoal] = useState(false);
  const [sheetWeak, setSheetWeak] = useState(false);
  const [sheetTime, setSheetTime] = useState(false);
  const [sheetPw, setSheetPw] = useState(false);
  const [sheetDelete, setSheetDelete] = useState(false);
  const [sheetReset, setSheetReset] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const streak = session.consecutiveStreak;
  const dailyMinutes = ob.dailyMinutes ?? 60;
  const primaryGoal = ob.primaryGoal ?? 'Increase discipline & self-control';
  const weaknesses = ob.selectedWeaknesses ?? [];

  const refreshNotifPrefs = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermStatus(status);
    const dis = (await AsyncStorage.getItem(KEY_NOTIF_USER_DISABLED)) === 'true';
    setUserDisabledPush(dis);
    setStreakAlerts((await AsyncStorage.getItem(KEY_NOTIF_STREAK)) !== 'false');
    setCrewNotifs((await AsyncStorage.getItem(KEY_NOTIF_CREW)) !== 'false');
    const t = await readReminderTimeHHmm();
    setReminderLabel(formatReminderHHmmAs12h(t));
    setHasCrew((await AsyncStorage.getItem(HAS_ACTIVE_CREW_STORAGE_KEY)) === 'true');
  }, []);

  useEffect(() => {
    refreshNotifPrefs();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshNotifPrefs();
    });
    return () => sub.remove();
  }, [refreshNotifPrefs]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || isAnonymous) return;
      (async () => {
        const client = SupabaseService.getClient();
        const uid = SupabaseService.getCurrentUserId();
        if (!client || !uid) return;
        const { data } = await client
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', uid)
          .maybeSingle();
        if (data?.display_name) setDisplayName(String(data.display_name));
        if (data?.avatar_url) setAvatarUrl(String(data.avatar_url));
      })();
      LockModeService.getSelectedAppCount().then(setBlockedAppCount).catch(() => {});
    }, [user?.id, isAnonymous]),
  );

  const [loadingAppPicker, setLoadingAppPicker] = useState(false);

  const handleBlockedApps = useCallback(async () => {
    setLoadingAppPicker(true);
    try {
      const count = await LockModeService.showAppPicker();
      setBlockedAppCount(count);
    } catch {
      // picker unavailable (e.g. Screen Time not authorized)
    } finally {
      setLoadingAppPicker(false);
    }
  }, []);

  const pushMasterOn =
    permStatus === 'granted' && !userDisabledPush;
  const osDenied = permStatus === 'denied';

  const onToggleMaster = async (on: boolean) => {
    const { status: before } = await Notifications.getPermissionsAsync();
    await NotificationService.setPushMasterEnabled(on, streak);
    await refreshNotifPrefs();
    if (on && before === 'denied') {
      const { status: after } = await Notifications.getPermissionsAsync();
      if (after === 'denied') openOsSettings();
    }
  };

  const onToggleStreak = async (on: boolean) => {
    setStreakAlerts(on);
    await NotificationService.setStreakAlertsPreference(on, streak);
  };

  const onToggleCrew = async (on: boolean) => {
    setCrewNotifs(on);
    await NotificationService.setCrewNotifPreference(on, streak);
  };

  const openOsSettings = () => Linking.openSettings();

  const handleSignOut = () => {
    Alert.alert('Sign Out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void signOut().then(() => navigation?.navigate('SignIn'));
        },
      },
    ]);
  };

  const handleRestore = async () => {
    setRestoreErr(null);
    setRestoring(true);
    try {
      const ok = await restorePurchases();
      if (ok) Alert.alert('Purchases restored', 'Your purchases were restored.');
      else setRestoreErr('No purchases found to restore.');
    } catch {
      setRestoreErr('Restore failed. Try again.');
    } finally {
      setRestoring(false);
    }
  };

  const afterDeleteAccount = async () => {
    sessionDispatch({ type: 'FULL_RESET' });
    obDispatch({ type: 'FULL_RESET' });
    try {
      await signOut();
    } catch {
      /* session may already be invalid */
    }
  };

  const resetDataConfirm = async () => {
    sessionDispatch({ type: 'FULL_RESET' });
    obDispatch({ type: 'FULL_RESET' });
    try {
      await signOut();
    } catch {
      /* ignore */
    }
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const goalShort = useMemo(() => truncate(primaryGoal, 22), [primaryGoal]);

  const profileCard = (
    <Pressable
      style={styles.profileCard}
      onPress={() =>
        isAnonymous
          ? navigation?.navigate('SignUp')
          : navigation?.navigate('EditProfile', { source: 'profile' })
      }
    >
      {isAnonymous ? (
        <View style={styles.avatarPlaceholder}>
          <MaterialIcons name="person-outline" size={28} color={Colors.textMuted} />
        </View>
      ) : avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <MaterialIcons name="person" size={28} color={Colors.textMuted} />
        </View>
      )}
      <View style={styles.profileText}>
        {isAnonymous ? (
          <>
            <Text style={styles.profileName}>Guest Account</Text>
            <Text style={styles.profileSub}>Sign up to save your progress</Text>
          </>
        ) : (
          <>
            <Text style={styles.profileName}>
              {displayName?.trim() ? displayName : 'No display name'}
            </Text>
            <Text style={styles.profileSub}>{user?.email ?? ''}</Text>
          </>
        )}
      </View>
      <MaterialIcons
        name="chevron-right"
        size={20}
        color={isAnonymous ? Colors.accent : Colors.textMuted}
      />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.headerTitle}>Settings</Text>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionCardWrap}>{profileCard}</View>

          <SettingsSection label="Your plan">
            <SettingsRow
              icon="timer"
              label="Daily commitment"
              value={`${dailyMinutes} min`}
              onPress={() => obHydrated && setSheetDaily(true)}
            />
            <SettingsRow
              icon="flag"
              label="Primary goal"
              value={goalShort}
              onPress={() => obHydrated && setSheetGoal(true)}
            />
            <SettingsRow
              icon="psychology"
              label="Focus areas"
              value={`${weaknesses.length} selected`}
              onPress={() => obHydrated && setSheetWeak(true)}
            />
            <SettingsRow
              icon="block"
              label="Blocked apps"
              value={loadingAppPicker ? 'Loading…' : blockedAppCount > 0 ? `${blockedAppCount} app${blockedAppCount === 1 ? '' : 's'}` : 'None'}
              onPress={handleBlockedApps}
              disabled={loadingAppPicker}
            />
          </SettingsSection>

          <SettingsSection label="Notifications">
            <SettingsRow
              icon="notifications"
              label="Push notifications"
              toggle
              toggleValue={pushMasterOn}
              onToggleChange={(v) => void onToggleMaster(v)}
              toggleStatus={osDenied ? 'Denied' : undefined}
              toggleStatusColor={osDenied ? Colors.danger : undefined}
            />
            <SettingsRow
              icon="alarm"
              label="Daily reminder time"
              value={reminderLabel}
              onPress={() => pushMasterOn && setSheetTime(true)}
              disabled={!pushMasterOn}
            />
            <SettingsRow
              icon="local-fire-department"
              label="Streak protection alerts"
              toggle
              toggleValue={streakAlerts}
              onToggleChange={(v) => void onToggleStreak(v)}
              disabled={!pushMasterOn}
            />
            {hasCrew ? (
              <SettingsRow
                icon="group"
                label="Crew notifications"
                toggle
                toggleValue={crewNotifs}
                onToggleChange={(v) => void onToggleCrew(v)}
                disabled={!pushMasterOn}
              />
            ) : null}
          </SettingsSection>

          <SettingsSection label="Subscription">
            {isSubscribed ? (
              <>
                <SettingsRow
                  icon="verified"
                  iconColor={Colors.success}
                  label="Locked In Pro"
                  value="Active"
                  valueColor={Colors.success}
                  showChevron={false}
                />
                <SettingsRow
                  icon="credit-card"
                  label="Manage subscription"
                  onPress={() =>
                    Linking.openURL(
                      Platform.OS === 'ios'
                        ? 'https://apps.apple.com/account/subscriptions'
                        : 'https://play.google.com/store/account/subscriptions',
                    )
                  }
                />
                <SettingsRow
                  icon="refresh"
                  label="Restore purchases"
                  onPress={() => void handleRestore()}
                />
              </>
            ) : (
              <>
                <SettingsRow
                  icon="star"
                  iconColor={Colors.warning}
                  label="Upgrade to Pro"
                  onPress={() => navigation?.navigate('PaywallOffer')}
                />
                <SettingsRow
                  icon="refresh"
                  label="Restore purchases"
                  onPress={() => void handleRestore()}
                />
              </>
            )}
            {restoreErr ? <Text style={styles.inlineErr}>{restoreErr}</Text> : null}
            {restoring ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 8 }} />
            ) : null}
          </SettingsSection>

          <SettingsSection label="Account">
            {!isAnonymous ? (
              <>
                {hasEmailIdentity(user) ? (
                  <SettingsRow
                    icon="lock"
                    label="Change password"
                    onPress={() => setSheetPw(true)}
                  />
                ) : null}
                <SettingsRow icon="logout" label="Sign out" onPress={handleSignOut} />
                <SettingsRow
                  icon="delete-outline"
                  iconColor={Colors.danger}
                  label="Delete account"
                  onPress={() => setSheetDelete(true)}
                />
              </>
            ) : (
              <>
                <SettingsRow
                  icon="person-add"
                  iconColor={Colors.accent}
                  label="Create account"
                  onPress={() => navigation?.navigate('SignUp')}
                />
                <SettingsRow
                  icon="login"
                  label="Sign in to existing account"
                  onPress={() => navigation?.navigate('SignIn')}
                />
                <SettingsRow
                  icon="delete-outline"
                  iconColor={Colors.danger}
                  label="Reset all data"
                  onPress={() => setSheetReset(true)}
                />
              </>
            )}
          </SettingsSection>

          <SettingsSection label="About">
            <SettingsRow
              icon="chat"
              label="Send feedback"
              onPress={() => setFeedbackOpen(true)}
            />
            <SettingsRow
              icon="star-rate"
              label="Rate Locked In"
              onPress={async () => {
                try {
                  if (await StoreReview.hasAction()) await StoreReview.requestReview();
                  else await Linking.openURL(iosAppStoreReviewUrl());
                } catch {
                  await Linking.openURL(iosAppStoreReviewUrl());
                }
              }}
            />
            <SettingsRow
              icon="share"
              label="Share with a friend"
              onPress={() => Share.share({ message: iosShareMessage() })}
            />
            <SettingsRow
              icon="privacy-tip"
              label="Privacy policy"
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            />
            <SettingsRow
              icon="description"
              label="Terms of service"
              onPress={() => Linking.openURL(TERMS_URL)}
            />
            <SettingsRow
              icon="info-outline"
              label="Version"
              value={appVersion}
              showChevron={false}
            />
          </SettingsSection>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      <DailyCommitmentSheet
        visible={sheetDaily}
        onClose={() => setSheetDaily(false)}
        currentMinutes={dailyMinutes}
        onSave={(m) => obDispatch({ type: 'SET_DAILY_MINUTES', payload: m })}
      />
      <GoalPickerSheet
        visible={sheetGoal}
        onClose={() => setSheetGoal(false)}
        currentGoal={primaryGoal}
        onSave={(g) => {
          obDispatch({ type: 'SET_PRIMARY_GOAL', payload: g });
          regenerateTodaysMissions({ goal: g });
        }}
      />
      <WeaknessPickerSheet
        visible={sheetWeak}
        onClose={() => setSheetWeak(false)}
        current={weaknesses}
        onSave={(w) => {
          obDispatch({ type: 'SET_WEAKNESSES', payload: w });
          regenerateTodaysMissions({ weaknesses: w });
        }}
      />
      <ReminderTimeSheet visible={sheetTime} onClose={() => { setSheetTime(false); void refreshNotifPrefs(); }} />
      <ChangePasswordSheet visible={sheetPw} onClose={() => setSheetPw(false)} email={user?.email ?? ''} />
      <DeleteAccountSheet
        visible={sheetDelete}
        onClose={() => setSheetDelete(false)}
        onDeleted={() => void afterDeleteAccount()}
      />
      <ResetDataSheet
        visible={sheetReset}
        onClose={() => setSheetReset(false)}
        onConfirm={resetDataConfirm}
      />

      <FeedbackModal
        visible={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        userEmail={user?.email ?? undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1 },
  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },
  sectionCardWrap: { marginBottom: 20 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1 },
  profileName: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: Colors.textPrimary,
  },
  profileSub: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inlineErr: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.danger,
    paddingHorizontal: 16,
    marginTop: 4,
  },
});

function FeedbackModal({
  visible,
  onClose,
  userEmail,
}: {
  visible: boolean;
  onClose: () => void;
  userEmail?: string;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleClose = () => {
    setMessage('');
    setSent(false);
    onClose();
  };

  const send = async () => {
    if (!message.trim()) return;
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
        timerRef.current = setTimeout(handleClose, 1600);
      } else Alert.alert('Error', 'Failed to send feedback.');
    } catch {
      Alert.alert('Error', 'Network error.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={fm.overlay} onPress={handleClose}>
        <Pressable style={fm.card} onPress={(e) => e.stopPropagation()}>
          {sent ? (
            <Text style={fm.thanks}>Thank you!</Text>
          ) : (
            <>
              <Text style={fm.title}>Send Feedback</Text>
              <TextInput
                style={fm.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Your feedback..."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity style={fm.btn} onPress={send} disabled={sending}>
                {sending ? <ActivityIndicator color="#fff" /> : <Text style={fm.btnText}>Send</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose}>
                <Text style={fm.cancel}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  input: {
    minHeight: 100,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  btnText: { fontFamily: FontFamily.headingSemiBold, color: '#fff' },
  cancel: { textAlign: 'center', marginTop: 12, color: Colors.textMuted },
  thanks: { fontFamily: FontFamily.heading, fontSize: 18, color: Colors.success, textAlign: 'center' },
});

export default SettingsScreen;
