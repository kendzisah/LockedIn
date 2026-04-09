import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import SettingsSheetShell from '../components/SettingsSheetShell';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SupabaseService } from '../../../services/SupabaseService';
import { clearAllLockedInStorage } from '../../../services/lockedInStorage';
import { Analytics } from '../../../services/AnalyticsService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

const DeleteAccountSheet: React.FC<Props> = ({ visible, onClose, onDeleted }) => {
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setConfirm('');
      setErr(null);
    }
  }, [visible]);

  const canDelete = confirm === 'DELETE';

  const run = async () => {
    if (!canDelete) return;
    setLoading(true);
    setErr(null);
    try {
      const client = SupabaseService.getClient();
      if (!client) throw new Error('Not connected');
      const { error } = await client.rpc('delete_own_account');
      if (error) throw error;
      Analytics.track('Account Deleted');
      await clearAllLockedInStorage();
      onDeleted();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not delete account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsSheetShell visible={visible} onClose={onClose} title="Delete your account?">
      <Text style={styles.warn}>
        This will permanently delete your account, all your data, streak history, squad
        memberships, and scores. This cannot be undone.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Type DELETE to confirm"
        placeholderTextColor={Colors.textMuted}
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="characters"
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable
        style={[styles.dangerBtn, !canDelete && styles.off]}
        onPress={run}
        disabled={!canDelete || loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.textPrimary} />
        ) : (
          <Text style={styles.dangerText}>Delete My Account</Text>
        )}
      </Pressable>
    </SettingsSheetShell>
  );
};

const styles = StyleSheet.create({
  warn: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 14,
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  err: {
    marginTop: 8,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.danger,
  },
  dangerBtn: {
    marginTop: 16,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  off: { opacity: 0.4 },
  dangerText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
});

export default DeleteAccountSheet;
