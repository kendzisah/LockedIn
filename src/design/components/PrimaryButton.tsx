import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Colors } from '../colors';
import { Typography } from '../typography';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  /** Use muted/secondary styling */
  secondary?: boolean;
}

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
      activeOpacity={0.8}
      disabled={disabled}
    >
      <Text
        style={[
          styles.text,
          secondary && styles.secondaryText,
          disabled && styles.disabledText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  disabled: {
    backgroundColor: Colors.disabled,
  },
  text: {
    ...Typography.button,
    color: Colors.textPrimary,
  },
  secondaryText: {
    color: Colors.textSecondary,
  },
  disabledText: {
    color: Colors.textMuted,
  },
});

export default PrimaryButton;
