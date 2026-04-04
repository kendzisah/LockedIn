import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

export interface SettingsRowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  label: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  /** Shown to the left of the switch (e.g. system permission state). */
  toggleStatus?: string;
  toggleStatusColor?: string;
  disabled?: boolean;
  showChevron?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  iconColor = Colors.textSecondary,
  label,
  value,
  valueColor = Colors.textSecondary,
  onPress,
  toggle,
  toggleValue,
  onToggleChange,
  toggleStatus,
  toggleStatusColor,
  disabled,
  showChevron,
}) => {
  const chevron = showChevron !== false && !toggle;
  const content = (
    <>
      <View style={styles.iconCol}>
        <MaterialIcons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.label, disabled && styles.disabledText]} numberOfLines={2}>
        {label}
      </Text>
      {toggle ? (
        <View style={styles.toggleRight}>
          {toggleStatus ? (
            <Text
              style={[styles.toggleStatus, { color: toggleStatusColor ?? Colors.textMuted }]}
              numberOfLines={1}
            >
              {toggleStatus}
            </Text>
          ) : null}
          <Switch
            value={toggleValue}
            onValueChange={onToggleChange}
            disabled={disabled}
            trackColor={{ false: Colors.surface, true: Colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      ) : (
        <View style={styles.right}>
          {value ? (
            <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {chevron ? (
            <MaterialIcons name="chevron-right" size={18} color={Colors.textMuted} />
          ) : null}
        </View>
      )}
    </>
  );

  if (toggle || !onPress || disabled) {
    return (
      <View
        style={[styles.row, disabled && styles.rowDisabled]}
        pointerEvents={disabled ? 'none' : 'auto'}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDisabled: {
    opacity: 0.4,
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconCol: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: Colors.textPrimary,
    marginRight: 8,
  },
  disabledText: {
    color: Colors.textMuted,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '42%',
  },
  value: {
    fontFamily: FontFamily.body,
    fontSize: 14,
  },
  toggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '46%',
  },
  toggleStatus: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    flexShrink: 1,
    textAlign: 'right',
  },
});

export default SettingsRow;
