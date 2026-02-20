/**
 * AnimatedGradient — Immersive background for the Home screen.
 *
 * Layers (bottom to top):
 *   1. Solid dark base (#0E1116)
 *   2. black_waves.jpg — desaturated, darkened (12 % opacity), blurred (3 px)
 *   3. Dark overlay (75 % base color) — further desaturates & darkens
 *   4. Very subtle animated gradient accent (6 % opacity, slow drift)
 *   5. Four-edge vignette (~12 % darkening at edges)
 *
 * The background should never be noticed consciously.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../../design/colors';

const BG_IMAGE = require('../../../../assets/bg/black_waves.jpg');

const CYCLE_DURATION = 14000; // 14 s full loop

const AnimatedGradient: React.FC = () => {
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shift, {
        toValue: 1,
        duration: CYCLE_DURATION,
        useNativeDriver: true,
      }),
    ).start();
  }, [shift]);

  // Very slow, barely perceptible drift
  const tx = shift.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-50, 50, -50],
  });
  const ty = shift.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [30, -30, 30],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1 — Solid dark base */}
      <View style={[StyleSheet.absoluteFill, styles.base]} />

      {/* 2 — Background image: desaturated + darkened + blurred */}
      <Image
        source={BG_IMAGE}
        style={[StyleSheet.absoluteFill, styles.bgImage]}
        blurRadius={3}
        resizeMode="cover"
      />

      {/* 3 — Dark overlay for further desaturation / darkening */}
      <View style={[StyleSheet.absoluteFill, styles.darkOverlay]} />

      {/* 4 — Very subtle animated gradient accent */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: 0.06,
            transform: [{ translateX: tx }, { translateY: ty }],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', Colors.primary, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* 5a — Vignette: top */}
      <LinearGradient
        colors={['rgba(14,17,22,0.6)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.vignetteTop}
      />

      {/* 5b — Vignette: bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(14,17,22,0.6)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.vignetteBottom}
      />

      {/* 5c — Vignette: left */}
      <LinearGradient
        colors={['rgba(14,17,22,0.45)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.vignetteLeft}
      />

      {/* 5d — Vignette: right */}
      <LinearGradient
        colors={['transparent', 'rgba(14,17,22,0.45)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.vignetteRight}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.background,
  },
  bgImage: {
    opacity: 0.12,
  },
  darkOverlay: {
    backgroundColor: 'rgba(14, 17, 22, 0.75)',
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '28%',
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '28%',
  },
  vignetteLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '15%',
  },
  vignetteRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '15%',
  },
});

export default React.memo(AnimatedGradient);
