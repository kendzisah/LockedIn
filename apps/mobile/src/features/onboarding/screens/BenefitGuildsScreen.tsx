import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import BenefitTemplate from '../components/BenefitTemplate';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BenefitGuilds'>;

interface MemberRow {
  rank: number;
  name: string;
  ovr: number;
  tier: string;
  tierColor: string;
  points: number;
  isYou?: boolean;
}

const ROWS: MemberRow[] = [
  { rank: 1, name: 'Marcus', ovr: 45, tier: 'Elite',   tierColor: '#FFC857', points: 1240 },
  { rank: 2, name: 'Jayden', ovr: 31, tier: 'Rising',  tierColor: '#00C2FF', points: 890 },
  { rank: 3, name: 'Lance',  ovr: 23, tier: 'Recruit', tierColor: '#4A7FB5', points: 640 },
  { rank: 4, name: 'You',    ovr: 1,  tier: 'NPC',     tierColor: '#8B8B8B', points: 0, isYou: true },
];

const Graphic: React.FC = () => (
  <View style={styles.card}>
    <Text style={styles.cardHeader}>WEEKLY LEADERBOARD</Text>
    {ROWS.map((row) => (
      <View
        key={row.rank}
        style={[styles.row, row.isYou && styles.rowYou]}
      >
        <Text style={styles.rankNum}>{row.rank}.</Text>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: `${row.tierColor}26`,
              borderColor: `${row.tierColor}66`,
              shadowColor: row.tierColor,
            },
          ]}
        >
          <Text style={[styles.avatarInitial, { color: row.tierColor }]}>
            {row.name.charAt(0)}
          </Text>
        </View>
        <Text
          style={[styles.name, row.isYou && styles.nameYou]}
          numberOfLines={1}
        >
          {row.name}
        </Text>
        <Text style={styles.ovr}>OVR {row.ovr}</Text>
        <Text style={[styles.tier, { color: row.tierColor }]}>{row.tier}</Text>
        <Text style={styles.points}>{row.points}</Text>
      </View>
    ))}
  </View>
);

const BenefitGuildsScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('BenefitGuilds');
  return (
    <BenefitTemplate
      panelLabel="GUILDS"
      step={13}
      headline="GUILDS"
      headlineColor="#A855F7"
      body="Create a guild. Invite your guild. Compete on a weekly leaderboard. Every session, mission, and streak day earns points. See who's actually locked in and who's just talking."
      graphic={<Graphic />}
      onContinue={() => navigation.navigate('BenefitReport')}
    />
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
  },
  cardHeader: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  rowYou: {
    backgroundColor: 'rgba(0,194,255,0.05)',
    borderRadius: 6,
    paddingHorizontal: 4,
    marginHorizontal: -4,
  },
  rankNum: {
    width: 18,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarInitial: {
    fontFamily: FontFamily.headingBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  name: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  nameYou: {
    color: Colors.accent,
    fontFamily: FontFamily.headingSemiBold,
  },
  ovr: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    color: Colors.textPrimary,
    width: 44,
  },
  tier: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 9,
    letterSpacing: 0.5,
    width: 50,
  },
  points: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    color: Colors.warning,
    width: 38,
    textAlign: 'right',
  },
});

export default BenefitGuildsScreen;
