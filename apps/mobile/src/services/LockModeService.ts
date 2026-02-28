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
  static async beginSession(): Promise<void> {
    const mod = await getScreenTime();
    mod?.shieldApps();
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
