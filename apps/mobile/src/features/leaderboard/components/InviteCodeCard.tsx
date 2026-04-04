import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    Share.share({
      message: `Join my crew "${crewName}" on Locked In! 🔒\n\nMy invite code: ${inviteCode}\n\nDownload the app and enter the code to compete with me:\n${IOS_APP_STORE_PAGE_URL}`,
    });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit>
        {spacedCode}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleCopy}
          hitSlop={8}
          accessibilityLabel="Copy invite code"
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={20}
            color={copied ? Colors.success : Colors.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleShare}
          hitSlop={8}
          accessibilityLabel="Share invite"
        >
          <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(21,26,33,0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  code: {
    flex: 1,
    fontFamily: FontFamily.heading,
    fontSize: 20,
    color: Colors.accent,
    letterSpacing: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});

export default InviteCodeCard;
