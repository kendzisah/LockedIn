import { Mixpanel } from 'mixpanel-react-native';
import {
  MPSessionReplay,
  MPSessionReplayConfig,
  MPSessionReplayMask,
} from '@mixpanel/react-native-session-replay';

const MIXPANEL_TOKEN = 'a263cb62e1d56ef186da48661697b6a4';

let mp: Mixpanel | null = null;
let identified = false;
let identifyPromise: Promise<void> | null = null;

export const MixpanelService = {
  async initialize(): Promise<void> {
    try {
      mp = new Mixpanel(MIXPANEL_TOKEN, true);
      if (__DEV__) mp.setLoggingEnabled(true);
      await mp.init();

      // Identify with auto-generated distinct ID so People operations work immediately
      const distinctId = await mp.getDistinctId();
      if (distinctId) {
        identifyPromise = mp.identify(distinctId);
        await identifyPromise;
        identified = true;
      }

      // Initialize Session Replay
      try {
        const replayConfig = new MPSessionReplayConfig({
          wifiOnly: false,
          autoStartRecording: true,
          recordingSessionsPercent: 100,
          autoMaskedViews: [MPSessionReplayMask.Image],
          flushInterval: 10,
          enableLogging: __DEV__,
        });
        await MPSessionReplay.initialize(MIXPANEL_TOKEN, distinctId ?? '', replayConfig);
        console.log('[Mixpanel] Session Replay initialized');
      } catch (replayErr) {
        console.warn('[Mixpanel] Session Replay init failed (non-fatal):', replayErr);
      }

      console.log('[Mixpanel] Initialized, distinct_id:', distinctId);
    } catch (e) {
      console.warn('[Mixpanel] init failed:', e);
    }
  },

  track(event: string, properties?: Record<string, unknown>): void {
    try {
      mp?.track(event, properties);
    } catch (e) {
      console.warn(`[Mixpanel] track(${event}) failed:`, e);
    }
  },

  async identify(userId: string): Promise<void> {
    try {
      if (!mp) return;
      identifyPromise = mp.identify(userId);
      await identifyPromise;
      identified = true;
      // Keep Session Replay identity in sync
      try { await MPSessionReplay.identify(userId); } catch {}
      console.log('[Mixpanel] Identified:', userId);
    } catch (e) {
      console.warn('[Mixpanel] identify failed:', e);
    }
  },

  async setUserProperties(props: Record<string, unknown>): Promise<void> {
    try {
      if (!mp) return;
      if (identifyPromise) await identifyPromise;
      mp.getPeople().set(props);
      mp.flush();
      console.log('[Mixpanel] setUserProperties:', Object.keys(props).join(', '));
    } catch (e) {
      console.warn('[Mixpanel] setUserProperties failed:', e);
    }
  },

  async setUserPropertiesOnce(props: Record<string, unknown>): Promise<void> {
    try {
      if (!mp) return;
      if (identifyPromise) await identifyPromise;
      mp.getPeople().setOnce(props);
      mp.flush();
      console.log('[Mixpanel] setUserPropertiesOnce:', Object.keys(props).join(', '));
    } catch (e) {
      console.warn('[Mixpanel] setUserPropertiesOnce failed:', e);
    }
  },

  registerSuperProperties(props: Record<string, unknown>): void {
    try {
      mp?.registerSuperProperties(props);
    } catch (e) {
      console.warn('[Mixpanel] registerSuperProperties failed:', e);
    }
  },

  reset(): void {
    try {
      mp?.reset();
      identified = false;
      identifyPromise = null;
    } catch (e) {
      console.warn('[Mixpanel] reset failed:', e);
    }
  },

  timeEvent(event: string): void {
    try {
      mp?.timeEvent(event);
    } catch (e) {
      console.warn(`[Mixpanel] timeEvent(${event}) failed:`, e);
    }
  },
};
