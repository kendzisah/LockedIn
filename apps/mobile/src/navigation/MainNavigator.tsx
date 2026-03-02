import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../features/home/HomeScreen';
import SessionScreen from '../features/home/SessionScreen';
import ExecutionBlockScreen from '../features/home/ExecutionBlockScreen';
import SessionCompleteScreen from '../features/home/SessionCompleteScreen';
import ProgramCompleteScreen from '../features/home/ProgramCompleteScreen';
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
    </Stack.Navigator>
  );
};

export default MainNavigator;
