import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import HUDCornerBrackets from '../features/home/components/HUDCornerBrackets';
import { SectionLabelStyle, SystemTokens } from '../features/home/systemTokens';
import TabNavigator from './TabNavigator';
import PaywallOfferScreen from '../features/subscription/PaywallOfferScreen';
import ExecutionBlockScreen from '../features/home/ExecutionBlockScreen';
import SessionCompleteScreen from '../features/home/SessionCompleteScreen';
import SignUpScreen from '../features/auth/screens/SignUpScreen';
import SignInScreen from '../features/auth/screens/SignInScreen';
import EditProfileScreen from '../features/auth/screens/EditProfileScreen';
import WeeklyReportScreen from '../features/report/screens/WeeklyReportScreen';
import GuildDetailScreen from '../features/leaderboard/screens/GuildDetailScreen';
import CreateGuildScreen from '../features/leaderboard/screens/CreateGuildScreen';
import JoinGuildScreen from '../features/leaderboard/screens/JoinGuildScreen';
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
            name="GuildDetail"
            component={GuildDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CreateGuild"
            component={CreateGuildScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="JoinGuild"
            component={JoinGuildScreen}
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
    LockModeService.beginSession(minutes);
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
          <HUDCornerBrackets color={SystemTokens.bracketColor} />

          {/* `// LOCK IN` header strip */}
          <View style={dp.header}>
            <Text style={dp.headerLabel}>// LOCK IN</Text>
            <LinearGradient
              colors={[SystemTokens.bracketColor, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={dp.headerRule}
            />
            <Text style={dp.subtitle}>CHOOSE FOCUS DURATION</Text>
          </View>

          {!showCustomTime ? (
            <>
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
                      <Text style={[dp.optionValue, isPressed && dp.optionValueActive]}>
                        {dur.value}
                      </Text>
                      <Text style={[dp.optionLabel, isPressed && dp.optionLabelActive]}>
                        {dur.label.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={dp.customBtn} onPress={onShowCustomTime} activeOpacity={0.85}>
                <Ionicons name="timer-outline" size={14} color={SystemTokens.cyan} />
                <Text style={dp.customBtnText}>CUSTOM DURATION</Text>
                <Ionicons name="chevron-forward" size={12} color={SystemTokens.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={dp.cancelBtn} activeOpacity={0.8}>
                <Text style={dp.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={dp.customContainer}>
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

                <View style={dp.summaryRow}>
                  <Ionicons name="time-outline" size={12} color={SystemTokens.textMuted} />
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
                <Text style={dp.startBtnText}>
                  ⟐  START {customHours > 0 ? `${customHours}H` : ''}
                  {customMinutes > 0 ? ` ${customMinutes}M` : ''} BLOCK
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onHideCustomTime} style={dp.backBtn} activeOpacity={0.8}>
                <Ionicons name="chevron-back" size={12} color={SystemTokens.textMuted} />
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    backgroundColor: SystemTokens.panelBg,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: SystemTokens.panelBorder,
    overflow: 'hidden',
    zIndex: 1,
    elevation: 8,
  },
  header: {
    marginBottom: 16,
  },
  headerLabel: {
    ...SectionLabelStyle,
    fontSize: 12,
    marginBottom: 6,
  },
  headerRule: {
    height: 1,
    width: '100%',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: SystemTokens.textMuted,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  option: {
    flexBasis: '31.5%',
    height: 72,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  optionActive: {
    backgroundColor: 'rgba(58,102,255,0.14)',
    borderLeftColor: SystemTokens.glowAccent,
  },
  optionValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 26,
    color: SystemTokens.textPrimary,
    letterSpacing: -0.5,
  },
  optionValueActive: {
    color: SystemTokens.glowAccent,
    textShadowColor: SystemTokens.glowAccent,
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
  optionLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: SystemTokens.textMuted,
  },
  optionLabelActive: {
    color: SystemTokens.glowAccent,
  },

  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(0,194,255,0.45)',
    marginBottom: 12,
  },
  customBtnText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: SystemTokens.cyan,
    flex: 1,
  },

  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: SystemTokens.textMuted,
  },

  customContainer: {
    alignItems: 'center',
  },
  pickerCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(58,102,255,0.35)',
    paddingTop: 4,
    paddingBottom: 12,
    paddingHorizontal: 8,
    marginBottom: 14,
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
    width: 4,
    height: 4,
    backgroundColor: SystemTokens.textMuted,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SystemTokens.divider,
    marginHorizontal: 8,
  },
  summaryText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: SystemTokens.textSecondary,
  },

  startBtn: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: 'rgba(58,102,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.45)',
    alignItems: 'center',
    marginBottom: 8,
  },
  startBtnDisabled: {
    opacity: 0.35,
  },
  startBtnText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 1.6,
    color: SystemTokens.glowAccent,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  backBtnText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: SystemTokens.textMuted,
  },
});

export default MainNavigator;
