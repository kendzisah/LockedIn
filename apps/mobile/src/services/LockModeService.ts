import { Platform } from 'react-native';

let ScreenTime: typeof import('../../modules/screen-time/src') | null = null;

async function getScreenTime() {
  if (Platform.OS !== 'ios') return null;
  if (ScreenTime) return ScreenTime;
  try {
    ScreenTime = await import('../../modules/screen-time/src');
    return ScreenTime;
  } catch {
    return null;
  }
}

export class LockModeService {
  static async beginSession(durationMinutes: number): Promise<void> {
    const mod = await getScreenTime();
    if (!mod) return;
    const durationSeconds = Math.max(1, Math.floor(durationMinutes * 60));
    // Prefer the DeviceActivityMonitor-backed path so the extension
    // un-shields if iOS kills the JS thread mid-session. Falls back to
    // shieldApps() if monitoring fails to schedule (e.g. iOS < 16 or
    // unsupported build).
    const scheduled = await mod.beginSession(durationSeconds);
    if (!scheduled) mod.shieldApps();
  }

  static async endSession(): Promise<void> {
    const mod = await getScreenTime();
    mod?.removeShield();
  }

  static async isActive(): Promise<boolean> {
    const mod = await getScreenTime();
    return mod?.isShielding() ?? false;
  }

  static async showAppPicker(): Promise<number> {
    const mod = await getScreenTime();
    return mod?.showAppPicker() ?? 0;
  }

  static async getSelectedAppCount(): Promise<number> {
    const mod = await getScreenTime();
    return mod?.getSelectedAppCount() ?? 0;
  }
}
