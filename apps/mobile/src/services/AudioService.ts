/**
 * AudioService — expo-audio based audio playback for Lock In / Unlock sessions.
 *
 * Uses the imperative `createAudioPlayer()` API (not hooks) so it can be called
 * from any context (services, callbacks, effects).
 *
 * Interruption policy:
 *  - playsInSilentMode: true (plays even with ringer muted on iOS)
 *  - shouldPlayInBackground: false (pauses when app is backgrounded)
 *  - SessionScreen manages AppState to pause/resume + timestamp-based timer
 *
 * Route changes (AirPods/Bluetooth): handled automatically by expo-audio.
 */

import {
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioPlayer, AudioEvents } from 'expo-audio';

const LOAD_TIMEOUT_MS = 8_000;

let player: AudioPlayer | null = null;
let configured = false;

/**
 * Configure global audio mode. Call once at app boot (App.tsx).
 */
async function configure(): Promise<void> {
  if (configured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
      shouldRouteThroughEarpiece: false,
    });
    configured = true;
  } catch (error) {
    console.warn('[AudioService] Failed to configure audio mode:', error);
  }
}

/**
 * Load audio from a signed URL.
 * Creates a new AudioPlayer, waits for isLoaded with timeout.
 * Returns true if loaded successfully, false on failure/timeout.
 */
async function load(url: string): Promise<boolean> {
  // Clean up any previous player
  unload();

  try {
    player = createAudioPlayer({ uri: url });

    // Wait for the player to finish loading (or timeout)
    return await new Promise<boolean>((resolve) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn('[AudioService] Audio load timed out after', LOAD_TIMEOUT_MS, 'ms');
          resolve(false);
        }
      }, LOAD_TIMEOUT_MS);

      // Check if already loaded (e.g., cached locally)
      if (player!.isLoaded) {
        settled = true;
        clearTimeout(timeout);
        resolve(true);
        return;
      }

      // Listen for status updates
      const subscription = player!.addListener(
        'playbackStatusUpdate',
        (status) => {
          if (!settled && status.isLoaded) {
            settled = true;
            clearTimeout(timeout);
            subscription.remove();
            resolve(true);
          }
        },
      );
    });
  } catch (error) {
    console.warn('[AudioService] Failed to load audio:', error);
    return false;
  }
}

/**
 * Play loaded audio (or resume from paused position).
 * Synchronous — expo-audio play() is non-async.
 */
function play(): void {
  if (player?.isLoaded) {
    player.play();
  }
}

/**
 * Pause audio playback (retains position).
 */
function pause(): void {
  if (player) {
    player.pause();
  }
}

/**
 * Stop audio playback (pause + seek to beginning).
 * expo-audio has no explicit stop(); emulated with pause + seekTo(0).
 */
function stop(): void {
  if (player) {
    player.pause();
    player.seekTo(0).catch(() => {
      // Ignore seek errors on already-disposed players
    });
  }
}

/**
 * Unload audio and release native resources.
 * Always safe to call (idempotent).
 * Must be called on screen unmount to prevent memory leaks.
 */
function unload(): void {
  if (player) {
    try {
      player.remove();
    } catch {
      // Ignore errors during removal — player may already be disposed
    }
    player = null;
  }
}

/**
 * Check if audio is currently loaded and ready to play.
 */
function isLoaded(): boolean {
  return player?.isLoaded ?? false;
}

export const AudioService = {
  configure,
  load,
  play,
  pause,
  stop,
  unload,
  isLoaded,
};
