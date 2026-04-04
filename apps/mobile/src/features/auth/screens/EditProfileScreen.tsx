import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  // native module unavailable (Expo Go)
}
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../types/navigation';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SupabaseService } from '../../../services/SupabaseService';

type Props = NativeStackScreenProps<MainStackParamList, 'EditProfile'>;

const MAX_NAME_LEN = 20;

const pickerOptions = {
  allowsEditing: true,
  aspect: [1, 1] as [number, number],
  quality: 0.7,
};

function isLocalAssetUri(uri: string | null): boolean {
  if (!uri) return false;
  return uri.startsWith('file:') || uri.startsWith('content:') || uri.startsWith('ph://');
}

const EditProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const { source } = route.params;
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const client = SupabaseService.getClient();
      const userId = SupabaseService.getCurrentUserId();
      if (!client || !userId) return;
      const { data } = await client
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      if (data?.display_name) setDisplayName(String(data.display_name));
      if (data?.avatar_url) setAvatarUri(String(data.avatar_url));
    })();
  }, []);

  const launchCamera = useCallback(async () => {
    if (!ImagePicker) {
      Alert.alert('Unavailable', 'Image picker is not available on this device.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(pickerOptions);
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }, []);

  const launchLibrary = useCallback(async () => {
    if (!ImagePicker) {
      Alert.alert('Unavailable', 'Image picker is not available on this device.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }, []);

  const showPhotoOptions = useCallback(() => {
    const hasAvatar = Boolean(avatarUri);

    if (Platform.OS === 'ios') {
      const options = hasAvatar
        ? ['Take Photo', 'Choose from Library', 'Remove Photo', 'Cancel']
        : ['Take Photo', 'Choose from Library', 'Cancel'];
      const cancelButtonIndex = options.length - 1;
      const destructiveButtonIndex = hasAvatar ? 2 : undefined;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          ...(destructiveButtonIndex !== undefined ? { destructiveButtonIndex } : {}),
        },
        (buttonIndex) => {
          if (buttonIndex === cancelButtonIndex) return;
          if (buttonIndex === 0) launchCamera();
          else if (buttonIndex === 1) launchLibrary();
          else if (hasAvatar && buttonIndex === 2) setAvatarUri(null);
        },
      );
      return;
    }

    Alert.alert(
      'Profile photo',
      undefined,
      [
        { text: 'Take Photo', onPress: () => void launchCamera() },
        { text: 'Choose from Library', onPress: () => void launchLibrary() },
        ...(hasAvatar
          ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => setAvatarUri(null) }]
          : []),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [avatarUri, launchCamera, launchLibrary]);

  const trimmedName = displayName.trim();
  const canSave = trimmedName.length > 0 || Boolean(avatarUri);

  const onSave = useCallback(async () => {
    if (!canSave) return;
    const client = SupabaseService.getClient();
    const userId = SupabaseService.getCurrentUserId();
    if (!client || !userId) {
      Alert.alert('Error', 'Could not connect. Try again.');
      return;
    }

    setSaving(true);
    try {
      let publicUrl: string | null = null;

      if (avatarUri && isLocalAssetUri(avatarUri)) {
        setUploading(true);
        const response = await fetch(avatarUri);
        const blob = await response.blob();
        const path = `${userId}/avatar.jpg`;
        const { error: upErr } = await client.storage.from('avatars').upload(path, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
        setUploading(false);
        if (upErr) {
          Alert.alert('Upload failed', upErr.message);
          setSaving(false);
          return;
        }
        const { data: urlData } = client.storage.from('avatars').getPublicUrl(path);
        publicUrl = urlData.publicUrl;
      } else if (avatarUri && !isLocalAssetUri(avatarUri)) {
        publicUrl = avatarUri;
      }

      const { error: profileErr } = await client
        .from('profiles')
        .update({
          display_name: trimmedName || null,
          ...(publicUrl !== null ? { avatar_url: publicUrl } : {}),
        })
        .eq('id', userId);

      if (profileErr) {
        Alert.alert('Save failed', profileErr.message);
        setSaving(false);
        return;
      }

      if (source === 'signup') {
        navigation.replace('Tabs');
      } else {
        navigation.goBack();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      Alert.alert('Error', msg);
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }, [avatarUri, canSave, navigation, source, trimmedName]);

  const onSkip = useCallback(() => {
    navigation.replace('Tabs');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {source === 'profile' ? (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.headerTitle}>Set Up Your Profile</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.body}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={showPhotoOptions}
          activeOpacity={0.85}
          disabled={uploading || saving}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
          ) : (
            <Ionicons name="person" size={48} color={Colors.textMuted} />
          )}
          {(uploading || saving) && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={showPhotoOptions} activeOpacity={0.8} disabled={uploading || saving}>
          <Text style={styles.photoLink}>{avatarUri ? 'Change Photo' : 'Add Photo'}</Text>
        </TouchableOpacity>

        <View style={styles.nameSection}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            placeholder="What should your crew call you?"
            placeholderTextColor={Colors.textMuted}
            value={displayName}
            onChangeText={(t) => setDisplayName(t.slice(0, MAX_NAME_LEN))}
            maxLength={MAX_NAME_LEN}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text style={styles.counter}>
            {displayName.length}/{MAX_NAME_LEN}
          </Text>
          <Text style={styles.helper}>Visible to your crew members</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={!canSave || saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
        {source === 'signup' ? (
          <TouchableOpacity style={styles.skipTap} onPress={onSkip} activeOpacity={0.8}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    minHeight: 48,
  },
  headerSide: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(44,52,64,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14,17,22,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoLink: {
    marginTop: 12,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.accent,
  },
  nameSection: {
    marginTop: 32,
    width: '100%',
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    height: 52,
    backgroundColor: 'rgba(44,52,64,0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    fontFamily: FontFamily.body,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  counter: {
    marginTop: 6,
    textAlign: 'right',
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  helper: {
    marginTop: 6,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  bottom: {
    padding: 24,
    paddingTop: 12,
  },
  saveBtn: {
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.25)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.primary,
  },
  skipTap: {
    paddingVertical: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
});

export default EditProfileScreen;
