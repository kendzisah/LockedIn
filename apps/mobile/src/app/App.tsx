import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, View, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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
import RootNavigator from '../navigation/RootNavigator';
import { Colors } from '../design/colors';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseService } from '../services/SupabaseService';
import { AudioService } from '../services/AudioService';
import { NotificationService } from '../services/NotificationService';
import { AppsFlyerService } from '../services/AppsFlyerService';
import { MixpanelService } from '../services/MixpanelService';
import Purchases from 'react-native-purchases';
import { ENV } from '../config/env';

// Keep splash screen visible while fonts + auth load
SplashScreen.preventAutoHideAsync();

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
        await AudioService.configure();
        await SupabaseService.initialize();
        let streak = 0;
        try {
          const raw = await AsyncStorage.getItem('@lockedin/session_state');
          if (raw) {
            const parsed = JSON.parse(raw);
            streak = parsed.consecutiveStreak ?? 0;
          }
        } catch { /* use default streak of 0 */ }
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
      AppsFlyerService.logEvent('af_login', {});
      MixpanelService.track('App Opened', { cold_start: true });
    }
  }, [fontsLoaded, authReady]);

  // Track foreground resumes as warm App Opened events
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        MixpanelService.track('App Opened', { cold_start: false });
      }
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
                <MissionsProvider>
                  <NavigationContainer>
                    <StatusBar style="light" />
                    <RootNavigator />
                  </NavigationContainer>
                </MissionsProvider>
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
