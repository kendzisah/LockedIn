/**
 * ScheduleSessionScreen — onboarding step 24.
 * Time picker for the user's first session tomorrow. The act of picking
 * a time creates a behavioral commitment before the paywall — Opal's
 * "schedule your blocking time" tactic.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDPanel from '../../home/components/HUDPanel';
import HUDSectionLabel from '../components/HUDSectionLabel';
import ScrollPicker from '../../home/components/ScrollPicker';
import PrimaryButton from '../../../design/components/PrimaryButton';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ScheduleSession'>;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

const FIRST_SESSION_NOTIF_ID = '@lockedin/first_session_reminder';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function format12h(hour: number, minute: number): string {
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${pad(minute)} ${ampm}`;
}

async function scheduleFirstSession(hour: number, minute: number): Promise<void> {
  try {
    // Cancel any prior reminder so re-runs don't pile up.
    await Notifications.cancelScheduledNotificationAsync(FIRST_SESSION_NOTIF_ID).catch(
      () => {},
    );

    const target = new Date();
    target.setSeconds(0, 0);
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= Date.now()) {
      // Slot already passed today → schedule for tomorrow.
      target.setDate(target.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      identifier: FIRST_SESSION_NOTIF_ID,
      content: {
        title: 'Time to lock in',
        body: 'Your first session is now. The system is waiting.',
        sound: 'default',
      },
      trigger: { type: 'date', date: target } as Notifications.NotificationTriggerInput,
    });
  } catch (err) {
    console.warn('[ScheduleSession] failed to schedule:', err);
  }
}

const ScheduleSessionScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('ScheduleSession');

  const { state, dispatch } = useOnboarding();
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const durationMin = state.dailyMinutes ?? 30;
  const timeLabel = useMemo(() => format12h(hour, minute), [hour, minute]);

  const handleConfirm = async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const stored = `${pad(hour)}:${pad(minute)}`;
    dispatch({ type: 'SET_SCHEDULED_SESSION_TIME', payload: stored });
    Analytics.track('Onboarding Answer Submitted', {
      screen: 'ScheduleSession',
      answer: stored,
      duration_min: durationMin,
    });

    // Best-effort schedule. If notification permission has been denied this
    // is a no-op — the user already saw the permissions screen earlier and
    // chose; no need to re-prompt here.
    void scheduleFirstSession(hour, minute);

    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => navigation.navigate('SocialProof'));
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <HUDSectionLabel label="FIRST PROTOCOL" />
          <Text style={styles.title}>When will you lock in tomorrow?</Text>
          <Text style={styles.subtitle}>
            Pick a time. The system will remind you.
          </Text>

          <HUDPanel headerLabel="SESSION TIME" style={styles.panel}>
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <ScrollPicker
                  values={HOURS}
                  selectedValue={hour}
                  onValueChange={setHour}
                  formatValue={(v) => pad(v)}
                  label="HOUR"
                />
              </View>
              <Text style={styles.colon}>:</Text>
              <View style={styles.pickerCol}>
                <ScrollPicker
                  values={MINUTES}
                  selectedValue={minute}
                  onValueChange={setMinute}
                  formatValue={(v) => pad(v)}
                  label="MIN"
                />
              </View>
            </View>

            <View style={styles.summary}>
              <Text style={styles.summaryTime}>{timeLabel}</Text>
              <Text style={styles.summaryDuration}>
                Duration: {durationMin} min
              </Text>
            </View>
          </HUDPanel>

          <Text style={styles.hint}>
            7:00 AM – 8:00 AM is the most popular time slot.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title="> SCHEDULE SESSION"
            onPress={handleConfirm}
            style={styles.cta}
          />
        </View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 32,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
    marginBottom: 18,
  },
  panel: {
    marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickerCol: {
    flex: 1,
    maxWidth: 120,
  },
  colon: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    color: SystemTokens.cyan,
  },
  summary: {
    marginTop: 14,
    alignItems: 'center',
  },
  summaryTime: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: SystemTokens.cyan,
  },
  summaryDuration: {
    marginTop: 4,
    fontFamily: FontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: SystemTokens.textMuted,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: SystemTokens.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: Colors.background,
  },
  cta: {
    width: '100%',
  },
});

export default ScheduleSessionScreen;
