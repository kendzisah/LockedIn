import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { OnboardingProvider } from '../features/onboarding/state/OnboardingProvider';
import { SessionProvider } from '../features/home/state/SessionProvider';
import RootNavigator from '../navigation/RootNavigator';
import { Colors } from '../design/colors';
import { SupabaseService } from '../services/SupabaseService';
import { AudioService } from '../services/AudioService';
import { PaywallService } from '../services/PaywallService';

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

  // Initialize Supabase + Audio on mount
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Initialize audio mode (playsInSilentModeIOS, background policy, etc.)
      await AudioService.configure();

      // Initialize Supabase client + anonymous auth
      // If it fails (e.g., no network), app still works in timer-only mode
      await SupabaseService.initialize();

      // Initialize RevenueCat for paywall / subscription management
      await PaywallService.initialize();

      if (!cancelled) {
        setAuthReady(true);
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && authReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authReady]);

  // Wait for both fonts and auth before rendering
  if (!fontsLoaded || !authReady) {
    return null;
  }

  return (
    <View style={styles.root} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <OnboardingProvider>
          <SessionProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <RootNavigator />
            </NavigationContainer>
          </SessionProvider>
        </OnboardingProvider>
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
