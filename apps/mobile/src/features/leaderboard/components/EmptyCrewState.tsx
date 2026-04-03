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
    <Ionicons name="people-outline" size={64} color={Colors.textMuted} />
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
        <Text style={styles.btnPrimaryText}>Create a Crew</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btnOutline}
        onPress={onJoinCrew}
        activeOpacity={0.85}
      >
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
  },
  title: {
    marginTop: 16,
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    color: Colors.textPrimary,
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
    maxWidth: 400,
    alignSelf: 'center',
  },
  btnPrimary: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.25)',
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.primary,
  },
  btnOutline: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(44,52,64,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  btnOutlineText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.accent,
  },
});

export default EmptyCrewState;
