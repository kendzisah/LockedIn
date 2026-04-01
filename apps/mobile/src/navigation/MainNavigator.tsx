import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../features/home/HomeScreen';
import PaywallOfferScreen from '../features/subscription/PaywallOfferScreen';
import SessionScreen from '../features/home/SessionScreen';
import ExecutionBlockScreen from '../features/home/ExecutionBlockScreen';
import SessionCompleteScreen from '../features/home/SessionCompleteScreen';
import ProgramCompleteScreen from '../features/home/ProgramCompleteScreen';
import SignUpScreen from '../features/auth/screens/SignUpScreen';
import SignInScreen from '../features/auth/screens/SignInScreen';
import ProfileScreen from '../features/auth/screens/ProfileScreen';
import WeeklyReportScreen from '../features/report/screens/WeeklyReportScreen';
import LeaderboardScreen from '../features/leaderboard/screens/LeaderboardScreen';
import type { MainStackParamList } from '../types/navigation';
import { Colors } from '../design/colors';

const Stack = createNativeStackNavigator<MainStackParamList>();

const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: Colors.lockInBackground },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen
        name="PaywallOffer"
        component={PaywallOfferScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="Session"
        component={SessionScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="ExecutionBlock"
        component={ExecutionBlockScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="SessionComplete"
        component={SessionCompleteScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="ProgramComplete"
        component={ProgramCompleteScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="WeeklyReport"
        component={WeeklyReportScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ animation: 'fade' }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;
