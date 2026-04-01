/**
 * MissionCard.tsx
 * Individual mission card component with completion status and haptic feedback
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { Mission } from '../MissionEngine';

interface MissionCardProps {
  mission: Mission;
  onComplete: (missionId: string) => void;
}

export const MissionCard: React.FC<MissionCardProps> = ({ mission, onComplete }) => {
  const handlePress = async () => {
    if (!mission.completed) {
      // Haptic feedback on completion
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete(mission.id);
    }
  };

  const containerStyle = {
    ...styles.container,
    borderLeftColor: mission.completed ? Colors.success : Colors.accent,
    backgroundColor: mission.completed ? Colors.backgroundSecondary : Colors.surface,
  };

  const titleStyle = {
    ...styles.title,
    color: mission.completed ? Colors.textMuted : Colors.textPrimary,
    textDecorationLine: mission.completed ? ('line-through' as const) : 'none',
  };

  const descriptionStyle = {
    ...styles.description,
    color: mission.completed ? Colors.textMuted : Colors.textSecondary,
  };

  const xpStyle = {
    ...styles.xp,
    color: mission.completed ? Colors.textMuted : Colors.accent,
  };

  const checkmarkStyle = {
    ...styles.checkmark,
    opacity: mission.completed ? 1 : 0,
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={mission.completed ? 1 : 0.7}
      disabled={mission.completed}
    >
      <View style={containerStyle}>
        {/* Left border indicator */}
        <View style={styles.leftBorder} />

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={titleStyle} numberOfLines={2}>
              {mission.title}
            </Text>
            <View style={checkmarkStyle}>
              <Text style={styles.checkmarkIcon}>✓</Text>
            </View>
          </View>

          <Text style={descriptionStyle} numberOfLines={2}>
            {mission.description}
          </Text>
        </View>

        {/* XP Badge */}
        <View style={styles.xpBadge}>
          <Text style={xpStyle} numberOfLines={1}>
            +{mission.xp}
          </Text>
          <Text style={[styles.xpLabel, { color: mission.completed ? Colors.textMuted : Colors.textSecondary }]}>
            XP
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 6,
    marginHorizontal: 0,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  leftBorder: {
    width: 3,
    height: '100%',
    position: 'absolute',
    left: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  content: {
    flex: 1,
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  description: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  xpBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    marginLeft: 8,
  },
  xp: {
    fontSize: 13,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.accent,
  },
  xpLabel: {
    fontSize: 10,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkIcon: {
    fontSize: 14,
    color: Colors.background,
    fontFamily: FontFamily.headingBold,
  },
});
