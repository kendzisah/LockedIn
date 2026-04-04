/**
 * App Store listing: Locked In: Mental Conditioning
 * Override with EXPO_PUBLIC_IOS_APP_STORE_URL if needed (e.g. staging).
 */
const DEFAULT_APP_STORE_PAGE =
  'https://apps.apple.com/us/app/locked-in-mental-conditioning/id6759698565';

export const IOS_APP_STORE_PAGE_URL =
  typeof process.env.EXPO_PUBLIC_IOS_APP_STORE_URL === 'string' &&
  process.env.EXPO_PUBLIC_IOS_APP_STORE_URL.trim()
    ? process.env.EXPO_PUBLIC_IOS_APP_STORE_URL.trim()
    : DEFAULT_APP_STORE_PAGE;

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://locked-in.co/privacy';

export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://locked-in.co/terms';

export function iosAppStoreReviewUrl(): string {
  const base = IOS_APP_STORE_PAGE_URL.replace(/\/$/, '');
  return `${base}?action=write-review`;
}

export function iosShareMessage(): string {
  return `I've been using Locked In to build discipline and stay focused. Check it out: ${IOS_APP_STORE_PAGE_URL}`;
}
