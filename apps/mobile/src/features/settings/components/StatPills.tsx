/**
 * StatPills — Bracketed stat pills for the goal / focus-area picker
 * sheets. Renders one pill per stat in the canonical 3-letter form,
 * tinted with the system stat color.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Stat } from '@lockedin/shared-types';
import { FontFamily } from '../../../design/typography';
import { STAT_COLORS, STAT_LABELS } from '../../home/systemTokens';

interface StatPillsProps {
  stats: Stat[];
}

const StatPills: React.FC<StatPillsProps> = ({ stats }) => {
  if (stats.length === 0) return null;
  return (
    <View style={styles.row}>
      {stats.map((s) => (
        <View
          key={s}
          style={[
            styles.pill,
            { backgroundColor: `${STAT_COLORS[s]}1A`, borderColor: `${STAT_COLORS[s]}55` },
          ]}
        >
          <Text style={[styles.text, { color: STAT_COLORS[s] }]}>
            +{STAT_LABELS[s]}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
  },
  text: {
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
});

export default React.memo(StatPills);
