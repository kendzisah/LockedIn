import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { FontFamily } from '../typography';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  /** Ghost (outline) variant — used for "back" / "skip" / "maybe later" actions. */
  secondary?: boolean;
}

const HUD_PRIMARY = '#3A66FF';
const HUD_BG = 'rgba(58,102,255,0.18)';
const HUD_BORDER = 'rgba(58,102,255,0.45)';

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  disabled = false,
  style,
  secondary = false,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text
        style={[
          styles.text,
          secondary && styles.secondaryText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: HUD_BG,
    borderWidth: 1,
    borderColor: HUD_BORDER,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.35,
  },
  text: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 1.6,
    color: HUD_PRIMARY,
  },
  secondaryText: {
    color: '#9CA3AF',
    letterSpacing: 1.2,
  },
});

export default PrimaryButton;
