import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import PrimaryButton from '../../../design/components/PrimaryButton';
import { Colors } from '../../../design/colors';
import { Typography } from '../../../design/typography';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'PaywallPlaceholder'
>;

const PaywallPlaceholderScreen: React.FC<Props> = () => {
  const { dispatch } = useOnboarding();

  const handleContinue = () => {
    // Just flip the flag — RootNavigator conditionally renders Main vs Onboarding,
    // so the screen swap happens automatically via React re-render.
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  };

  return (
    <ScreenContainer>
      <View style={styles.body}>
        <Text style={styles.title}>Unlock Full{'\n'}Lock In System</Text>
        <Text style={styles.subtext}>
          Paywall will be implemented with Superwall in the next phase.
        </Text>
      </View>
      <View style={styles.buttonWrap}>
        <PrimaryButton title="Continue (Dev)" onPress={handleContinue} />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...Typography.hero,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  subtext: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  buttonWrap: {
    paddingBottom: 24,
  },
});

export default PaywallPlaceholderScreen;
