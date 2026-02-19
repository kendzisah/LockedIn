import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types/navigation';

// Screens — will be created in subsequent steps
import ConfrontTruthScreen from '../features/onboarding/screens/ConfrontTruthScreen';
import SurfacePainScreen from '../features/onboarding/screens/SurfacePainScreen';
import MechanismIntroScreen from '../features/onboarding/screens/MechanismIntroScreen';
import ProjectionScreen from '../features/onboarding/screens/ProjectionScreen';
import ScreenTimePermissionScreen from '../features/onboarding/screens/ScreenTimePermissionScreen';
import NotificationPermissionScreen from '../features/onboarding/screens/NotificationPermissionScreen';
import QuickLockInIntroScreen from '../features/onboarding/screens/QuickLockInIntroScreen';
import QuickLockInSessionScreen from '../features/onboarding/screens/QuickLockInSessionScreen';
import QuickLockInCompleteScreen from '../features/onboarding/screens/QuickLockInCompleteScreen';
import IdentityReinforcementScreen from '../features/onboarding/screens/IdentityReinforcementScreen';
import PaywallPlaceholderScreen from '../features/onboarding/screens/PaywallPlaceholderScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="ConfrontTruth"
      screenOptions={{
        headerShown: false,
        gestureEnabled: false, // Fix 2: disable back swipe globally
        animation: 'fade',
      }}
    >
      <Stack.Screen name="ConfrontTruth" component={ConfrontTruthScreen} />
      <Stack.Screen name="SurfacePain" component={SurfacePainScreen} />
      <Stack.Screen name="MechanismIntro" component={MechanismIntroScreen} />
      <Stack.Screen name="Projection" component={ProjectionScreen} />
      <Stack.Screen name="ScreenTimePermission" component={ScreenTimePermissionScreen} />
      <Stack.Screen name="NotificationPermission" component={NotificationPermissionScreen} />
      <Stack.Screen name="QuickLockInIntro" component={QuickLockInIntroScreen} />
      <Stack.Screen name="QuickLockInSession" component={QuickLockInSessionScreen} />
      <Stack.Screen name="QuickLockInComplete" component={QuickLockInCompleteScreen} />
      <Stack.Screen name="IdentityReinforcement" component={IdentityReinforcementScreen} />
      <Stack.Screen name="PaywallPlaceholder" component={PaywallPlaceholderScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
