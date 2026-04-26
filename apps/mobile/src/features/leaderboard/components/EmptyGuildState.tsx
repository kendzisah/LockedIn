import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HUDPanel from '../../home/components/HUDPanel';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

export type EmptyGuildStateProps = {
  onCreateGuild: () => void;
  onJoinGuild: () => void;
};

const EmptyGuildState: React.FC<EmptyGuildStateProps> = ({
  onCreateGuild,
  onJoinGuild,
}) => (
  <View style={styles.wrap}>
    <HUDPanel headerLabel="GUILD">
      <View style={styles.iconWrap}>
        <Ionicons name="shield-outline" size={48} color="rgba(58,102,255,0.45)" />
      </View>

      <Text style={styles.title}>YOU&apos;RE NOT IN A GUILD YET.</Text>
      <Text style={styles.subtitle}>
        Guilds compete weekly. Every session and mission earns points for your
        squad — and inviting friends grows your Social stat.
      </Text>

      <TouchableOpacity
        style={styles.primary}
        onPress={onCreateGuild}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryText}>⟐  CREATE GUILD</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondary}
        onPress={onJoinGuild}
        activeOpacity={0.85}
      >
        <Text style={styles.secondaryText}>JOIN WITH CODE</Text>
      </TouchableOpacity>
    </HUDPanel>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  iconWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  title: {
    marginTop: 4,
    fontFamily: FontFamily.headingBold,
    fontSize: 14,
    letterSpacing: 1.6,
    color: SystemTokens.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: SystemTokens.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  primary: {
    paddingVertical: 14,
    backgroundColor: 'rgba(58,102,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.45)',
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 1.8,
    color: SystemTokens.glowAccent,
  },
  secondary: {
    marginTop: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: SystemTokens.textSecondary,
  },
});

export default EmptyGuildState;
