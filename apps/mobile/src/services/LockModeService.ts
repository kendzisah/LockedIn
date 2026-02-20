/**
 * Lock Mode service.
 * Phase 1: no-op stubs. Phase 2+: real DND / app-blocking enforcement.
 */
export class LockModeService {
  /** Begin a Lock In session. TODO: Toggle DND, block apps. */
  static beginSession(): void {
    // TODO: Implement real lock enforcement (Phase 2+)
  }

  /** End a Lock In session. TODO: Restore DND, unblock apps. */
  static endSession(): void {
    // TODO: Implement real lock enforcement teardown (Phase 2+)
  }

  /** Check if a session is currently active. */
  static isActive(): boolean {
    // TODO: Return actual lock mode state
    return false;
  }
}
