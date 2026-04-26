import React, { useContext } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import type { TabParamList } from '../types/navigation';
import HomeTab from '../features/home/screens/HomeTab';
import MissionsTab from '../features/missions/screens/MissionsTab';
import BoardTab from '../features/leaderboard/screens/BoardTab';
import ProfileTab from '../features/auth/screens/ProfileTab';
import { LockInContext } from './LockInContext';
import { Colors } from '../design/colors';
import { FontFamily } from '../design/typography';

const Tab = createBottomTabNavigator<TabParamList>();

const EmptyScreen = () => null;

interface LockInButtonProps {
  onPress: () => void;
}

const LockInButton: React.FC<LockInButtonProps> = ({ onPress }) => {
  const lottieRef = React.useRef<LottieView>(null);

  const handlePress = () => {
    lottieRef.current?.play();
    onPress();
  };

  return (
    <TouchableOpacity style={styles.lockInButton} onPress={handlePress} activeOpacity={0.85}>
      <View style={styles.lockInOuter}>
        <View style={styles.lockInInner}>
          <LottieView
            ref={lottieRef}
            source={require('../../assets/lottie/lock_close.json')}
            autoPlay={false}
            loop={false}
            style={styles.lockLottie}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const TabNavigator: React.FC = () => {
  const onLockIn = useContext(LockInContext);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#4A5568',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeTab}
        options={{
          tabBarLabel: 'HOME',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MissionsTab"
        component={MissionsTab}
        options={{
          tabBarLabel: 'MISSIONS',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="LockInTab"
        component={EmptyScreen}
        options={{
          tabBarLabel: () => null,
          tabBarButton: () => (
            <LockInButton onPress={onLockIn} />
          ),
        }}
      />
      <Tab.Screen
        name="BoardTab"
        component={BoardTab}
        options={{
          tabBarLabel: 'GUILD',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileTab}
        options={{
          tabBarLabel: 'PROFILE',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: 'rgba(14,17,22,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(58,102,255,0.08)',
    height: Platform.OS === 'ios' ? 88 : 70,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    elevation: 0,
  },
  tabLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  lockInButton: {
    top: -18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockInOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(58,102,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.3)',
  },
  lockInInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  lockLottie: {
    width: 32,
    height: 32,
  },
});

export default TabNavigator;
