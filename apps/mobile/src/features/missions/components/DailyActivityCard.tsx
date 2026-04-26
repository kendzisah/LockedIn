/**
 * DailyActivityCard — Goal-specific daily check-in card. Reads the
 * user's primary goal, looks up the matching template from
 * DAILY_ACTIVITY_BY_GOAL, and renders a "LOG ACTIVITY" button that
 * opens ActivityLogSheet. Persists per-day completion in AsyncStorage
 * under @lockedin/daily_activity_done_<YYYY-MM-DD> so the card flips to
 * a completed state for the rest of the day.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import HUDPanel from '../../home/components/HUDPanel';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';
import { useOnboarding } from '../../onboarding/state/OnboardingProvider';
import { getDailyActivityForGoal } from '../MissionData';
import { Analytics } from '../../../services/AnalyticsService';
import ActivityLogSheet from '../sheets/ActivityLogSheet';

const STORAGE_PREFIX = '@lockedin/daily_activity_done_';

const localDateKey = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const DailyActivityCard: React.FC = () => {
  const { state } = useOnboarding();
  const goal = state.primaryGoal ?? '';
  const template = useMemo(() => getDailyActivityForGoal(goal), [goal]);

  const [done, setDone] = useState<boolean>(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Hydrate today's completion flag.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = `${STORAGE_PREFIX}${localDateKey()}`;
      const raw = await AsyncStorage.getItem(key);
      if (cancelled) return;
      setDone(raw === 'true');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogged = useCallback(async () => {
    const key = `${STORAGE_PREFIX}${localDateKey()}`;
    await AsyncStorage.setItem(key, 'true');
    setDone(true);
    setSheetOpen(false);
    Analytics.track('Daily Activity Logged', {
      goal,
      template: template?.title ?? 'unknown',
    });
  }, [goal, template?.title]);

  if (!template) {
    return null;
  }

  return (
    <>
      <HUDPanel headerLabel="DAILY ACTIVITY">
        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={done ? 'checkmark-circle' : 'flash'}
              size={28}
              color={done ? SystemTokens.green : SystemTokens.glowAccent}
            />
          </View>
          <View style={styles.copyCol}>
            <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
              {template.title}
            </Text>
            <Text style={styles.desc} numberOfLines={3}>
              {template.description}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.xp}>+{template.xp.medium} XP</Text>
              {done && <Text style={styles.doneTag}>LOGGED TODAY</Text>}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, done && styles.buttonDone]}
          onPress={() => !done && setSheetOpen(true)}
          disabled={done}
          activeOpacity={0.85}
        >
          <Text style={[styles.buttonText, done && styles.buttonTextDone]}>
            {done ? '✓  ACTIVITY LOGGED' : '⟐  LOG ACTIVITY'}
          </Text>
        </TouchableOpacity>
      </HUDPanel>

      <ActivityLogSheet
        visible={sheetOpen}
        template={template}
        onClose={() => setSheetOpen(false)}
        onLogged={handleLogged}
      />
    </>
  );
};

const styles = StyleSheet.create({
  body: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(58,102,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    color: SystemTokens.textPrimary,
    letterSpacing: -0.1,
  },
  titleDone: {
    color: SystemTokens.textMuted,
  },
  desc: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: SystemTokens.textMuted,
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  xp: {
    fontFamily: FontFamily.headingBold,
    fontSize: 12,
    color: SystemTokens.cyan,
    letterSpacing: 0.6,
  },
  doneTag: {
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    color: SystemTokens.green,
    letterSpacing: 1.2,
  },
  button: {
    marginTop: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.35)',
    alignItems: 'center',
  },
  buttonDone: {
    backgroundColor: 'rgba(0,214,143,0.08)',
    borderColor: 'rgba(0,214,143,0.3)',
  },
  buttonText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: SystemTokens.glowAccent,
  },
  buttonTextDone: {
    color: SystemTokens.green,
  },
});

export default React.memo(DailyActivityCard);
