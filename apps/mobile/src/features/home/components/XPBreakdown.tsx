/**
 * XPBreakdown — Animated XP earned card for SessionCompleteScreen.
 *
 * Computes the same breakdown that XPService.computeXP applies on the
 * server side (base + duration bonus + streak multiplier) so users see
 * exactly where their points came from. Rows stagger-fade in.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

interface XPBreakdownProps {
  durationMinutes: number;
  streakDays: number;
  /** Optional: triggered when the total animates in (for haptics). */
  onTotalRevealed?: () => void;
}

interface Row {
  label: string;
  value: number;
}

function buildRows(durationMinutes: number, streakDays: number): {
  rows: Row[];
  total: number;
} {
  const base = 35;
  const longBonus = durationMinutes >= 60 ? 15 : 0;
  const subtotal = base + longBonus;
  const multiplier = 1 + Math.min(streakDays / 30, 0.5);
  const total = Math.round(subtotal * multiplier);
  const streakDelta = total - subtotal;

  const rows: Row[] = [
    { label: `Focus session (${durationMinutes} min)`, value: base },
  ];
  if (longBonus > 0) {
    rows.push({ label: 'Long-session bonus (60 min+)', value: longBonus });
  }
  if (streakDelta > 0) {
    rows.push({
      label: `Streak multiplier (×${multiplier.toFixed(2)})`,
      value: streakDelta,
    });
  }
  return { rows, total };
}

const XPBreakdown: React.FC<XPBreakdownProps> = ({
  durationMinutes,
  streakDays,
  onTotalRevealed,
}) => {
  const { rows, total } = buildRows(durationMinutes, streakDays);
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(12)).current;
  const rowOpacities = useRef(rows.map(() => new Animated.Value(0))).current;
  const totalOpacity = useRef(new Animated.Value(0)).current;
  const totalScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardTranslate, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    rows.forEach((_, idx) => {
      timers.push(
        setTimeout(() => {
          Animated.timing(rowOpacities[idx], {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }).start();
        }, 300 + idx * 250),
      );
    });

    timers.push(
      setTimeout(
        () => {
          Animated.parallel([
            Animated.timing(totalOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(totalScale, {
              toValue: 1,
              friction: 6,
              tension: 80,
              useNativeDriver: true,
            }),
          ]).start();
          onTotalRevealed?.();
        },
        300 + rows.length * 250 + 200,
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    cardOpacity,
    cardTranslate,
    rowOpacities,
    totalOpacity,
    totalScale,
    rows,
    onTotalRevealed,
  ]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: cardOpacity,
          transform: [{ translateY: cardTranslate }],
        },
      ]}
    >
      <Text style={styles.heading}>XP EARNED</Text>

      {rows.map((row, idx) => (
        <Animated.View
          key={row.label}
          style={[styles.row, { opacity: rowOpacities[idx] }]}
        >
          <Text style={styles.rowLabel} numberOfLines={1}>
            {row.label}
          </Text>
          <Text style={styles.rowValue}>+{row.value}</Text>
        </Animated.View>
      ))}

      <View style={styles.divider} />

      <Animated.View
        style={[
          styles.totalRow,
          {
            opacity: totalOpacity,
            transform: [{ scale: totalScale }],
          },
        ]}
      >
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.totalValue}>+{total} XP</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(21,26,33,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(0,194,255,0.18)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: Colors.accent,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  heading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.accent,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  divider: {
    marginTop: 8,
    marginBottom: 8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 1.4,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: Colors.success,
    textShadowColor: 'rgba(0,214,143,0.4)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
});

export default XPBreakdown;
