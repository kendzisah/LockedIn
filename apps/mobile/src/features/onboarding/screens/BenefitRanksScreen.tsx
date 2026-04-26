import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import BenefitTemplate from '../components/BenefitTemplate';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { RANK_TIERS } from '../../../design/rankTiers';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BenefitRanks'>;

const Graphic: React.FC = () => {
  // Render top → bottom (top of ladder first), highlight NPC at the bottom.
  const ordered = [...RANK_TIERS].reverse();
  const lastIdx = ordered.length - 1;

  return (
    <View style={styles.list}>
      {ordered.map((tier, idx) => {
        const isYou = tier.id === 'npc';
        const isFirst = idx === 0;
        const isLast = idx === lastIdx;

        return (
          <View key={tier.id} style={styles.row}>
            {/* Vertical connector + node */}
            <View style={styles.railColumn}>
              <View
                style={[
                  styles.railSegment,
                  isFirst && styles.railSegmentInvisible,
                ]}
              />
              <View
                style={[
                  styles.node,
                  { backgroundColor: tier.color, shadowColor: tier.color },
                  isYou && styles.nodeYou,
                ]}
              />
              <View
                style={[
                  styles.railSegment,
                  isLast && styles.railSegmentInvisible,
                ]}
              />
            </View>

            {/* Rank chip */}
            <View
              style={[
                styles.chip,
                {
                  borderColor: isYou
                    ? tier.color
                    : `${tier.color}33`,
                  backgroundColor: isYou
                    ? `${tier.color}1A`
                    : 'rgba(21,26,33,0.4)',
                },
              ]}
            >
              <Text
                style={[
                  styles.rankName,
                  { color: tier.color },
                  isYou && styles.rankNameYou,
                ]}
              >
                {tier.name}
              </Text>
              {isYou ? (
                <View
                  style={[
                    styles.youBadge,
                    { borderColor: tier.color, backgroundColor: `${tier.color}40` },
                  ]}
                >
                  <Text style={[styles.youBadgeText, { color: Colors.textPrimary }]}>
                    YOU
                  </Text>
                </View>
              ) : (
                <Text style={styles.dayHint}>Day {tier.minDays}+</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const BenefitRanksScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('BenefitRanks');
  return (
    <BenefitTemplate
      step={12}
      headline="9 RANKS. 365 DAYS TO THE TOP."
      headlineColor={Colors.textPrimary}
      body="Every day you show up, your rank climbs. Every day you skip, you sacrifice XP you can't get back. The path to LOCKED IN won't wait. Most won't make it. Will you?"
      graphic={<Graphic />}
      onContinue={() => navigation.navigate('BenefitGuilds')}
    />
  );
};

const NODE_SIZE = 12;
const RAIL_WIDTH = 2;

const styles = StyleSheet.create({
  list: {
    width: '100%',
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 36,
  },
  railColumn: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railSegment: {
    flex: 1,
    width: RAIL_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  railSegmentInvisible: {
    backgroundColor: 'transparent',
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  nodeYou: {
    width: NODE_SIZE + 4,
    height: NODE_SIZE + 4,
    borderRadius: (NODE_SIZE + 4) / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  chip: {
    flex: 1,
    marginVertical: 3,
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankName: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    letterSpacing: 0.8,
  },
  rankNameYou: {
    fontFamily: FontFamily.headingBold,
  },
  dayHint: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    letterSpacing: 0.4,
    color: Colors.textMuted,
  },
  youBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  youBadgeText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    letterSpacing: 1,
  },
});

export default BenefitRanksScreen;
