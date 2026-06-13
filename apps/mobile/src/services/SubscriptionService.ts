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
import { Analytics } from './AnalyticsService';

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
    } catch (e: any) {
      console.warn('[SubscriptionService] collectDeviceIdentifiers failed (non-fatal):', e);
      Analytics.track('subscription_collect_identifiers_failed', {
        error_type: 'collect_device_identifiers',
        error_code: e?.code,
        error_message: e?.message,
      });
    }

    // Send AppsFlyer ID to RevenueCat for S2S integration
    try {
      const afUID = await AppsFlyerService.getAppsFlyerUID();
      if (afUID) {
        Purchases.setAppsflyerID(afUID);
        console.log('[SubscriptionService] AppsFlyer ID set on RevenueCat:', afUID);
      }
    } catch (e: any) {
      console.warn('[SubscriptionService] setAppsflyerID failed (non-fatal):', e);
      Analytics.track('subscription_appsflyer_id_failed', {
        error_type: 'set_appsflyer_id',
        error_code: e?.code,
        error_message: e?.message,
      });
    }

    // Restore purchases to cover reinstall / new anonymous-ID scenarios.
    try {
      await Purchases.restorePurchases();
    } catch (restoreErr: any) {
      console.warn('[SubscriptionService] restorePurchases failed (non-fatal):', restoreErr);
      Analytics.captureException(restoreErr, {
        error_type: 'restore_purchases_init',
        error_code: restoreErr?.code,
      });
      Analytics.track('subscription_restore_init_failed', {
        error_type: 'restore_purchases_init',
        error_code: restoreErr?.code,
        error_message: restoreErr?.message,
      });
    }

    console.log('[SubscriptionService] Initialized');
    return true;
  } catch (error) {
    console.warn('[SubscriptionService] Init failed:', error);
    initialized = true;
    return false;
  }
}

function hasEntitlement(info: CustomerInfo | null): boolean {
  return !!info && ENTITLEMENT_ID in (info.entitlements.active ?? {});
}

async function checkSubscription(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return hasEntitlement(info);
  } catch {
    return false;
  }
}

/**
 * Identify an authenticated user in RevenueCat.
 * Transfers any anonymous subscription to the authenticated user ID.
 */
async function logIn(userId: string): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return hasEntitlement(customerInfo);
  } catch (e: any) {
    console.warn('[SubscriptionService] logIn failed:', e);
    Analytics.captureException(e, {
      error_type: 'revenuecat_login',
      error_code: e?.code,
    });
    Analytics.track('subscription_login_rn_failed', {
      error_type: 'revenuecat_login',
      error_code: e?.code,
      error_message: e?.message,
    });
    return false;
  }
}

/**
 * Reset RevenueCat to a new anonymous user.
 * Call on sign-out so the next session gets a fresh customer ID.
 */
async function logOut(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch (e: any) {
    console.warn('[SubscriptionService] logOut failed:', e);
    Analytics.track('subscription_logout_rn_failed', {
      error_type: 'revenuecat_logout',
      error_code: e?.code,
      error_message: e?.message,
    });
  }
}

async function restore(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return hasEntitlement(info);
  } catch (e: any) {
    Analytics.captureException(e, {
      error_type: 'restore_purchases_manual',
      error_code: e?.code,
    });
    Analytics.track('subscription_restore_manual_rn_failed', {
      error_type: 'restore_purchases_manual',
      error_code: e?.code,
      error_message: e?.message,
    });
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
  logIn,
  logOut,
  checkSubscription,
  restore,
  addListener,
  hasEntitlement,
  isInitialized,
  ENTITLEMENT_ID,
};
