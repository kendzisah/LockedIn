import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, View, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { InterTight_600SemiBold } from '@expo-google-fonts/inter-tight/600SemiBold';
import { InterTight_700Bold } from '@expo-google-fonts/inter-tight/700Bold';
import { InterTight_800ExtraBold } from '@expo-google-fonts/inter-tight/800ExtraBold';
import { AuthProvider } from '../features/auth/AuthProvider';
import { OnboardingProvider } from '../features/onboarding/state/OnboardingProvider';
import { SubscriptionProvider } from '../features/subscription/SubscriptionProvider';
import { SessionProvider } from '../features/home/state/SessionProvider';
import { MissionsProvider } from '../features/missions/MissionsProvider';
import { useOnboarding } from '../features/onboarding/state/OnboardingProvider';
import { useSession } from '../features/home/state/SessionProvider';
import RootNavigator from '../navigation/RootNavigator';
import { Colors } from '../design/colors';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseService } from '../services/SupabaseService';
import { NotificationService, type NotificationPayload } from '../services/NotificationService';
import { rootNavigationRef } from '../navigation/rootNavigationRef';
import { CrewService } from '../features/leaderboard/CrewService';
import { AppsFlyerService } from '../services/AppsFlyerService';
import { MixpanelService } from '../services/MixpanelService';
import { Analytics } from '../services/AnalyticsService';
import Purchases from 'react-native-purchases';
import { ENV } from '../config/env';

const LAST_OPEN_KEY = '@lockedin/last_app_open';

// Keep splash screen visible while fonts + auth load
SplashScreen.preventAutoHideAsync();

/**
 * Bridges onboarding + session state into MissionsProvider props so the 3-slot
 * engine receives the user's goal, weaknesses, onboarding date, and streak.
 */
const MissionsBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state: onboarding } = useOnboarding();
  const { state: session } = useSession();

  return (
    <MissionsProvider
      userGoal={onboarding.primaryGoal ?? undefined}
      userWeaknesses={onboarding.selectedWeaknesses}
      streak={session.consecutiveStreak}
    >
      {children}
    </MissionsProvider>
  );
};

const App: React.FC = () => {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    InterTight_800ExtraBold,
  });

  const [authReady, setAuthReady] = useState(false);
  const attRequested = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        AppsFlyerService.initSdk({
          devKey: ENV.APPSFLYER_DEV_KEY,
          isDebug: __DEV__,
          appId: ENV.APPSFLYER_APP_ID,
          manualStart: true,
          timeToWaitForATTUserAuthorization: 10,
        });

        await MixpanelService.initialize();
        await SupabaseService.initialize();

        // Identify user in analytics on boot
        const userId = SupabaseService.getCurrentUserId();
        if (userId) {
          await Analytics.identify(userId);
        }

        // Detect returning user for App Returned event
        let streak = 0;
        try {
          const lastOpenRaw = await AsyncStorage.getItem(LAST_OPEN_KEY);
          const sessionRaw = await AsyncStorage.getItem('@lockedin/session_state');
          if (sessionRaw) {
            const parsed = JSON.parse(sessionRaw);
            streak = parsed.consecutiveStreak ?? 0;
          }

          if (lastOpenRaw) {
            const lastOpen = new Date(lastOpenRaw);
            const now = new Date();
            const daysSince = Math.floor((now.getTime() - lastOpen.getTime()) / 86400000);
            if (daysSince >= 1) {
              Analytics.track('App Returned', {
                days_inactive: daysSince,
                previous_streak: streak,
                notification_driven: false,
              });
            }
          }
        } catch { /* use default streak of 0 */ }

        // Hydrate analytics context
        Analytics.setStreakDays(streak);
        await Analytics.hydrateCrewCount();

        await NotificationService.touchLastAppOpen();
        await AsyncStorage.setItem(LAST_OPEN_KEY, new Date().toISOString());
        await CrewService.syncHasActiveCrewFlag();
        await NotificationService.scheduleAllDailyNotifications(streak);
      } catch (e: any) {
        console.warn('[App] boot() failed, continuing anyway:', e);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    boot();

    const timeout = setTimeout(() => {
      if (!cancelled) setAuthReady(true);
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && authReady) {
      await SplashScreen.hideAsync();

      if (Platform.OS === 'ios' && !attRequested.current) {
        attRequested.current = true;
        try {
          await requestTrackingPermissionsAsync();
          // Re-collect identifiers now that IDFA may be available
          try { Purchases.collectDeviceIdentifiers(); } catch {}
        } catch {
          // ATT not available (e.g. simulator) — continue
        }
      }

      AppsFlyerService.startSdk();
      Analytics.trackAF('af_login', {});
      Analytics.track('App Opened', { cold_start: true });
    }
  }, [fontsLoaded, authReady]);

  // Track foreground resumes as warm App Opened events
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        Analytics.track('App Opened', { cold_start: false });
        void NotificationService.touchLastAppOpen();
        void AsyncStorage.setItem(LAST_OPEN_KEY, new Date().toISOString());
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationPayload | undefined;
      Analytics.track('Notification Tapped', {
        notification_type: data?.screen ?? 'unknown',
      });
      if (!data || typeof data !== 'object' || !data.screen) return;
      const go = () => {
        if (!rootNavigationRef.isReady()) return;
        try {
          if (data.screen === 'Home') {
            rootNavigationRef.navigate('Main', {
              screen: 'Tabs',
              params: { screen: 'HomeTab' },
            });
          } else if (data.screen === 'CrewList') {
            rootNavigationRef.navigate('Main', {
              screen: 'Tabs',
              params: { screen: 'BoardTab' },
            });
          } else if (data.screen === 'CrewDetail' && typeof data.crew_id === 'string') {
            rootNavigationRef.navigate('Main', {
              screen: 'CrewDetail',
              params: { crew_id: data.crew_id },
            });
          }
        } catch (e) {
          console.warn('[App] notification navigation failed:', e);
        }
      };
      requestAnimationFrame(go);
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded || !authReady) {
    return null;
  }

  return (
    <View style={styles.root} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <AuthProvider>
          <OnboardingProvider>
            <SubscriptionProvider>
              <SessionProvider>
                <MissionsBridge>
                  <NavigationContainer ref={rootNavigationRef}>
                    <StatusBar style="light" />
                    <RootNavigator />
                  </NavigationContainer>
                </MissionsBridge>
              </SessionProvider>
            </SubscriptionProvider>
          </OnboardingProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});

export default App;
