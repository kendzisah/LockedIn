/**
 * Lock Mode service.
 *
 * Phase 1 (current): no-op stubs. The app is full-screen with
 *   BackHandler blocking and no in-app navigation during sessions.
 *
 * Phase 2+: explore Screen Time API (iOS) / UsageStatsManager (Android)
 *   for real enforcement. Note: iOS does NOT allow programmatic DND
 *   activation or arbitrary app blocking. Any future enforcement must
 *   work within platform sandbox constraints.
 *
 * Copy guidance: never promise "DND activated" or "apps blocked."
 *   Use "full-screen" and "interruption-minimized" instead.
 */
export class LockModeService {
  /** Begin a Lock In session. Phase 2+: explore platform enforcement APIs. */
  static beginSession(): void {
    // No-op in Phase 1. BackHandler + full-screen provides baseline.
  }

  /** End a Lock In session. Phase 2+: restore any enforcement state. */
  static endSession(): void {
    // No-op in Phase 1.
  }

  /** Check if a session is currently active. */
  static isActive(): boolean {
    // Phase 1: always returns false (no native enforcement layer).
    return false;
  }
}
