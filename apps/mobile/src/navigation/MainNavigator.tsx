import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import TabNavigator from './TabNavigator';
import PaywallOfferScreen from '../features/subscription/PaywallOfferScreen';
import ExecutionBlockScreen from '../features/home/ExecutionBlockScreen';
import SessionCompleteScreen from '../features/home/SessionCompleteScreen';
import SignUpScreen from '../features/auth/screens/SignUpScreen';
import SignInScreen from '../features/auth/screens/SignInScreen';
import EditProfileScreen from '../features/auth/screens/EditProfileScreen';
import WeeklyReportScreen from '../features/report/screens/WeeklyReportScreen';
import CrewDetailScreen from '../features/leaderboard/screens/CrewDetailScreen';
import CreateCrewScreen from '../features/leaderboard/screens/CreateCrewScreen';
import JoinCrewScreen from '../features/leaderboard/screens/JoinCrewScreen';
import ScrollPicker from '../features/home/components/ScrollPicker';
import type { MainStackParamList } from '../types/navigation';
import { rootNavigationRef } from './rootNavigationRef';
import { Colors } from '../design/colors';
import { FontFamily } from '../design/typography';
import { useSubscription } from '../features/subscription/SubscriptionProvider';
import { Analytics } from '../services/AnalyticsService';
import { LockModeService } from '../services/LockModeService';

const Stack = createNativeStackNavigator<MainStackParamList>();

import { LockInContext } from './LockInContext';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;
const HOURS_VALUES = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_VALUES = Array.from({ length: 60 }, (_, i) => i);
const padTwo = (n: number) => n.toString().padStart(2, '0');

