import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Purchases from 'react-native-purchases';
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
        if (mounted.current) {
          setIsSubscribed(SubscriptionService.hasEntitlement(info));
        }
      });

      const subscribed = await SubscriptionService.checkSubscription();
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
    Analytics.registerSuperProperties({ is_subscribed: isSubscribed });
    Analytics.setUserProperties({ is_subscribed: isSubscribed });
  }, [isSubscribed, isLoading]);

  const showPaywall = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[SubscriptionProvider] Presenting RevenueCat paywall...');
      await RevenueCatUI.presentPaywall();
      console.log('[SubscriptionProvider] Paywall dismissed, checking subscription...');
      const subscribed = await SubscriptionService.checkSubscription();
      if (mounted.current) setIsSubscribed(subscribed);
      return subscribed;
    } catch (e) {
      console.warn('[SubscriptionProvider] showPaywall failed:', e);
      return false;
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const subscribed = await SubscriptionService.restore();
      if (mounted.current) setIsSubscribed(subscribed);
      return subscribed;
    } catch {
      return false;
    }
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{ isSubscribed, isLoading, showPaywall, restorePurchases }}
    >
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
