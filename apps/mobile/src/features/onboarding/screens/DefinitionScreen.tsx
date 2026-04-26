import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import ScreenContainer from '../../../design/components/ScreenContainer';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Definition'>;

const DefinitionScreen: React.FC<Props> = ({ navigation }) => {
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordTranslateY = useRef(new Animated.Value(12)).current;
  const phoneticOpacity = useRef(new Animated.Value(0)).current;
  const dividerOpacity = useRef(new Animated.Value(0)).current;
  const dividerScale = useRef(new Animated.Value(0)).current;
  const posOpacity = useRef(new Animated.Value(0)).current;
  const defOpacity = useRef(new Animated.Value(0)).current;
  const defTranslateY = useRef(new Animated.Value(10)).current;
  const tapOpacity = useRef(new Animated.Value(0)).current;

  useOnboardingTracking('Definition');

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(wordTranslateY, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      Animated.timing(phoneticOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(dividerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dividerScale, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(posOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(defOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(defTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.timing(tapOpacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
    ]);
    seq.start();
  }, [wordOpacity, wordTranslateY, phoneticOpacity, dividerOpacity, dividerScale, posOpacity, defOpacity, defTranslateY, tapOpacity]);

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('PhoneTimeQuiz');
    });
  };

  const handleSignIn = () => {
    Haptics.selectionAsync();
    navigation.navigate('OnboardingAuth', { mode: 'signin' });
  };

  return (
    <View style={styles.root}>
      <TouchableWithoutFeedback onPress={handleTap}>
        <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
          <ScreenContainer>
            <View style={styles.content}>
              {/* Word */}
              <Animated.Text
                style={[
                  styles.word,
                  { opacity: wordOpacity, transform: [{ translateY: wordTranslateY }] },
                ]}
              >
                locked in
              </Animated.Text>

              {/* Phonetic */}
              <Animated.Text style={[styles.phonetic, { opacity: phoneticOpacity }]}>
                /lɒkt ɪn/
              </Animated.Text>

              {/* Divider */}
              <Animated.View
                style={[
                  styles.divider,
                  { opacity: dividerOpacity, transform: [{ scaleX: dividerScale }] },
                ]}
              />

              {/* Part of speech */}
              <Animated.Text style={[styles.partOfSpeech, { opacity: posOpacity }]}>
                adjective
              </Animated.Text>

              {/* Definition */}
              <Animated.View
                style={{ opacity: defOpacity, transform: [{ translateY: defTranslateY }] }}
              >
                <Text style={styles.defNumber}>1.</Text>
                <Text style={styles.definition}>
                  To be in a state of intense focus, maximum concentration, or deep commitment to a task, often by eliminating distractions.
                </Text>
              </Animated.View>

              {/* Tap prompt */}
              <Animated.Text style={[styles.tapHint, { opacity: tapOpacity }]}>
                Tap to continue
              </Animated.Text>
            </View>
          </ScreenContainer>
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* Sign-in escape hatch — absolutely positioned so the parent
          tap-to-continue handler doesn't fire when this is pressed. */}
      <SafeAreaView
        style={styles.signInBar}
        edges={['top']}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={handleSignIn}
          style={styles.signInBtn}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Text style={styles.signInText}>Sign in</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  word: {
    fontFamily: FontFamily.headingBold,
    fontSize: 42,
    color: Colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 48,
  },
  phonetic: {
    fontFamily: FontFamily.body,
    fontSize: 18,
    color: Colors.textMuted,
    marginTop: 8,
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 24,
  },
  partOfSpeech: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: Colors.accent,
    fontStyle: 'italic',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  defNumber: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 15,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  definition: {
    fontFamily: FontFamily.body,
    fontSize: 19,
    color: Colors.textSecondary,
    lineHeight: 30,
    letterSpacing: 0.1,
  },
  tapHint: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
  },
  signInBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  signInBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  signInText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 0.2,
  },
});

export default DefinitionScreen;
