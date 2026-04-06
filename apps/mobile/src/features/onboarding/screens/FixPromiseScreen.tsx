import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import ScreenContainer from '../../../design/components/ScreenContainer';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { Analytics } from '../../../services/AnalyticsService';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FixPromise'>;

const FixPromiseScreen: React.FC<Props> = ({ navigation }) => {
  const textOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Analytics.track('Onboarding Screen Viewed', { screen: 'FixPromise', step: 6, total_steps: 18 });

    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const fadeOutTimer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        navigation.navigate('TopPerformersFrame');
      });
    }, 3000);

    return () => clearTimeout(fadeOutTimer);
  }, [textOpacity, screenOpacity, navigation]);

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <ScreenContainer>
        <View style={styles.body}>
          <Animated.Text style={[styles.text, { opacity: textOpacity }]}>
            But that's what we{'\n'}are here to fix.
          </Animated.Text>
        </View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  text: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 40,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});

export default FixPromiseScreen;
