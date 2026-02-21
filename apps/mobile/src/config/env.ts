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
    throw new Error(
      `[ENV] Missing required environment variable: ${key}. ` +
        'Ensure it is set in apps/mobile/.env',
    );
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

  /** Superwall API key (optional for now) */
  SUPERWALL_API_KEY: process.env.EXPO_PUBLIC_SUPERWALL_API_KEY ?? '',
};
