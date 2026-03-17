import { NativeModules } from 'react-native';

const nativeAvailable = !!NativeModules.RNAppsFlyer;

function getSDK() {
  if (!nativeAvailable) return null;
  try {
    return require('react-native-appsflyer').default;
  } catch {
    return null;
  }
}

const sdk = getSDK();

export const AppsFlyerService = {
  initSdk(options: Record<string, unknown>) {
    try {
      sdk?.initSdk(options);
    } catch (e) {
      console.warn('[AppsFlyer] initSdk failed:', e);
    }
  },

  startSdk() {
    try {
      sdk?.startSdk();
    } catch (e) {
      console.warn('[AppsFlyer] startSdk failed:', e);
    }
  },

  getAppsFlyerUID(): Promise<string | null> {
    return new Promise((resolve) => {
      if (!sdk) { resolve(null); return; }
      try {
        sdk.getAppsFlyerUID(
          (_err: unknown, uid: string) => resolve(uid ?? null),
        );
      } catch {
        resolve(null);
      }
    });
  },

  setAdditionalData(data: Record<string, string>) {
    try {
      sdk?.setAdditionalData(data);
      console.log('[AppsFlyer] setAdditionalData:', Object.keys(data).join(', '));
    } catch (e) {
      console.warn('[AppsFlyer] setAdditionalData failed:', e);
    }
  },

  logEvent(name: string, values: Record<string, string>) {
    try {
      sdk?.logEvent(
        name,
        values,
        (res: string) => console.log(`[AppsFlyer] ${name} sent:`, res),
        (err: string) => console.warn(`[AppsFlyer] ${name} failed:`, err),
      );
    } catch (e) {
      console.warn(`[AppsFlyer] logEvent(${name}) failed:`, e);
    }
  },
};
