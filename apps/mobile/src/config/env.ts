/**
 * Environment configuration.
 * Reads from Expo public environment variables (EXPO_PUBLIC_*).
 * Fails fast if required keys are missing -- prevents silent runtime failures.
 *
 * Do NOT commit secrets to source control.
 */

function requireEnv(key: string, value: string | undefined): string {
  if (!value) {
    console.warn(
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
  SUPABASE_URL: requireEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),

  /** Supabase anonymous/public key */
  SUPABASE_ANON_KEY: requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),

  /**
   * Password reset deep link / web URL (must be listed under Supabase Auth → URL Configuration → Redirect URLs).
   * Falls back to app scheme if unset.
   */
  SUPABASE_PASSWORD_RESET_REDIRECT:
    process.env.EXPO_PUBLIC_SUPABASE_PASSWORD_RESET_REDIRECT?.trim() || 'lockedin://auth/reset-password',

  /** RevenueCat iOS API key */
  REVENUECAT_IOS_API_KEY: requireEnv(
    'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  ),

  /** AppsFlyer dev key */
  APPSFLYER_DEV_KEY: requireEnv(
    'EXPO_PUBLIC_APPSFLYER_DEV_KEY',
    process.env.EXPO_PUBLIC_APPSFLYER_DEV_KEY,
  ),

  /** AppsFlyer iOS app ID */
  APPSFLYER_APP_ID: requireEnv(
    'EXPO_PUBLIC_APPSFLYER_APP_ID',
    process.env.EXPO_PUBLIC_APPSFLYER_APP_ID,
  ),
};
