import AsyncStorage from '@react-native-async-storage/async-storage';

/** Remove every persisted key used by the app (prefix `@lockedin/`). */
export async function clearAllLockedInStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const locked = keys.filter((k) => k.startsWith('@lockedin/'));
    if (locked.length) await AsyncStorage.multiRemove(locked);
  } catch (e) {
    console.warn('[lockedInStorage] clearAll failed:', e);
  }
}
