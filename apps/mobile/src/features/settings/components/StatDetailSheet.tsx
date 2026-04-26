/**
 * StatDetailSheet — Bottom sheet opened by tapping a stat row in
 * SystemStatsCard. Explains what grows the stat and lists three sample
 * missions that target it.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Stat } from '@lockedin/shared-types';
import HUDCornerBrackets from '../../home/components/HUDCornerBrackets';
import { FontFamily } from '../../../design/typography';
import { STAT_COLORS, STAT_LABELS, SystemTokens } from '../../home/systemTokens';
import {
  CORE_MISSIONS,
  GOAL_MISSIONS,
  WEAKNESS_MISSIONS,
  type MissionTemplate,
} from '../../missions/MissionData';
import { MISSION_TYPE_STATS } from '../../missions/MissionEngine';

const STAT_FULL_LABEL: Record<Stat, string> = {
  discipline:  'DISCIPLINE',
  focus:       'FOCUS',
  execution:   'EXECUTION',
  consistency: 'CONSISTENCY',
  social:      'SOCIAL',
};

/**
 * Plain-language explanations of what grows each stat. Mirrors the
 * counter→stat formulas in StatsService + the bump pipeline in
 * MissionsProvider/SessionProvider.
 */
const GROWTH_SOURCES: Record<Stat, string[]> = {
  discipline: [
    'Completing discipline-tagged missions',
    'Resisting blocked-app attempts during focus sessions',
    'Cold exposure / no-phone / no-social challenges',
  ],
  focus: [
    'Logging focus session minutes',
    'Hitting your daily focus goal consistently',
    'Long focus blocks (60 min+) earn bonus XP',
  ],
  execution: [
    'Completing focus sessions',
    'Completing daily missions',
    'Logging your daily activity check-in',
  ],
  consistency: [
    'Hitting your daily focus goal day after day',
    'Perfect days (clearing all 3 daily missions) count double',
    'Streaks reset, but lifetime consistency does not',
  ],
  social: [
    'Inviting friends — every redeemed code grows your stat',
    'Completing social-tagged missions (accountability, networking)',
    'Guild check-ins each week',
  ],
};

interface Props {
  visible: boolean;
  stat: Stat | null;
  currentValue: number;
  onClose: () => void;
}

function findSampleMissions(stat: Stat): MissionTemplate[] {
  const out: MissionTemplate[] = [];
  const seen = new Set<string>();

  const accept = (t: MissionTemplate) => {
    if (seen.has(t.title)) return;
    if (t.duration === 'weekly') return;
    const tags = MISSION_TYPE_STATS[t.type] ?? [];
    if (!tags.includes(stat)) return;
    seen.add(t.title);
    out.push(t);
  };

  // Look across all pools for templates targeting this stat
  for (const t of CORE_MISSIONS) {
    if (out.length >= 3) break;
    accept(t);
  }
  for (const pool of Object.values(GOAL_MISSIONS)) {
    for (const t of pool) {
      if (out.length >= 3) break;
      accept(t);
    }
    if (out.length >= 3) break;
  }
  for (const pool of Object.values(WEAKNESS_MISSIONS)) {
    for (const t of pool) {
      if (out.length >= 3) break;
      accept(t);
    }
    if (out.length >= 3) break;
  }

  return out;
}

const StatDetailSheet: React.FC<Props> = ({ visible, stat, currentValue, onClose }) => {
  const samples = useMemo(() => (stat ? findSampleMissions(stat) : []), [stat]);

  if (!stat) return null;

  const color = STAT_COLORS[stat];
  const label = STAT_FULL_LABEL[stat];
  const sources = GROWTH_SOURCES[stat];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <HUDCornerBrackets color={color} />
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={[styles.headerLabel, { color }]}>// {label}</Text>
            <Text style={styles.headerValue}>{currentValue}</Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>WHAT GROWS THIS STAT</Text>
            <View style={styles.bulletGroup}>
              {sources.map((src, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.bullet, { backgroundColor: color }]} />
                  <Text style={styles.bulletText}>{src}</Text>
                </View>
              ))}
            </View>

            {samples.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
                  MISSIONS THAT TARGET {STAT_LABELS[stat]}
                </Text>
                <View style={styles.missionGroup}>
                  {samples.map((m) => (
                    <View
                      key={m.title}
                      style={[styles.missionRow, { borderLeftColor: color }]}
                    >
                      <Text style={styles.missionTitle}>{m.title}</Text>
                      <Text style={styles.missionDesc} numberOfLines={2}>
                        {m.description}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={styles.close} activeOpacity={0.85}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: SystemTokens.panelBg,
    borderTopWidth: 1,
    borderColor: SystemTokens.panelBorder,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 3,
    backgroundColor: 'rgba(58,102,255,0.3)',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  headerLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 2.2,
  },
  headerValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    color: SystemTokens.textPrimary,
    letterSpacing: -0.5,
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: SystemTokens.textMuted,
    marginBottom: 10,
  },
  bulletGroup: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 6,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: SystemTokens.textSecondary,
    lineHeight: 18,
  },
  missionGroup: {
    gap: 8,
  },
  missionRow: {
    paddingLeft: 10,
    paddingVertical: 8,
    paddingRight: 6,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderLeftWidth: 2,
  },
  missionTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: SystemTokens.textPrimary,
  },
  missionDesc: {
    marginTop: 2,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: SystemTokens.textMuted,
    lineHeight: 16,
  },
  close: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  closeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: SystemTokens.textMuted,
  },
});

export default StatDetailSheet;
