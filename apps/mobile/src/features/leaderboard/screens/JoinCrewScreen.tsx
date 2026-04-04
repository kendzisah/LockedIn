import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../types/navigation';
import { CrewService } from '../CrewService';
import { NotificationService } from '../../../services/NotificationService';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<MainStackParamList, 'JoinCrew'>;

const CODE_LENGTH = 6;
const VALID_CHARS = /^[A-Z2-9]$/;

const JoinCrewScreen: React.FC<Props> = ({ navigation }) => {
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const isFull = chars.every((c) => c.length === 1);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleChange = useCallback(
    (text: string, idx: number) => {
      // Handle paste of full code
      const upper = text.toUpperCase();
      if (upper.length >= CODE_LENGTH) {
        const pasted = upper.slice(0, CODE_LENGTH).split('');
        if (pasted.every((c) => VALID_CHARS.test(c))) {
          setChars(pasted);
          setError(null);
          inputRefs.current[CODE_LENGTH - 1]?.focus();
          return;
        }
      }

      const lastChar = upper.slice(-1);
      if (lastChar && !VALID_CHARS.test(lastChar)) return;

      const next = [...chars];
      next[idx] = lastChar;
      setChars(next);
      setError(null);

      if (lastChar && idx < CODE_LENGTH - 1) {
        inputRefs.current[idx + 1]?.focus();
      }
    },
    [chars],
  );

  const handleKeyPress = useCallback(
    (key: string, idx: number) => {
      if (key === 'Backspace' && chars[idx] === '' && idx > 0) {
        const next = [...chars];
        next[idx - 1] = '';
        setChars(next);
        inputRefs.current[idx - 1]?.focus();
      }
    },
    [chars],
  );

  const handleJoin = useCallback(async () => {
    if (!isFull || loading) return;
    setLoading(true);
    setError(null);

    const code = chars.join('');
    const result = await CrewService.joinCrew(code);
    setLoading(false);

    if (result) {
      setSuccessMsg(`Joined ${result.crew_name}!`);
      void (async () => {
        try {
          const { hadCrewBefore, hasCrewNow } = await CrewService.syncHasActiveCrewFlag();
          if (hasCrewNow && !hadCrewBefore) {
            await NotificationService.scheduleFirstCrewNudgeIfNeeded();
          }
          await NotificationService.refreshScheduleWithStoredStreak();
        } catch {
          /* ignore */
        }
      })();
      setTimeout(() => {
        navigation.replace('CrewDetail', { crew_id: result.crew_id });
      }, 1200);
    } else {
      triggerShake();
      setError('Invalid invite code, crew is full, or you\'ve reached the 5 crew limit.');
    }
  }, [chars, isFull, loading, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join a Crew</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.instruction}>
          Enter the 6-character invite code from your friend.
        </Text>

        <Animated.View
          style={[styles.codeRow, { transform: [{ translateX: shakeAnim }] }]}
        >
          {chars.map((char, idx) => {
            const filled = char.length > 0;
            const focused = focusedIdx === idx;
            return (
              <View
                key={idx}
                style={[
                  styles.charBox,
                  focused && styles.charBoxFocused,
                  filled && styles.charBoxFilled,
                ]}
              >
                <TextInput
                  ref={(r) => { inputRefs.current[idx] = r; }}
                  style={styles.charInput}
                  value={char}
                  onChangeText={(t) => handleChange(t, idx)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
                  onFocus={() => setFocusedIdx(idx)}
                  maxLength={CODE_LENGTH}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  selectTextOnFocus
                  keyboardType="default"
                  textContentType="oneTimeCode"
                />
              </View>
            );
          })}
        </Animated.View>

        <TouchableOpacity
          style={[styles.joinBtn, !isFull && styles.joinBtnDisabled]}
          onPress={handleJoin}
          disabled={!isFull || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textPrimary} size="small" />
          ) : (
            <Text style={styles.joinBtnText}>Join Crew</Text>
          )}
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}

        {successMsg && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
    alignItems: 'center',
  },
  instruction: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  charBox: {
    width: 48,
    height: 56,
    backgroundColor: 'rgba(44,52,64,0.4)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  charBoxFocused: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(58,102,255,0.06)',
  },
  charBoxFilled: {
    borderColor: 'rgba(58,102,255,0.3)',
  },
  charInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontFamily: FontFamily.heading,
    fontSize: 22,
    color: Colors.textPrimary,
  },
  joinBtn: {
    width: '100%',
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.25)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  joinBtnDisabled: {
    opacity: 0.4,
  },
  joinBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.primary,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,214,143,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.15)',
  },
  successText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.success,
  },
});

export default JoinCrewScreen;
