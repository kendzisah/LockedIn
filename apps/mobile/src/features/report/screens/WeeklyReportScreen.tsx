import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import WeeklyReportService, { WeeklyReport } from '../WeeklyReportService';

interface WeeklyReportScreenProps {
  report?: WeeklyReport;
  onDismiss?: () => void;
}

const { width } = Dimensions.get('window');

const defaultReport: WeeklyReport = {
  weekStartDate: new Date().toISOString(),
  daysLockedIn: 0,
  totalFocusMinutes: 0,
  missionsCompleted: 0,
  totalMissions: 21,
  streakDays: 0,
  grade: 'F',
  previousGrade: null,
  percentile: 0,
};

const WeeklyReportScreen: React.FC<WeeklyReportScreenProps> = ({
  report = defaultReport,
  onDismiss,
}) => {
  const navigation = useNavigation();

  const handleDismiss = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await WeeklyReportService.markReportAsShown();
    if (onDismiss) {
      onDismiss();
    } else {
      navigation.goBack();
    }
  };

  const getGradeColor = (): string => {
    switch (report.grade) {
      case 'A+':
      case 'A':
        return Colors.accent; // Electric Cyan
      case 'B+':
      case 'B':
        return Colors.primary; // Discipline Blue
      case 'C':
        return Colors.textSecondary; // Gray
      case 'D':
      case 'F':
        return Colors.danger; // Red
      default:
        return Colors.primary;
    }
  };

  const getGradeMessage = (): string => {
    if (!report.previousGrade) {
      return `You got an ${report.grade}!`;
    }
    if (report.grade > report.previousGrade) {
      return `You went from ${report.previousGrade} to ${report.grade}! Great progress!`;
    }
    if (report.grade < report.previousGrade) {
      return `You went from ${report.previousGrade} to ${report.grade}. Let's bounce back!`;
    }
    return `You held steady at ${report.grade}!`;
  };

  const gradeColor = getGradeColor();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleDismiss}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.title}>Your Discipline Report</Text>

        {/* Grade Card */}
        <View style={[styles.gradeCard, { borderColor: Colors.backgroundSecondary }]}>
          <LinearGradient
            colors={[Colors.backgroundSecondary, Colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradeGradient}
          >
            <Text style={[styles.gradeValue, { color: gradeColor }]}>
              {report.grade}
            </Text>
            <Text style={styles.gradeLabel}>Weekly Grade</Text>
          </LinearGradient>
        </View>

        {/* Grade Message */}
        <Text style={styles.gradeMessage}>{getGradeMessage()}</Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { borderColor: Colors.backgroundSecondary }]}>
            <Text style={styles.statValue}>
              {report.daysLockedIn}/{7}
            </Text>
            <Text style={styles.statLabel}>Days Locked In</Text>
          </View>

          <View style={[styles.statBox, { borderColor: Colors.backgroundSecondary }]}>
            <Text style={styles.statValue}>{report.totalFocusMinutes}</Text>
            <Text style={styles.statLabel}>Focus Minutes</Text>
          </View>

          <View style={[styles.statBox, { borderColor: Colors.backgroundSecondary }]}>
            <Text style={styles.statValue}>
              {report.missionsCompleted}/{report.totalMissions}
            </Text>
            <Text style={styles.statLabel}>Missions</Text>
          </View>

          <View style={[styles.statBox, { borderColor: Colors.backgroundSecondary }]}>
            <Text style={styles.statValue}>{report.streakDays}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>

        {/* Percentile Bar */}
        <View style={styles.percentileSection}>
          <View style={styles.percentileHeader}>
            <Text style={styles.percentileLabel}>Your Performance</Text>
            <Text style={[styles.percentileText, { color: Colors.accent }]}>
              Top {report.percentile}%
            </Text>
          </View>

          <View style={[styles.percentileBar, { backgroundColor: Colors.backgroundSecondary }]}>
            <View
              style={[
                styles.percentileFill,
                {
                  backgroundColor: Colors.accent,
                  width: `${report.percentile}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.percentileDescription}>
            You're performing better than {report.percentile}% of users this week
          </Text>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: Colors.primary }]}
          onPress={handleDismiss}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>Keep Going</Text>
          <MaterialIcons
            name="arrow-forward"
            size={20}
            color={Colors.textPrimary}
            style={styles.ctaIcon}
          />
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    padding: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: FontFamily.headingBold,
    color: Colors.textPrimary,
    marginBottom: 28,
    textAlign: 'center',
  },
  gradeCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  gradeGradient: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeValue: {
    fontSize: 72,
    fontFamily: FontFamily.headingBold,
    marginBottom: 8,
  },
  gradeLabel: {
    fontSize: 16,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
  },
  gradeMessage: {
    fontSize: 16,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  statBox: {
    width: (width - 64) / 2,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontFamily: FontFamily.headingBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  percentileSection: {
    marginBottom: 32,
  },
  percentileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  percentileLabel: {
    fontSize: 14,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textSecondary,
  },
  percentileText: {
    fontSize: 14,
    fontFamily: FontFamily.headingSemiBold,
  },
  percentileBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  percentileFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentileDescription: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  ctaButton: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ctaButtonText: {
    fontSize: 16,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textPrimary,
  },
  ctaIcon: {
    marginLeft: 8,
  },
  spacer: {
    height: 20,
  },
});

export default WeeklyReportScreen;
