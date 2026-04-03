/**
 * SubscriptionService — Singleton RevenueCat wrapper.
 *
 * Uses RevenueCat's own anonymous ID (not Supabase) so subscriptions survive
 * app reinstalls. On init, restorePurchases() syncs any active App Store
 * subscription to the current device, covering the reinstall edge case.
 */

import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesConfiguration,
  LOG_LEVEL,
} from 'react-native-purchases';
import { ENV } from '../config/env';
import { AppsFlyerService } from './AppsFlyerService';

const ENTITLEMENT_ID = 'Inner_Circle';

let initialized = false;

async function initialize(): Promise<boolean> {
  if (initialized) return true;

  try {
    const config: PurchasesConfiguration = {
      apiKey: ENV.REVENUECAT_IOS_API_KEY,
    };

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    await Purchases.configure(config);
    initialized = true;

    // Send device identifiers (IDFA/IDFV) to RevenueCat for attribution
    try {
      Purchases.collectDeviceIdentifiers();
    } catch (e) {
      console.warn('[SubscriptionService] collectDeviceIdentifiers failed (non-fatal):', e);
    }

    // Send AppsFlyer ID to RevenueCat for S2S integration
    try {
      const afUID = await AppsFlyerService.getAppsFlyerUID();
      if (afUID) {
        Purchases.setAppsflyerID(afUID);
        console.log('[SubscriptionService] AppsFlyer ID set on RevenueCat:', afUID);
      }
    } catch (e) {
      console.warn('[SubscriptionService] setAppsflyerID failed (non-fatal):', e);
    }

    // Restore purchases to cover reinstall / new anonymous-ID scenarios.
    try {
      await Purchases.restorePurchases();
    } catch (restoreErr) {
      console.warn('[SubscriptionService] restorePurchases failed (non-fatal):', restoreErr);
    }

    console.log('[SubscriptionService] Initialized');
    return true;
  } catch (error) {
    console.warn('[SubscriptionService] Init failed:', error);
    initialized = true;
    return false;
  }
}

function hasEntitlement(info: CustomerInfo): boolean {
  return ENTITLEMENT_ID in (info.entitlements.active ?? {});
}

async function checkSubscription(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return hasEntitlement(info);
  } catch {
    return false;
  }
}

async function restore(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return hasEntitlement(info);
  } catch {
    return false;
  }
}

function addListener(
  callback: (info: CustomerInfo) => void,
): () => void {
  Purchases.addCustomerInfoUpdateListener(callback);
  return () => {};
}

function isInitialized(): boolean {
  return initialized;
}

export const SubscriptionService = {
  initialize,
  checkSubscription,
  restore,
  addListener,
  hasEntitlement,
  isInitialized,
  ENTITLEMENT_ID,
};
