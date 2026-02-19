import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import ScreenContainer from '../../../design/components/ScreenContainer';
import PrimaryButton from '../../../design/components/PrimaryButton';
import { Colors } from '../../../design/colors';
import { Typography } from '../../../design/typography';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'IdentityReinforcement'
>;

const IdentityReinforcementScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <ScreenContainer>
      <View style={styles.body}>
        <Text style={styles.title}>Discipline is repetition.</Text>
        <Text style={styles.subtext}>
          One session doesn't change you.{'\n'}
          Daily sessions do.{'\n\n'}
          You've started.{'\n'}
          Now commit.
        </Text>
      </View>
      <View style={styles.buttonWrap}>
        <PrimaryButton
          title="Unlock Full Lock In System"
          onPress={() => navigation.navigate('PaywallPlaceholder')}
        />
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
    marginBottom: 24,
  },
  subtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 28,
  },
  buttonWrap: {
    paddingBottom: 24,
  },
});

export default IdentityReinforcementScreen;
