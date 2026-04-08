import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { SubscriptionService } from '../../services/SubscriptionService';
import { Analytics } from '../../services/AnalyticsService';
import { useAuth } from '../auth/AuthProvider';
import { subscribeLogoutCleanup } from '../../services/logoutCleanupBus';

interface SubscriptionContextValue {
  isSubscribed: boolean;
  isLoading: boolean;
  showPaywall: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated, isAnonymous } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);
  const loggedInUserIdRef = useRef<string | null>(null);
  const lastPeriodTypeRef = useRef<string | null>(null);
  const prevCustomerInfoRef = useRef<CustomerInfo | null>(null);

  useEffect(() => {
    mounted.current = true;
    let removeListener: (() => void) | undefined;

    async function init() {
      await SubscriptionService.initialize();

      if (!mounted.current) return;

      // Identify user in Mixpanel with RevenueCat anonymous ID
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        const userId = customerInfo.originalAppUserId;
        if (userId) {
          await Analytics.identify(userId);
          await Analytics.setUserPropertiesOnce({ '$name': userId, first_seen: new Date().toISOString() });
        }
      } catch {}

      removeListener = SubscriptionService.addListener((info) => {
        if (!mounted.current) return;
        const wasSubscribed = SubscriptionService.hasEntitlement(prevCustomerInfoRef.current);
        const entitled = SubscriptionService.hasEntitlement(info);
        setIsSubscribed(entitled);

        if (entitled) {
          // Detect trial → paid conversion
          const entitlement = info.entitlements.active[SubscriptionService.ENTITLEMENT_ID];
          const currentPeriod = entitlement?.periodType ?? null;
          const productId = entitlement?.productIdentifier ?? 'unknown';
          if (lastPeriodTypeRef.current === 'TRIAL' && currentPeriod === 'NORMAL') {
            Analytics.trackAF('af_subscribe', { af_content_id: productId });
            Analytics.track('Subscription Converted', { product_id: productId, from_trial: true });
          }
          lastPeriodTypeRef.current = currentPeriod;
        } else if (wasSubscribed && !entitled) {
          // Lost entitlement — subscription expired or cancelled
          const prevEntitlement = prevCustomerInfoRef.current?.entitlements.all?.[SubscriptionService.ENTITLEMENT_ID];
          const wasTrial = lastPeriodTypeRef.current === 'TRIAL';
          Analytics.track('Subscription Expired', {
            product_id: prevEntitlement?.productIdentifier ?? 'unknown',
            was_trial: wasTrial,
          });
          lastPeriodTypeRef.current = null;
        }

        prevCustomerInfoRef.current = info;
      });

      const initInfo = await Purchases.getCustomerInfo();
      prevCustomerInfoRef.current = initInfo;
      const subscribed = SubscriptionService.hasEntitlement(initInfo);
      if (subscribed) {
        const ent = initInfo.entitlements.active[SubscriptionService.ENTITLEMENT_ID];
        lastPeriodTypeRef.current = ent?.periodType ?? null;
      }
      if (mounted.current) {
        setIsSubscribed(subscribed);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      mounted.current = false;
      removeListener?.();
    };
  }, []);

  // Sync RevenueCat identity with Supabase auth state.
  // When user links an account (anonymous → authenticated), call Purchases.logIn()
  // to transfer any anonymous subscription to the authenticated user ID.
  useEffect(() => {
    if (!SubscriptionService.isInitialized() || isLoading) return;

    async function syncRevenueCatIdentity() {
      if (isAuthenticated && user?.id && loggedInUserIdRef.current !== user.id) {
        loggedInUserIdRef.current = user.id;
        const subscribed = await SubscriptionService.logIn(user.id);
        if (mounted.current) setIsSubscribed(subscribed);
      }
    }

    syncRevenueCatIdentity();
  }, [isAuthenticated, user?.id, isLoading]);

  // On logout, reset RevenueCat to anonymous and clear cached state
  useEffect(() => {
    const unsubscribe = subscribeLogoutCleanup(() => {
      loggedInUserIdRef.current = null;
      SubscriptionService.logOut();
      setIsSubscribed(false);
    });
    return unsubscribe;
  }, []);

  // Keep Mixpanel super properties and user profile in sync with subscription status
  useEffect(() => {
    if (isLoading) return;
    Analytics.setIsSubscribed(isSubscribed);
    Analytics.registerSuperProperties({ is_subscribed: isSubscribed });
    Analytics.setUserProperties({ is_subscribed: isSubscribed });
  }, [isSubscribed, isLoading]);

  const showPaywall = useCallback(async (): Promise<boolean> => {
    try {
      const wasPreviouslySubscribed = isSubscribed;
      console.log('[SubscriptionProvider] Presenting RevenueCat paywall...');
      await RevenueCatUI.presentPaywall();
      console.log('[SubscriptionProvider] Paywall dismissed, checking subscription...');
      const info = await Purchases.getCustomerInfo();
      const subscribed = SubscriptionService.hasEntitlement(info);
      if (mounted.current) setIsSubscribed(subscribed);

      // Track trial vs paid subscription for new subscribers only
      if (subscribed && !wasPreviouslySubscribed) {
        const entitlement = info.entitlements.active[SubscriptionService.ENTITLEMENT_ID];
        const productId = entitlement?.productIdentifier ?? 'unknown';
        if (entitlement?.periodType === 'TRIAL') {
          Analytics.trackAF('af_start_trial', { af_content_id: productId });
          Analytics.track('Trial Started', { product_id: productId });
        } else {
          Analytics.trackAF('af_subscribe', { af_content_id: productId });
          Analytics.track('Subscription Converted', { product_id: productId, from_trial: false });
        }
      }

      return subscribed;
    } catch (e) {
      console.warn('[SubscriptionProvider] showPaywall failed:', e);
      return false;
    }
  }, [isSubscribed]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const subscribed = await SubscriptionService.restore();
      if (mounted.current) setIsSubscribed(subscribed);
      return subscribed;
    } catch {
      return false;
    }
  }, []);

  const contextValue = useMemo(
    () => ({ isSubscribed, isLoading, showPaywall, restorePurchases }),
    [isSubscribed, isLoading, showPaywall, restorePurchases],
  );

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
