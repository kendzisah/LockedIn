/**
 * HUDSectionLabel — Floating `// LABEL` header with a gradient rule below.
 * Used on quiz/narrative screens where the label sits above the content
 * (not inside an HUDPanel). For panel-wrapped content use HUDPanel's
 * `headerLabel` prop instead.
 */

import React from 'react';
import { StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SectionLabelStyle, SystemTokens } from '../../home/systemTokens';

interface HUDSectionLabelProps {
  label: string;
  /** Override the bracket / divider color (e.g. red on the alert screen). */
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

const HUDSectionLabel: React.FC<HUDSectionLabelProps> = ({
  label,
  accentColor,
  style,
}) => {
  const color = accentColor ?? SystemTokens.glowAccent;
  return (
    <View style={[styles.wrap, style]}>
      <Text style={[SectionLabelStyle, { color }]}>// {label}</Text>
      <LinearGradient
        colors={[color, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.rule}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  rule: {
    height: 1,
    width: '100%',
    marginTop: 6,
  },
});

export default React.memo(HUDSectionLabel);
