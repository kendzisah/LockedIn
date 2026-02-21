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
import {
  createMobileClient,
  ensureAnonymousSession,
  type StorageAdapter,
} from '@lockedin/supabase-client';
import { ENV } from '../config/env';

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

  client = createMobileClient(
    ENV.SUPABASE_URL,
    ENV.SUPABASE_ANON_KEY,
    SecureStoreAdapter,
  );

  try {
    currentUserId = await ensureAnonymousSession(client);
    initialized = true;
    console.log('[SupabaseService] Authenticated anonymously:', currentUserId);
    return true;
  } catch (error) {
    console.warn('[SupabaseService] Auth failed (app will run in timer-only mode):', error);
    // Client is still created — queries will just fail with 401 and return null
    initialized = true;
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
