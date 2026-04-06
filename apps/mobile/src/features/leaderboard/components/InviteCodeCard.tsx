import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Analytics } from '../../../services/AnalyticsService';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { IOS_APP_STORE_PAGE_URL } from '../../settings/settingsConstants';

let Clipboard: { setStringAsync: (s: string) => Promise<boolean> } | null = null;
try {
  Clipboard = require('expo-clipboard');
} catch {
  // expo-clipboard native module unavailable (Expo Go)
}

export type InviteCodeCardProps = {
  inviteCode: string;
  crewName: string;
};

const InviteCodeCard: React.FC<InviteCodeCardProps> = ({
  inviteCode,
  crewName,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const spacedCode = inviteCode.split('').join(' ');

  const handleCopy = async () => {
    Analytics.track('Crew Invite Shared', { crew_id: crewName, share_method: 'copy' });
    if (Clipboard) {
      await Clipboard.setStringAsync(inviteCode);
    }
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 1500);
  };

  const handleShare = () => {
    Analytics.track('Crew Invite Shared', { crew_id: crewName, share_method: 'share_sheet' });
    Analytics.trackAF('af_invite', { method: 'crew_invite' });
    Share.share({
      message: `Join my crew "${crewName}" on Locked In! 🔒\n\nMy invite code: ${inviteCode}\n\nDownload the app and enter the code to compete with me:\n${IOS_APP_STORE_PAGE_URL}`,
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardGlow} />
      <View style={styles.labelRow}>
        <Ionicons name="key-outline" size={12} color={Colors.textMuted} />
        <Text style={styles.label}>Invite Code</Text>
      </View>
      <View style={styles.codeRow}>
        <Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit>
          {spacedCode}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleCopy}
            hitSlop={8}
            accessibilityLabel="Copy invite code"
            style={[styles.actionBtn, copied && styles.actionBtnSuccess]}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={16}
              color={copied ? Colors.success : Colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            hitSlop={8}
            accessibilityLabel="Share invite"
            style={styles.actionBtn}
          >
            <Ionicons name="share-outline" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(21,26,33,0.72)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,194,255,0.05)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  code: {
    flex: 1,
    fontFamily: FontFamily.headingBold,
    fontSize: 20,
    color: Colors.accent,
    letterSpacing: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSuccess: {
    backgroundColor: 'rgba(0,214,143,0.08)',
    borderColor: 'rgba(0,214,143,0.2)',
  },
});

export default InviteCodeCard;
