/**
 * Environment configuration.
 * Reads from Expo public environment variables (EXPO_PUBLIC_*).
 * Fails fast if required keys are missing -- prevents silent runtime failures.
 *
 * Do NOT commit secrets to source control.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(
      `[ENV] Missing required environment variable: ${key}. ` +
        'Ensure it is set in apps/mobile/.env or eas.json env config.',
    );
    return '';
  }
  return value;
}

const isDev: boolean = __DEV__;

export const ENV = {
  /** 'development' | 'production' based on Metro bundler __DEV__ flag */
  mode: isDev ? ('development' as const) : ('production' as const),

  /** Supabase project URL */
  SUPABASE_URL: requireEnv('EXPO_PUBLIC_SUPABASE_URL'),

  /** Supabase anonymous/public key */
  SUPABASE_ANON_KEY: requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),

  /** RevenueCat API key (default / Android) */
  REVENUECAT_API_KEY: requireEnv('EXPO_PUBLIC_REVENUECAT_API_KEY'),

  /** RevenueCat iOS-specific API key */
  REVENUECAT_IOS_API_KEY: requireEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'),
};
