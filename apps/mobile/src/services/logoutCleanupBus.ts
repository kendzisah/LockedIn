/**
 * Notifies in-memory providers to reset after sign-out (AsyncStorage is cleared separately).
 */

export type LogoutCleanupListener = () => void;

const listeners = new Set<LogoutCleanupListener>();

export function subscribeLogoutCleanup(fn: LogoutCleanupListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitLogoutCleanup(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('[logoutCleanupBus] listener failed:', e);
    }
  });
}