const MainNavigator: React.FC = () => {
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(30);

  const handleLockInPress = useCallback(() => {
    setShowDurationPicker(true);
  }, []);

  return (
    <LockInContext.Provider value={handleLockInPress}>
      <View style={{ flex: 1 }}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            contentStyle: { backgroundColor: Colors.lockInBackground },
          }}
        >
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen
            name="PaywallOffer"
            component={PaywallOfferScreen}
            options={{ animation: 'fade' }}
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
            name="EditProfile"
            component={EditProfileScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="WeeklyReport"
            component={WeeklyReportScreen}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen
            name="CrewDetail"
            component={CrewDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CreateCrew"
            component={CreateCrewScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="JoinCrew"
            component={JoinCrewScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>

        <DurationPickerModal
          visible={showDurationPicker}
          showCustomTime={showCustomTime}
          customHours={customHours}
          customMinutes={customMinutes}
          onCustomHoursChange={setCustomHours}
          onCustomMinutesChange={setCustomMinutes}
          onShowCustomTime={() => setShowCustomTime(true)}
          onHideCustomTime={() => setShowCustomTime(false)}
          onClose={() => { setShowCustomTime(false); setShowDurationPicker(false); }}
        />
      </View>
    </LockInContext.Provider>
  );
};

interface DurationPickerModalProps {
  visible: boolean;
  showCustomTime: boolean;
  customHours: number;
  customMinutes: number;
  onCustomHoursChange: (h: number) => void;
  onCustomMinutesChange: (m: number) => void;
  onShowCustomTime: () => void;
  onHideCustomTime: () => void;
  onClose: () => void;
}

const DurationPickerModal: React.FC<DurationPickerModalProps> = ({
  visible,
  showCustomTime,
  customHours,
  customMinutes,
  onCustomHoursChange,
  onCustomMinutesChange,
  onShowCustomTime,
  onHideCustomTime,
  onClose,
}) => {
  const { isSubscribed } = useSubscription();
  const [pressedOption, setPressedOption] = useState<number | null>(null);

  const handleSelect = useCallback((minutes: number) => {
    if (!rootNavigationRef.isReady()) return;
    // Modal is mounted outside the inner stack; use container ref + nested Main routes
    // (same pattern as App.tsx notification deep links).
    if (!isSubscribed) {
      rootNavigationRef.navigate('Main', { screen: 'PaywallOffer' });
      onClose();
      return;
    }
    Analytics.track('Lock In Started', { duration_minutes: minutes });
    LockModeService.beginSession();
    rootNavigationRef.navigate('Main', {
      screen: 'ExecutionBlock',
      params: { durationMinutes: minutes },
    });
    onClose();
  }, [isSubscribed, onClose]);

  const formatDuration = (mins: number): { value: string; label: string } =>
    mins >= 60
      ? { value: `${mins / 60}`, label: 'hour' + (mins > 60 ? 's' : '') }
      : { value: `${mins}`, label: 'min' };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={dp.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={dp.card}>
          {/* Hero icon */}
          <View style={dp.heroIcon}>
            <Ionicons name="lock-closed" size={24} color={Colors.primary} />
          </View>

          <Text style={dp.title}>Lock In</Text>
          <Text style={dp.subtitle}>Choose your focus duration</Text>

          {!showCustomTime ? (
            <>
              {/* Duration grid */}
              <View style={dp.grid}>
                {DURATION_OPTIONS.map((mins) => {
                  const isPressed = pressedOption === mins;
                  const dur = formatDuration(mins);
                  return (
                    <TouchableOpacity
                      key={mins}
                      style={[dp.option, isPressed && dp.optionActive]}
                      onPress={() => handleSelect(mins)}
                      onPressIn={() => setPressedOption(mins)}
                      onPressOut={() => setPressedOption(null)}
                      activeOpacity={0.9}
                    >
                      {isPressed && (
                        <View style={dp.optionGlow} />
                      )}
                      <Text style={[dp.optionValue, isPressed && dp.optionValueActive]}>
                        {dur.value}
                      </Text>
                      <Text style={[dp.optionLabel, isPressed && dp.optionLabelActive]}>
                        {dur.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom button */}
              <TouchableOpacity style={dp.customBtn} onPress={onShowCustomTime} activeOpacity={0.8}>
                <Ionicons name="timer-outline" size={16} color={Colors.accent} />
                <Text style={dp.customBtnText}>Custom Duration</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </TouchableOpacity>

              {/* Divider */}
              <View style={dp.divider} />

              {/* Cancel */}
              <TouchableOpacity onPress={onClose} style={dp.cancelBtn} activeOpacity={0.8}>
                <Text style={dp.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={dp.customContainer}>
              {/* Picker card */}
              <View style={dp.pickerCard}>
                <View style={dp.customPickerRow}>
                  <ScrollPicker
                    values={HOURS_VALUES}
                    selectedValue={customHours}
                    onValueChange={onCustomHoursChange}
                    formatValue={padTwo}
                    label="Hours"
                    style={dp.customColumn}
                  />
                  <View style={dp.separatorWrap}>
                    <View style={dp.separatorDot} />
                    <View style={dp.separatorDot} />
                  </View>
                  <ScrollPicker
                    values={MINUTES_VALUES}
                    selectedValue={customMinutes}
                    onValueChange={onCustomMinutesChange}
                    formatValue={padTwo}
                    label="Minutes"
                    style={dp.customColumn}
                  />
                </View>

                {/* Summary */}
                <View style={dp.summaryRow}>
                  <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                  <Text style={dp.summaryText}>
                    {customHours > 0 || customMinutes > 0
                      ? `${customHours > 0 ? `${customHours}h ` : ''}${customMinutes > 0 ? `${customMinutes}m` : ''}`.trim()
                      : 'Select a duration'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[dp.startBtn, (customHours === 0 && customMinutes === 0) && dp.startBtnDisabled]}
                onPress={() => {
                  const total = customHours * 60 + customMinutes;
                  if (total > 0) handleSelect(total);
                }}
                activeOpacity={0.85}
                disabled={customHours === 0 && customMinutes === 0}
              >
                <View style={dp.startBtnInner}>
                  <Ionicons name="lock-closed" size={16} color={Colors.primary} />
                  <Text style={dp.startBtnText}>
                    Start {customHours > 0 ? `${customHours}h ` : ''}{customMinutes > 0 ? `${customMinutes}m` : ''} Block
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={onHideCustomTime} style={dp.backBtn} activeOpacity={0.8}>
                <Ionicons name="chevron-back" size={14} color={Colors.textMuted} />
                <Text style={dp.backBtnText}>Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const dp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(18,22,28,0.97)',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    zIndex: 1,
    elevation: 8,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(58,102,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 16,
  },
  option: {
    width: 88,
    height: 76,
    backgroundColor: 'rgba(44,52,64,0.3)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  optionActive: {
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderColor: 'rgba(58,102,255,0.3)',
  },
  optionGlow: {
    position: 'absolute',
    top: -20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(58,102,255,0.15)',
  },
  optionValue: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    color: Colors.textPrimary,
  },
  optionValueActive: {
    color: Colors.primary,
  },
  optionLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  optionLabelActive: {
    color: 'rgba(58,102,255,0.7)',
  },

  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(44,52,64,0.25)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 18,
  },
  customBtnText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.accent,
    flex: 1,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 14,
  },

  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },

  customContainer: {
    alignItems: 'center',
  },
  pickerCard: {
    width: '100%',
    backgroundColor: 'rgba(44,52,64,0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    paddingTop: 4,
    paddingBottom: 14,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  customPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customColumn: {
    width: 100,
  },
  separatorWrap: {
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    marginHorizontal: 4,
  },
  separatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.textMuted,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: 8,
  },
  summaryText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.textMuted,
  },

  startBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: 'rgba(58,102,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.2)',
  },
  startBtnDisabled: {
    opacity: 0.3,
    backgroundColor: 'rgba(44,52,64,0.3)',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  startBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  startBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.primary,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  backBtnText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
});

export default MainNavigator;
