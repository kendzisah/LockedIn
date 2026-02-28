import { requireNativeModule, Platform } from 'expo-modules-core';
import type { AuthorizationStatus } from './ScreenTime.types';

export type { AuthorizationStatus } from './ScreenTime.types';

const IS_IOS = Platform.OS === 'ios';

interface ScreenTimeNativeModule {
  requestAuthorization(): Promise<string>;
  getAuthorizationStatus(): string;
  showAppPicker(): Promise<number>;
  shieldApps(): void;
  removeShield(): void;
  isShielding(): boolean;
  getSelectedAppCount(): number;
}

const NativeModule: ScreenTimeNativeModule | null = IS_IOS
  ? requireNativeModule('ScreenTime')
  : null;

function assertIOS(mod: ScreenTimeNativeModule | null): asserts mod is ScreenTimeNativeModule {
  if (!mod) {
    throw new Error('ScreenTime module is only available on iOS');
  }
}

export async function requestAuthorization(): Promise<AuthorizationStatus> {
  assertIOS(NativeModule);
  const result = await NativeModule.requestAuthorization();
  return result as AuthorizationStatus;
}

export function getAuthorizationStatus(): AuthorizationStatus {
  if (!NativeModule) return 'not_determined';
  return NativeModule.getAuthorizationStatus() as AuthorizationStatus;
}

export async function showAppPicker(): Promise<number> {
  assertIOS(NativeModule);
  return NativeModule.showAppPicker();
}

export function shieldApps(): void {
  if (!NativeModule) return;
  NativeModule.shieldApps();
}

export function removeShield(): void {
  if (!NativeModule) return;
  NativeModule.removeShield();
}

export function isShielding(): boolean {
  if (!NativeModule) return false;
  return NativeModule.isShielding();
}

export function getSelectedAppCount(): number {
  if (!NativeModule) return 0;
  return NativeModule.getSelectedAppCount();
}
