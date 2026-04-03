/**
 * StreakAtRiskBanner — Glassmorphic warning banner with danger glow.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

interface StreakAtRiskBannerProps {
  onPress: () => void;
}

const StreakAtRiskBanner: React.FC<StreakAtRiskBannerProps> = ({ onPress }) => (
  <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.iconWrap}>
      <Ionicons name="warning" size={18} color={Colors.danger} />
    </View>
    <View style={styles.textCol}>
      <Text style={styles.title}>Your streak is at risk!</Text>
      <Text style={styles.sub}>Complete a 15-min focus session to save it</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={Colors.danger} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,71,87,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.12)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,71,87,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.danger,
    marginBottom: 2,
  },
  sub: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
});

export default React.memo(StreakAtRiskBanner);
