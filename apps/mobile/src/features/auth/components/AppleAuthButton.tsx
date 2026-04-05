import * as AppleAuthentication from 'expo-apple-authentication';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export interface AppleAuthButtonProps {
  onPress: () => void;
  disabled?: boolean;
  buttonType: AppleAuthentication.AppleAuthenticationButtonType;
}

/**
 * Apple-required control for Sign in with Apple (App Store review).
 */
const AppleAuthButton: React.FC<AppleAuthButtonProps> = ({
  onPress,
  disabled = false,
  buttonType,
}) => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <View
      style={[styles.wrap, disabled && styles.dimmed]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={buttonType}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={14}
        style={styles.btn}
        onPress={onPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  dimmed: {
    opacity: 0.45,
  },
  btn: {
    width: '100%',
    height: 48,
  },
});

export default AppleAuthButton;
