/**
 * ActiveSessionProvider — single source of truth for a running Lock In session.
 *
 * The timer used to live inside ExecutionBlockScreen, which trapped the user on
 * a full-screen page. Lifting it here lets both the full timer page and the
 * minimized Home focus card read one live countdown + pause state, and lets a
 * session complete regardless of which screen (if any) is mounted.
 *
 * Timing is wall-clock based (endTimestamp − now) so backgrounding never drifts.
 * Pause/break freezes the focus countdown and pushes endTimestamp out on resume,
 * recomputed from the current clock so it's correct whether the break ran its
 * full length, was ended early, or elapsed while the app was backgrounded.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { StackActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useSession } from './SessionProvider';
import { useOnboarding } from '../../onboarding/state/OnboardingProvider';
import { getTodayKey, computeNewStreak } from '../engine/SessionEngine';
import { LockModeService } from '../../../services/LockModeService';
import { NotificationService } from '../../../services/NotificationService';
import { Analytics } from '../../../services/AnalyticsService';
import { rootNavigationRef } from '../../../navigation/rootNavigationRef';
import { subscribeLogoutCleanup } from '../../../services/logoutCleanupBus';

/** Persisted active-session record. Survives app kill for orphan recovery. */
export const ACTIVE_EB_KEY = '@lockedin/active_execution_block';

export interface ActiveSessionState {
  /** A focus session is running OR paused on a break. */
  isActive: boolean;
  durationMinutes: number;
  totalSeconds: number;
  startTimestamp: number;
  /** Wall-clock projected end of the focus block; pushed out on each resume. */
  endTimestamp: number;
  /** Derived focus seconds left (frozen while paused). */
  remaining: number;
  paused: boolean;
  breakEndTimestamp: number | null;
  /** Focus seconds frozen at break start. */
  pausedRemaining: number | null;
  /** Derived break seconds left (only meaningful while paused). */
  breakRemaining: number;
}

interface PersistedActiveSession {
  startTimestamp: number;
  endTimestamp: number;
  durationMinutes: number;
  paused: boolean;
  breakEndTimestamp: number | null;
  pausedRemaining: number | null;
}

interface ActiveSessionActions {
  startSession: (durationMinutes: number) => void;
  startBreak: (seconds: number) => void;
  resumeFromBreak: () => void;
  endSessionEarly: () => void;
}

const IDLE: ActiveSessionState = {
  isActive: false,
  durationMinutes: 0,
  totalSeconds: 0,
  startTimestamp: 0,
  endTimestamp: 0,
  remaining: 0,
  paused: false,
  breakEndTimestamp: null,
  pausedRemaining: null,
  breakRemaining: 0,
};

// Split so timer ticks (state) don't re-render action-only consumers like the
// navigator and the duration/break pickers.
const ActiveSessionStateContext = createContext<ActiveSessionState>(IDLE);
const ActiveSessionActionsContext = createContext<ActiveSessionActions>({
  startSession: () => {},
  startBreak: () => {},
  resumeFromBreak: () => {},
  endSessionEarly: () => {},
});

function remainingFrom(endTimestamp: number, now: number): number {
  return Math.max(0, Math.ceil((endTimestamp - now) / 1000));
}

