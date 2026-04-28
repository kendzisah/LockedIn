/**
 * HUDOptionCard — Shared option-card primitive for onboarding quizzes.
 * Sharp corners, 2px left-border accent. Idle is muted; selected lights
 * the left border + label glow in the accent color.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

interface HUDOptionCardProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Optional content rendered to the right of the label (stat pills, hints, etc.). */
  trailing?: React.ReactNode;
  /** Optional content rendered below the label (description, sub-copy). */
  body?: React.ReactNode;
  /** Override the active accent color. Defaults to the system primary. */
  accentColor?: string;
  /** Optional leading content (icon, emoji block) rendered before the label. */
  leading?: React.ReactNode;
  style?: ViewStyle;
}

const HUDOptionCard: React.FC<HUDOptionCardProps> = ({
  label,
  selected = false,
  disabled = false,
  onPress,
  trailing,
  body,
  accentColor = SystemTokens.glowAccent,
  leading,
  style,
}) => {
  const borderColor = selected ? accentColor : 'rgba(255,255,255,0.06)';
  const background = selected ? `${accentColor}24` : 'rgba(255,255,255,0.02)';
  const labelColor = selected ? SystemTokens.textPrimary : SystemTokens.textPrimary;
  const glowStyle = selected
    ? {
        textShadowColor: accentColor,
        textShadowRadius: 8,
        textShadowOffset: { width: 0, height: 0 },
      }
    : null;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { borderLeftColor: borderColor, backgroundColor: background },
        disabled && styles.rowDisabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      {leading ? <View style={styles.leadingSlot}>{leading}</View> : null}
      <View style={styles.labelSlot}>
        <Text
          style={[
            styles.label,
            { color: labelColor },
            glowStyle as object,
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {body ? <View style={styles.body}>{body}</View> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderLeftWidth: 2,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  leadingSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelSlot: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  body: {
    marginTop: 4,
  },
  trailing: {
    flexShrink: 0,
  },
});

export default React.memo(HUDOptionCard);
