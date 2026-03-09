import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types/navigation';
import { Colors } from '../design/colors';

// Screens
import ConfrontTruthScreen from '../features/onboarding/screens/ConfrontTruthScreen';
import SurfacePainScreen from '../features/onboarding/screens/SurfacePainScreen';
import PhoneUsageRealityScreen from '../features/onboarding/screens/PhoneUsageRealityScreen';
import TimeDedicationScreen from '../features/onboarding/screens/TimeDedicationScreen';
import MechanismIntroScreen from '../features/onboarding/screens/MechanismIntroScreen';
import HabitFormationScreen from '../features/onboarding/screens/HabitFormationScreen';
import DisciplineVisionScreen from '../features/onboarding/screens/DisciplineVisionScreen';
import ProjectionScreen from '../features/onboarding/screens/ProjectionScreen';
import ScreenTimePermissionScreen from '../features/onboarding/screens/ScreenTimePermissionScreen';
import NotificationPermissionScreen from '../features/onboarding/screens/NotificationPermissionScreen';
import QuickLockInIntroScreen from '../features/onboarding/screens/QuickLockInIntroScreen';
import QuickLockInSessionScreen from '../features/onboarding/screens/QuickLockInSessionScreen';
import QuickLockInCompleteScreen from '../features/onboarding/screens/QuickLockInCompleteScreen';
import IdentityReinforcementScreen from '../features/onboarding/screens/IdentityReinforcementScreen';
import SignatureCommitmentScreen from '../features/onboarding/screens/SignatureCommitmentScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="ConfrontTruth"
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: 'fade',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="ConfrontTruth" component={ConfrontTruthScreen} />
      <Stack.Screen
        name="SurfacePain"
        component={SurfacePainScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="PhoneUsageReality"
        component={PhoneUsageRealityScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="TimeDedication"
        component={TimeDedicationScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="HabitFormation"
        component={HabitFormationScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="DisciplineVision"
        component={DisciplineVisionScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="MechanismIntro"
        component={MechanismIntroScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="Projection"
        component={ProjectionScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="ScreenTimePermission"
        component={ScreenTimePermissionScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="NotificationPermission"
        component={NotificationPermissionScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="QuickLockInIntro"
        component={QuickLockInIntroScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="QuickLockInSession"
        component={QuickLockInSessionScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="QuickLockInComplete"
        component={QuickLockInCompleteScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="IdentityReinforcement"
        component={IdentityReinforcementScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="SignatureCommitment"
        component={SignatureCommitmentScreen}
        options={{ animation: 'none' }}
      />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
