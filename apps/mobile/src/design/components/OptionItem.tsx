import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../colors';
import { Typography } from '../typography';

interface OptionItemProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

const OptionItem: React.FC<OptionItemProps> = ({ label, selected, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.selected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
    backgroundColor: Colors.backgroundSecondary,
  },
  selected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  label: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  selectedLabel: {
    color: Colors.textPrimary,
  },
});

export default OptionItem;
