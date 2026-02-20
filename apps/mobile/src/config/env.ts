/**
 * Environment configuration.
 * Placeholder values — replace with real keys when integrating services.
 * Do NOT commit secrets to source control.
 */

const isDev: boolean = __DEV__;

export const ENV = {
  /** 'development' | 'production' based on Metro bundler __DEV__ flag */
  mode: isDev ? 'development' : 'production',

  /** Supabase project URL (fill in when ready) */
  SUPABASE_URL: '',

  /** Supabase anonymous/public key (fill in when ready) */
  SUPABASE_ANON_KEY: '',

  /** Superwall API key (fill in when ready) */
  SUPERWALL_API_KEY: '',
} as const;
