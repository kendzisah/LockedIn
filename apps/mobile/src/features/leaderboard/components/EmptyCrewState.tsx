import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

export type EmptyCrewStateProps = {
  onCreateCrew: () => void;
  onJoinCrew: () => void;
};

const EmptyCrewState: React.FC<EmptyCrewStateProps> = ({
  onCreateCrew,
  onJoinCrew,
}) => (
  <View style={styles.root}>
    <View style={styles.iconWrap}>
      <Ionicons name="people-outline" size={32} color={Colors.primary} />
    </View>
    <Text style={styles.title}>No crews yet</Text>
    <Text style={styles.subtitle}>
      Create a crew with friends or join one with an invite code to climb the
      leaderboard together.
    </Text>
    <View style={styles.buttons}>
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={onCreateCrew}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={18} color={Colors.textPrimary} />
        <Text style={styles.btnPrimaryText}>Create a Crew</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btnOutline}
        onPress={onJoinCrew}
        activeOpacity={0.85}
      >
        <Ionicons name="enter-outline" size={18} color={Colors.accent} />
        <Text style={styles.btnOutlineText}>Join with Code</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(58,102,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 18,
    fontFamily: FontFamily.headingBold,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  buttons: {
    marginTop: 28,
    width: '100%',
    gap: 12,
    maxWidth: 320,
    alignSelf: 'center',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(58,102,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(120,160,255,0.55)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  btnPrimaryText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  btnOutlineText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.accent,
  },
});

export default EmptyCrewState;
