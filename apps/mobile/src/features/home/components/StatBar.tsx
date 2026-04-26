/**
 * StatBar — One labeled progress row used across the HUD: a 3-letter
 * label (or custom label), an animated track-fill bar with a brighter
 * 2px leading-edge tip, and a numeric value at the right.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../systemTokens';

interface StatBarProps {
  label: string;
  value: number | string;
  /** Fill percentage 0-100. Required when `valueRange` not provided. */
  pct?: number;
  /** Convenience: derive pct from current/max if pct not provided. */
  current?: number;
  max?: number;
  color: string;
  /** Animation start delay (ms) for staggered mounts. */
  delay?: number;
  labelWidth?: number;
  valueWidth?: number;
  /** Hide the right-side numeric value column entirely. */
  hideValue?: boolean;
  /** Override the row height. Default 18. */
  height?: number;
}

const StatBar: React.FC<StatBarProps> = ({
  label,
  value,
  pct,
  current,
  max,
  color,
  delay = 0,
  labelWidth = 32,
  valueWidth = 28,
  hideValue = false,
  height = 18,
}) => {
  const targetPct = pct != null
    ? pct
    : current != null && max != null && max > 0
      ? Math.min(100, Math.max(0, (current / max) * 100))
      : 0;

  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: targetPct,
      duration: 600,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [targetPct, delay, fill]);

  const widthInterpolation = fill.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.row, { height }]}>
      <Text
        style={[
          styles.label,
          { color, width: labelWidth },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { width: widthInterpolation, backgroundColor: color },
          ]}
        >
          <View
            style={[
              styles.tip,
              { backgroundColor: color, shadowColor: color },
            ]}
          />
        </Animated.View>
      </View>
      {!hideValue && (
        <Text
          style={[styles.value, { width: valueWidth }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: FontFamily.headingBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  track: {
    flex: 1,
    height: 5,
    backgroundColor: SystemTokens.barTrack,
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  tip: {
    width: 2,
    height: '100%',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    opacity: 0.95,
  },
  value: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    color: SystemTokens.textPrimary,
    letterSpacing: 0.3,
    textAlign: 'right',
  },
});

export default React.memo(StatBar);
