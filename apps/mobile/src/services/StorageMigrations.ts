/**
 * StorageMigrations — One-shot AsyncStorage key migrations called once
 * at app boot. Idempotent: safe to call on every cold launch; each
 * migration writes a sentinel flag so it never repeats.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SENTINEL_CREW_TO_GUILD = '@lockedin/migrations_crew_to_guild_v1';

/**
 * Carry-forward AsyncStorage keys from the old crew-* prefix to the
 * new guild-* prefix introduced by the Crew → Guild rename.
 */
async function migrateCrewToGuildKeys(): Promise<void> {
  if ((await AsyncStorage.getItem(SENTINEL_CREW_TO_GUILD)) === 'true') {
    return;
  }
  const pairs: { from: string; to: string }[] = [
    { from: '@lockedin/crew_week_stats',         to: '@lockedin/guild_week_stats' },
    { from: '@lockedin/crew_cached_rank',        to: '@lockedin/guild_cached_rank' },
    { from: '@lockedin/has_active_crew',         to: '@lockedin/has_active_guild' },
    { from: '@lockedin/crew_first_nudge_sent',   to: '@lockedin/guild_first_nudge_sent' },
    { from: '@lockedin/notif_crew_updates',      to: '@lockedin/notif_guild_updates' },
  ];
  for (const { from, to } of pairs) {
    try {
      const oldVal = await AsyncStorage.getItem(from);
      if (oldVal === null) continue;
      const newVal = await AsyncStorage.getItem(to);
      if (newVal === null) {
        await AsyncStorage.setItem(to, oldVal);
      }
      await AsyncStorage.removeItem(from);
    } catch {
      // Ignore individual failures; sentinel stays unset so the next
      // launch can retry.
    }
  }
  await AsyncStorage.setItem(SENTINEL_CREW_TO_GUILD, 'true');
}

/** Run all pending storage migrations. Call once on app boot. */
export async function runStorageMigrations(): Promise<void> {
  await migrateCrewToGuildKeys();
}
