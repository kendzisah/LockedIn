import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
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

// #region agent log — production boot diagnostics (remove after debugging)
const _bootLog: string[] = [];
const _bl = (msg: string) => { _bootLog.push(`${Date.now()}: ${msg}`); };
_bl('module loaded');
// #endregion

const App: React.FC = () => {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    InterTight_800ExtraBold,
  });

  const [authReady, setAuthReady] = useState(false);
  // #region agent log
  const [bootStatus, setBootStatus] = useState('starting...');
  const bootError = useRef<string | null>(null);
  // #endregion

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        // #region agent log
        _bl('boot: audio.configure start');
        setBootStatus('configuring audio...');
        // #endregion
        await AudioService.configure();

        // #region agent log
        _bl('boot: supabase.init start');
        setBootStatus('connecting to server...');
        // #endregion
        await SupabaseService.initialize();

        // #region agent log
        _bl('boot: paywall.init start');
        setBootStatus('initializing payments...');
        // #endregion
        await PaywallService.initialize();

        // #region agent log
        _bl('boot: all done');
        // #endregion
      } catch (e: any) {
        // #region agent log
        _bl(`boot: FAILED — ${e?.message}`);
        bootError.current = e?.message ?? 'unknown error';
        // #endregion
        console.warn('[App] boot() failed, continuing anyway:', e);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    boot();

    const timeout = setTimeout(() => {
      // #region agent log
      _bl('boot: TIMEOUT fired (8s)');
      bootError.current = bootError.current ?? 'timeout';
      // #endregion
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
    }
  }, [fontsLoaded, authReady]);

  // #region agent log — visible boot status (remove after debugging)
  if (!fontsLoaded || !authReady) {
    return (
      <View style={debugStyles.container} onLayout={() => SplashScreen.hideAsync()}>
        <Text style={debugStyles.title}>LockedIn Boot</Text>
        <Text style={debugStyles.status}>{bootStatus}</Text>
        <Text style={debugStyles.detail}>fonts: {fontsLoaded ? 'OK' : 'loading...'}</Text>
        <Text style={debugStyles.detail}>auth: {authReady ? 'OK' : 'loading...'}</Text>
        {bootError.current && (
          <Text style={debugStyles.error}>Error: {bootError.current}</Text>
        )}
        <Text style={debugStyles.log}>{_bootLog.join('\n')}</Text>
      </View>
    );
  }
  // #endregion

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

// #region agent log — debug styles (remove after debugging)
const debugStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1116', justifyContent: 'center', padding: 32 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  status: { color: '#8B949E', fontSize: 16, marginBottom: 12 },
  detail: { color: '#8B949E', fontSize: 14, marginBottom: 4 },
  error: { color: '#F85149', fontSize: 14, marginTop: 12, fontWeight: '600' },
  log: { color: '#484F58', fontSize: 11, marginTop: 16, lineHeight: 16 },
});
// #endregion

export default App;
