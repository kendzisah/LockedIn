/**
 * HUDPanel — The shared shell for every system surface. Provides the
 * panel chrome (bg + border + corner brackets) and an optional
 * `// HEADER` row with a gradient rule. Children render below the
 * header at full panel width.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import HUDCornerBrackets from './HUDCornerBrackets';
import { SectionLabelStyle, SystemTokens } from '../systemTokens';

interface HUDPanelProps {
  headerLabel?: string;
  headerRight?: React.ReactNode;
  accentColor?: string;
  /** Enables the slow corner-bracket opacity pulse when true. */
  idle?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const HUDPanel: React.FC<HUDPanelProps> = ({
  headerLabel,
  headerRight,
  accentColor,
  idle = true,
  onPress,
  style,
  contentStyle,
  children,
}) => {
  const bracketOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!idle) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bracketOpacity, {
          toValue: 0.4,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bracketOpacity, {
          toValue: 0.6,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [idle, bracketOpacity]);

  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { activeOpacity: 0.85, onPress } : {};

  return (
    <Container
      {...containerProps}
      style={[styles.panel, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: bracketOpacity }]} pointerEvents="none">
        <HUDCornerBrackets color={accentColor ?? SystemTokens.bracketColor} />
      </Animated.View>

      {headerLabel && (
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerLabel}>// {headerLabel}</Text>
            {headerRight && (
              typeof headerRight === 'string' ? (
                <Text style={styles.headerRight}>{headerRight}</Text>
              ) : (
                <View>{headerRight}</View>
              )
            )}
          </View>
          <LinearGradient
            colors={[
              accentColor ?? SystemTokens.bracketColor,
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerRule}
          />
        </View>
      )}

      <View style={[styles.content, contentStyle]}>{children}</View>
    </Container>
  );
};

const styles = StyleSheet.create({
  panel: {
    backgroundColor: SystemTokens.panelBg,
    borderWidth: 1,
    borderColor: SystemTokens.panelBorder,
    borderRadius: SystemTokens.panelRadius,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  header: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLabel: {
    ...SectionLabelStyle,
  },
  headerRight: {
    fontFamily: SectionLabelStyle.fontFamily,
    fontSize: 11,
    letterSpacing: 1.2,
    color: SystemTokens.textMuted,
  },
  headerRule: {
    height: 1,
    width: '100%',
  },
  content: {},
});

export default HUDPanel;
