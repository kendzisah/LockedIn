import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import SettingsSheetShell from '../components/SettingsSheetShell';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { clearAllLockedInStorage } from '../../../services/lockedInStorage';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const ResetDataSheet: React.FC<Props> = ({ visible, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      await clearAllLockedInStorage();
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsSheetShell visible={visible} onClose={onClose} title="Reset all data?">
      <Text style={styles.warn}>
        This will clear your streak, missions, and all local data. You&apos;ll start fresh
        as if you just downloaded the app.
      </Text>
      <Pressable style={styles.dangerBtn} onPress={run} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={Colors.textPrimary} />
        ) : (
          <Text style={styles.dangerText}>Reset Everything</Text>
        )}
      </Pressable>
      <Pressable style={styles.cancel} onPress={onClose} disabled={loading}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </SettingsSheetShell>
  );
};

const styles = StyleSheet.create({
  warn: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  dangerBtn: {
    backgroundColor: Colors.danger,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  dangerText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  cancel: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
});

export default ResetDataSheet;
