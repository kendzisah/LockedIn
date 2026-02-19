import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
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

const PaywallPlaceholderScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();

  const handleContinue = () => {
    dispatch({ type: 'COMPLETE_ONBOARDING' });

    const rootNav = navigation.getParent();
    if (rootNav) {
      rootNav.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        }),
      );
    }
  };

  const handleBack = () => {
    navigation.goBack();
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
        <View style={styles.spacer} />
        <PrimaryButton title="Back" onPress={handleBack} secondary />
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
  spacer: {
    height: 12,
  },
});

export default PaywallPlaceholderScreen;