export const ActiveSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { state: session, dispatch, isHydrated } = useSession();
  const { state: onboarding } = useOnboarding();

  // stateRef is the synchronous source of truth read by the ticker / AppState
  // handlers; setState keeps it in lockstep with the rendered state.
  const [state, setStateRaw] = useState<ActiveSessionState>(IDLE);
  const stateRef = useRef<ActiveSessionState>(IDLE);
  const setState = useCallback((next: ActiveSessionState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  // Latest session/onboarding for completion math (read inside callbacks).
  const sessionRef = useRef(session);
  const onboardingRef = useRef(onboarding);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { onboardingRef.current = onboarding; }, [onboarding]);

  const completedRef = useRef(false);

  const persist = useCallback((s: ActiveSessionState) => {
    if (!s.isActive) {
      AsyncStorage.removeItem(ACTIVE_EB_KEY).catch(() => {});
      return;
    }
    const payload: PersistedActiveSession = {
      startTimestamp: s.startTimestamp,
      endTimestamp: s.endTimestamp,
      durationMinutes: s.durationMinutes,
      paused: s.paused,
      breakEndTimestamp: s.breakEndTimestamp,
      pausedRemaining: s.pausedRemaining,
    };
    AsyncStorage.setItem(ACTIVE_EB_KEY, JSON.stringify(payload)).catch(() => {});
  }, []);

  // Mirrors the original ExecutionBlockScreen.computeStreakAfterCompletion,
  // reading the latest session/onboarding via refs.
  const computeStreakAfterCompletion = useCallback((sessionMinutes: number): number => {
    const s = sessionRef.current;
    const todayKey = getTodayKey();
    const dailyCommitment = onboardingRef.current.dailyMinutes ?? 60;
    const currentFocused = s.dailyFocusDate === todayKey ? s.dailyFocusedMinutes : 0;
    const newFocused = currentFocused + sessionMinutes;
    const goalAlreadyMet = s.dailyGoalMetDate === todayKey;

    if (newFocused >= dailyCommitment && !goalAlreadyMet) {
      dispatch({ type: 'DAILY_GOAL_MET' });
      Analytics.track('Daily Goal Met', {
        daily_commitment: dailyCommitment,
        actual_minutes: newFocused,
      });
      return computeNewStreak(s.lastSessionDayKey, s.consecutiveStreak, todayKey);
    }
    return 0;
  }, [dispatch]);

  // Terminal completion: credits minutes, ends shield, routes to SessionComplete.
  // Works whether triggered from the full page, while minimized, or by the ticker.
  const finishSession = useCallback((creditMinutes: number) => {
    if (completedRef.current) return;
    completedRef.current = true;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    LockModeService.endSession();
    NotificationService.cancelExecutionBlockDone();
    AsyncStorage.removeItem(ACTIVE_EB_KEY).catch(() => {});

    dispatch({ type: 'COMPLETE_EXECUTION_BLOCK', payload: { durationMinutes: creditMinutes } });
    void NotificationService.onSessionCompletedToday();

    const resultStreak = computeStreakAfterCompletion(creditMinutes);

    Analytics.track('Session Completed', {
      type: 'execution_block',
      duration_minutes: creditMinutes,
      streak_day: resultStreak || sessionRef.current.consecutiveStreak,
    });

    setState(IDLE);

    if (rootNavigationRef.isReady()) {
      const params = {
        phase: 'execution_block' as const,
        durationMinutes: creditMinutes,
        streak: resultStreak,
      };
      // If the full timer page is showing, REPLACE it so it isn't left in the
      // stack beneath SessionComplete (which later replaces itself with Tabs).
      // While minimized, EB isn't in the stack, so push SessionComplete instead.
      if (rootNavigationRef.getCurrentRoute()?.name === 'ExecutionBlock') {
        rootNavigationRef.dispatch(StackActions.replace('SessionComplete', params));
      } else {
        rootNavigationRef.navigate('Main', { screen: 'SessionComplete', params });
      }
    }
  }, [dispatch, computeStreakAfterCompletion, setState]);

  const startSession = useCallback((durationMinutes: number) => {
    const now = Date.now();
    const totalSeconds = durationMinutes * 60;
    const endTimestamp = now + totalSeconds * 1000;
    completedRef.current = false;

    const next: ActiveSessionState = {
      isActive: true,
      durationMinutes,
      totalSeconds,
      startTimestamp: now,
      endTimestamp,
      remaining: totalSeconds,
      paused: false,
      breakEndTimestamp: null,
      pausedRemaining: null,
      breakRemaining: 0,
    };
    setState(next);
    persist(next);

    LockModeService.beginSession(durationMinutes);
    NotificationService.scheduleExecutionBlockDone(new Date(endTimestamp));
    Analytics.track('Session Started', {
      type: 'execution_block',
      duration_minutes: durationMinutes,
      streak_day: sessionRef.current.consecutiveStreak,
    });
    Analytics.timeEvent('Session Completed');
  }, [setState, persist]);

  const startBreak = useCallback((seconds: number) => {
    const s = stateRef.current;
    if (!s.isActive || s.paused) return;
    const now = Date.now();
    const pausedRemaining = remainingFrom(s.endTimestamp, now);
    const breakEndTimestamp = now + seconds * 1000;

    const next: ActiveSessionState = {
      ...s,
      paused: true,
      pausedRemaining,
      breakEndTimestamp,
      breakRemaining: seconds,
    };
    setState(next);
    persist(next);

    // Lift the distraction shield for the break; resumeFromBreak restores it.
    LockModeService.endSession();
    NotificationService.cancelExecutionBlockDone();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Analytics.track('Break Started', {
      type: 'execution_block',
      break_seconds: seconds,
      remaining_seconds: pausedRemaining,
    });
  }, [setState, persist]);

  const resumeFromBreak = useCallback(() => {
    const s = stateRef.current;
    if (!s.isActive || !s.paused) return;
    const now = Date.now();
    const remaining = s.pausedRemaining ?? remainingFrom(s.endTimestamp, now);
    const endTimestamp = now + remaining * 1000;

    const next: ActiveSessionState = {
      ...s,
      paused: false,
      breakEndTimestamp: null,
      pausedRemaining: null,
      breakRemaining: 0,
      endTimestamp,
      remaining,
    };
    setState(next);
    persist(next);

    // Restore the shield with seconds-accuracy so the native auto-unshield
    // deadline matches the new endTimestamp.
    LockModeService.beginSessionSeconds(remaining);
    NotificationService.scheduleExecutionBlockDone(new Date(endTimestamp));
    Analytics.track('Break Ended', {
      type: 'execution_block',
      remaining_seconds: remaining,
    });
  }, [setState, persist]);

  const endSessionEarly = useCallback(() => {
    const s = stateRef.current;
    if (!s.isActive || completedRef.current) return;
    const now = Date.now();
    const remaining = s.paused
      ? (s.pausedRemaining ?? 0)
      : remainingFrom(s.endTimestamp, now);
    const elapsedSeconds = Math.max(0, s.totalSeconds - remaining);

    Analytics.track('Session Abandoned', {
      type: 'execution_block',
      duration_minutes: s.durationMinutes,
      elapsed_seconds: elapsedSeconds,
      reason: 'hold_to_unlock',
    });

    if (elapsedSeconds < 60) {
      completedRef.current = true;
      LockModeService.endSession();
      NotificationService.cancelExecutionBlockDone();
      AsyncStorage.removeItem(ACTIVE_EB_KEY).catch(() => {});
      setState(IDLE);
      if (rootNavigationRef.isReady()) {
        rootNavigationRef.navigate('Main', { screen: 'Tabs', params: { screen: 'HomeTab' } });
      }
      return;
    }

    finishSession(Math.ceil(elapsedSeconds / 60));
  }, [finishSession, setState]);

  // ── Single ticker — the only interval in the app while a session runs ──
  useEffect(() => {
    if (!state.isActive) return;
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s.isActive) return;
      const now = Date.now();
      if (s.paused) {
        const breakRemaining = Math.max(0, Math.ceil(((s.breakEndTimestamp ?? now) - now) / 1000));
        if (breakRemaining <= 0) {
          resumeFromBreak();
        } else if (breakRemaining !== s.breakRemaining) {
          setState({ ...s, breakRemaining });
        }
      } else {
        const remaining = remainingFrom(s.endTimestamp, now);
        if (remaining <= 0) {
          finishSession(s.durationMinutes);
        } else if (remaining !== s.remaining) {
          setState({ ...s, remaining });
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [state.isActive, resumeFromBreak, finishSession, setState]);

  // ── Re-sync on foreground: resume an elapsed break first, then check complete ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      const s = stateRef.current;
      if (!s.isActive) return;
      const now = Date.now();

      if (s.paused) {
        if ((s.breakEndTimestamp ?? 0) <= now) {
          resumeFromBreak();
          const s2 = stateRef.current; // synchronously updated by resumeFromBreak
          if (remainingFrom(s2.endTimestamp, now) <= 0) finishSession(s2.durationMinutes);
        } else {
          setState({ ...s, breakRemaining: Math.max(0, Math.ceil((s.breakEndTimestamp! - now) / 1000)) });
        }
        return;
      }

      const remaining = remainingFrom(s.endTimestamp, now);
      if (remaining <= 0) finishSession(s.durationMinutes);
      else setState({ ...s, remaining });
    });
    return () => sub.remove();
  }, [resumeFromBreak, finishSession, setState]);

  // ── Hydrate / orphan recovery on mount (after SessionProvider hydrates) ──
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!isHydrated || hydratedRef.current) return;
    hydratedRef.current = true;

    const completeFromHydrate = (info: PersistedActiveSession) => {
      LockModeService.endSession();
      const elapsedMs = info.endTimestamp - info.startTimestamp;
      const elapsedMinutes = Math.ceil(Math.max(0, elapsedMs) / 60_000);
      if (elapsedMinutes >= 1) {
        dispatch({ type: 'COMPLETE_EXECUTION_BLOCK', payload: { durationMinutes: elapsedMinutes } });
      }
      AsyncStorage.removeItem(ACTIVE_EB_KEY).catch(() => {});
    };

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_EB_KEY);
        if (!raw) return;
        const info = JSON.parse(raw) as PersistedActiveSession;
        const now = Date.now();
        const totalSeconds = info.durationMinutes * 60;

        if (info.paused && info.breakEndTimestamp != null) {
          if (info.breakEndTimestamp > now) {
            // Still on break — restore paused (shield stays lifted, as at break start).
            completedRef.current = false;
            const pausedRemaining = info.pausedRemaining ?? remainingFrom(info.endTimestamp, now);
            setState({
              isActive: true,
              durationMinutes: info.durationMinutes,
              totalSeconds,
              startTimestamp: info.startTimestamp,
              endTimestamp: info.endTimestamp,
              remaining: pausedRemaining,
              paused: true,
              breakEndTimestamp: info.breakEndTimestamp,
              pausedRemaining,
              breakRemaining: Math.max(0, Math.ceil((info.breakEndTimestamp - now) / 1000)),
            });
            return;
          }
          // Break elapsed while killed → resume the focus block.
          const pausedRemaining = info.pausedRemaining ?? 0;
          if (pausedRemaining <= 0) { completeFromHydrate(info); return; }
          const endTimestamp = now + pausedRemaining * 1000;
          completedRef.current = false;
          const restored: ActiveSessionState = {
            isActive: true,
            durationMinutes: info.durationMinutes,
            totalSeconds,
            startTimestamp: info.startTimestamp,
            endTimestamp,
            remaining: pausedRemaining,
            paused: false,
            breakEndTimestamp: null,
            pausedRemaining: null,
            breakRemaining: 0,
          };
          setState(restored);
          persist(restored);
          LockModeService.beginSessionSeconds(pausedRemaining);
          NotificationService.scheduleExecutionBlockDone(new Date(endTimestamp));
          return;
        }

        if (info.endTimestamp > now) {
          completedRef.current = false;
          setState({
            isActive: true,
            durationMinutes: info.durationMinutes,
            totalSeconds,
            startTimestamp: info.startTimestamp,
            endTimestamp: info.endTimestamp,
            remaining: remainingFrom(info.endTimestamp, now),
            paused: false,
            breakEndTimestamp: null,
            pausedRemaining: null,
            breakRemaining: 0,
          });
          NotificationService.scheduleExecutionBlockDone(new Date(info.endTimestamp));
          return;
        }

        // Expired while the app was killed.
        completeFromHydrate(info);
      } catch {
        AsyncStorage.removeItem(ACTIVE_EB_KEY).catch(() => {});
      }
    })();
  }, [isHydrated, dispatch, setState, persist]);

  // ── Reset in-memory state on sign-out (storage cleared separately) ──
  useEffect(() => {
    return subscribeLogoutCleanup(() => {
      completedRef.current = true;
      LockModeService.endSession();
      setState(IDLE);
    });
  }, [setState]);

  const actions = React.useMemo<ActiveSessionActions>(
    () => ({ startSession, startBreak, resumeFromBreak, endSessionEarly }),
    [startSession, startBreak, resumeFromBreak, endSessionEarly],
  );

  return (
    <ActiveSessionActionsContext.Provider value={actions}>
      <ActiveSessionStateContext.Provider value={state}>
        {children}
      </ActiveSessionStateContext.Provider>
    </ActiveSessionActionsContext.Provider>
  );
};

/** Live session state — re-renders on every timer tick. */
export const useActiveSession = (): ActiveSessionState =>
  useContext(ActiveSessionStateContext);

/** Stable session actions — does not re-render on timer ticks. */
export const useActiveSessionActions = (): ActiveSessionActions =>
  useContext(ActiveSessionActionsContext);
