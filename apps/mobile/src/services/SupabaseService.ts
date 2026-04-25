/**
 * SupabaseService — Singleton Supabase client for the mobile app.
 *
 * Uses expo-secure-store for auth token persistence (more secure than AsyncStorage).
 * Anonymous auth: users are "authenticated" for RLS without email/password.
 *
 * Device reinstall: user gets a new anonymous ID; local streak data is lost.
 * Future mitigation: account linking (Apple Sign-In / email).
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createMobileClient,
  ensureAnonymousSession,
  type StorageAdapter,
} from '@lockedin/supabase-client';
import { ENV } from '../config/env';

const HAS_LAUNCHED_KEY = '@lockedin/has_launched';

// ── SecureStore adapter for Supabase auth persistence ──

const SecureStoreAdapter: StorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// ── Singleton state ──

let client: SupabaseClient | null = null;
let currentUserId: string | null = null;
let initialized = false;

/**
 * Initialize Supabase client + anonymous auth session.
 * Call once during app boot (App.tsx). Safe to call multiple times (no-op after first).
 *
 * @returns true if auth succeeded, false if it failed (app can still run in timer-only mode).
 */
async function initialize(): Promise<boolean> {
  if (initialized) return true;

  try {
    client = createMobileClient(
      ENV.SUPABASE_URL,
      ENV.SUPABASE_ANON_KEY,
      SecureStoreAdapter,
    );

    // Detect fresh install: AsyncStorage is wiped on uninstall, but Keychain
    // (SecureStore) survives. If the flag is missing, a stale session from a
    // previous install may still be in the Keychain — sign out to clear it.
    try {
      const hasLaunched = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);
      if (!hasLaunched) {
        await client.auth.signOut();
        await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true');
      }
    } catch (e) {
      console.warn('[SupabaseService] Fresh install cleanup failed (continuing):', e);
    }

    currentUserId = await ensureAnonymousSession(client);

    // Keep cached id in sync with the live session (sign-up / link / sign-out all change auth).
    client.auth.onAuthStateChange((_event, session) => {
      currentUserId = session?.user?.id ?? null;
    });

    initialized = true;
    console.log('[SupabaseService] Authenticated anonymously:', currentUserId);
    return true;
  } catch (error) {
    console.warn('[SupabaseService] Init failed (app will run in timer-only mode):', error);
    // Don't set initialized = true — allow retry on next call
    client = null;
    return false;
  }
}

/**
 * Get the Supabase client instance.
 * Must call initialize() first (from App.tsx boot).
 * Returns null if not initialized (should never happen in normal flow).
 */
function getClient(): SupabaseClient | null {
  return client;
}

/**
 * Get the current anonymous user ID.
 * Returns null if auth failed or not yet initialized.
 */
function getCurrentUserId(): string | null {
  return currentUserId;
}

/**
 * Check if the service has been initialized.
 */
function isInitialized(): boolean {
  return initialized;
}

export const SupabaseService = {
  initialize,
  getClient,
  getCurrentUserId,
  isInitialized,
};
