import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../types/navigation';
import { CrewService } from '../CrewService';
import { NotificationService } from '../../../services/NotificationService';
import { useAuth } from '../../auth/AuthProvider';
import { Analytics } from '../../../services/AnalyticsService';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<MainStackParamList, 'CreateCrew'>;

const MAX_NAME_LENGTH = 30;

const CreateCrewScreen: React.FC<Props> = ({ navigation }) => {
  const { isAnonymous } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canCreate = trimmed.length > 0 && !loading;

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    setError(null);

    const result = await CrewService.createCrew(trimmed);
    setLoading(false);

    if (result) {
      Analytics.track('Crew Created', { crew_name: result.name, crew_id: result.crew_id });
      void (async () => {
        try {
          const { hadCrewBefore, hasCrewNow } = await CrewService.syncHasActiveCrewFlag();
          if (hasCrewNow && !hadCrewBefore) {
            await NotificationService.scheduleFirstCrewNudgeIfNeeded();
          }
          await NotificationService.refreshScheduleWithStoredStreak();
        } catch {
          /* ignore */
        }
      })();
      navigation.replace('CrewDetail', { crew_id: result.crew_id });
    } else {
      setError('Failed to create squad. You may own a maximum of 3 squads.');
    }
  };

  useEffect(() => {
    if (isAnonymous) {
      Analytics.track('Signup Nudge Shown', { nudge_type: 'crew_create' });
    }
  }, [isAnonymous]);

  if (isAnonymous) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create a Squad</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.gateBody}>
          <View style={styles.gateIcon}>
            <Ionicons name="people" size={48} color={Colors.textMuted} />
          </View>
          <Text style={styles.gateTitle}>Sign up to create a squad</Text>
          <Text style={styles.gateSub}>
            Squad owners need an account so your squad stays safe. You can still
            join squads as a guest.
          </Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('SignUp')}
            activeOpacity={0.85}
          >
            <Text style={styles.createBtnText}>Create Free Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginTop: 14, alignItems: 'center' }}
          >
            <Text style={styles.gateBack}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create a Squad</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Squad Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(t) => setName(t.slice(0, MAX_NAME_LENGTH))}
          placeholder="e.g. Discipline Squad"
          placeholderTextColor={Colors.textMuted}
          maxLength={MAX_NAME_LENGTH}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <Text style={styles.counter}>{trimmed.length}/{MAX_NAME_LENGTH}</Text>

        <TouchableOpacity
          style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!canCreate}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textPrimary} size="small" />
          ) : (
            <Text style={styles.createBtnText}>Create Squad</Text>
          )}
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  label: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(44,52,64,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    height: 52,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  counter: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 6,
  },
  createBtn: {
    marginTop: 24,
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.25)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.primary,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: 14,
  },
  gateBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  gateIcon: {
    marginBottom: 20,
  },
  gateTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  gateSub: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: 8,
    lineHeight: 20,
  },
  gateBack: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
});

export default CreateCrewScreen;
