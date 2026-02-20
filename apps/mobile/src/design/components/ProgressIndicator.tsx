import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../colors';
import { Typography } from '../typography';

interface ProgressIndicatorProps {
  current: number;
  total: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  current,
  total,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {current}/{total}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  text: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});

export default ProgressIndicator;
