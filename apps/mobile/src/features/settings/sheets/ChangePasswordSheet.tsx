import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ChangePasswordSheet: React.FC<Props> = ({ visible, onClose }) => {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setPw1('');
      setPw2('');
      setErr(null);
    }
  }, [visible]);

  const valid = pw1.length >= 8 && pw2.length >= 8 && pw1 === pw2;

  const save = async () => {
    if (!valid) return;
    setErr(null);
    setLoading(true);
    try {
      const client = SupabaseService.getClient();
      if (!client) throw new Error('Not connected');
      const { error } = await client.auth.updateUser({ password: pw1 });
      if (error) throw error;
      Alert.alert('Password updated', 'Your password has been updated.');
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsSheetShell visible={visible} onClose={onClose} title="Change password">
      <TextInput
        style={styles.input}
        placeholder="New password"
        placeholderTextColor={Colors.textMuted}
        secureTextEntry
        value={pw1}
        onChangeText={setPw1}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        placeholderTextColor={Colors.textMuted}
        secureTextEntry
        value={pw2}
        onChangeText={setPw2}
      />
      {pw1.length > 0 && pw1.length < 8 ? (
        <Text style={styles.hint}>At least 8 characters</Text>
      ) : null}
      {pw2.length > 0 && pw1 !== pw2 ? (
        <Text style={styles.hint}>Passwords do not match</Text>
      ) : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable
        style={[styles.save, !valid && styles.saveOff]}
        onPress={save}
        disabled={!valid || loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.textPrimary} />
        ) : (
          <Text style={styles.saveText}>Update Password</Text>
        )}
      </Pressable>
    </SettingsSheetShell>
  );
};

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 14,
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.danger,
    marginBottom: 8,
  },
  err: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.danger,
    marginBottom: 8,
  },
  save: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveOff: { opacity: 0.4 },
  saveText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
});

export default ChangePasswordSheet;
