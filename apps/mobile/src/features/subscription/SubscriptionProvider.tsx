import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import RevenueCatUI from 'react-native-purchases-ui';
import { SubscriptionService } from '../../services/SubscriptionService';

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
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    async function init() {
      await SubscriptionService.initialize();
      const subscribed = await SubscriptionService.checkSubscription();
      if (mounted.current) {
        setIsSubscribed(subscribed);
        setIsLoading(false);
      }
    }

    init();

    const removeListener = SubscriptionService.addListener((info) => {
      if (mounted.current) {
        setIsSubscribed(SubscriptionService.hasEntitlement(info));
      }
    });

    return () => {
      mounted.current = false;
      removeListener();
    };
  }, []);

  const showPaywall = useCallback(async (): Promise<boolean> => {
    try {
      await RevenueCatUI.presentPaywall();
      const subscribed = await SubscriptionService.checkSubscription();
      if (mounted.current) setIsSubscribed(subscribed);
      return subscribed;
    } catch {
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
