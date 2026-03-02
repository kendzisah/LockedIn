/**
 * PaywallService — RevenueCat integration for subscription management.
 *
 * Wraps react-native-purchases with app-specific logic.
 * Initialize once during app boot (App.tsx), then use static methods.
 *
 * Security: API key is read from ENV (never hardcoded).
 * The test key is safe to ship in dev builds; swap to production key for release.
 */

import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { ENV } from '../config/env';

/** Entitlement identifier configured in RevenueCat dashboard */
export const ENTITLEMENT_ID = 'Locked In Inner Circle';

export class PaywallService {
  private static _initialized = false;

  /**
   * Initialize the RevenueCat SDK.
   * Call once during app boot. Idempotent — safe to call multiple times.
   */
  static async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      // Enable verbose logging in dev for debugging
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
      }

      const apiKey =
        Platform.OS === 'ios'
          ? ENV.REVENUECAT_IOS_API_KEY
          : ENV.REVENUECAT_API_KEY;

      Purchases.configure({ apiKey });

      this._initialized = true;
      console.log('[PaywallService] RevenueCat initialized');
    } catch (err) {
      console.warn('[PaywallService] Failed to initialize RevenueCat:', err);
    }
  }

  /**
   * Check if the current user has an active premium entitlement.
   */
  static async isPremium(): Promise<boolean> {
    try {
      const info = await Purchases.getCustomerInfo();
      return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (err) {
      console.warn('[PaywallService] Failed to check entitlement:', err);
      return false;
    }
  }

  /**
   * Fetch available offerings (products/packages) from RevenueCat.
   * Returns null if unavailable.
   */
  static async getOfferings(): Promise<PurchasesOfferings | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings;
    } catch (err) {
      console.warn('[PaywallService] Failed to fetch offerings:', err);
      return null;
    }
  }

  /**
   * Purchase a package from the current offering.
   * Returns true if the purchase grants premium access.
   */
  static async purchasePackage(pkg: any): Promise<boolean> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (err: any) {
      // User cancelled — not an error
      if (err.userCancelled) {
        return false;
      }
      console.warn('[PaywallService] Purchase failed:', err);
      return false;
    }
  }

  /**
   * Restore previous purchases (e.g. after reinstall).
   * Returns true if premium entitlement was restored.
   */
  static async restorePurchases(): Promise<boolean> {
    try {
      const info = await Purchases.restorePurchases();
      return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (err) {
      console.warn('[PaywallService] Restore failed:', err);
      return false;
    }
  }

  /**
   * Get current customer info (entitlements, subscriptions, etc.).
   */
  static async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      return await Purchases.getCustomerInfo();
    } catch (err) {
      console.warn('[PaywallService] Failed to get customer info:', err);
      return null;
    }
  }

  /**
   * Identify a user after authentication (links anonymous → known user).
   * Call this when a user signs in with an email/account.
   */
  static async identify(userId: string): Promise<void> {
    try {
      await Purchases.logIn(userId);
    } catch (err) {
      console.warn('[PaywallService] Failed to identify user:', err);
    }
  }

  /**
   * Log out the current user (revert to anonymous).
   */
  static async logout(): Promise<void> {
    try {
      await Purchases.logOut();
    } catch (err) {
      console.warn('[PaywallService] Failed to logout:', err);
    }
  }
}
