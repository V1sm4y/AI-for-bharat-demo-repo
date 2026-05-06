/**
 * Environment configuration
 *
 * Values are read from EXPO_PUBLIC_* env vars (set in .env at project root).
 * Expo SDK 49+ automatically exposes EXPO_PUBLIC_* vars to the JS bundle.
 *
 * Fill in your actual values in .env — never commit real secrets to source control.
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BACKEND_API_KEY = process.env.EXPO_PUBLIC_BACKEND_API_KEY;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validation helper
const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    new URL(url);
    return !url.includes('your-project-ref');
  } catch {
    return false;
  }
};

if (!BACKEND_URL) {
  console.warn(
    '[env] EXPO_PUBLIC_BACKEND_URL is not set.'
  );
}

if (!isValidUrl(SUPABASE_URL)) {
  console.warn(
    '[env] EXPO_PUBLIC_SUPABASE_URL is missing or contains placeholder values.'
  );
}

export const ENV = {
  BACKEND_URL: BACKEND_URL ?? '',
  BACKEND_API_KEY: BACKEND_API_KEY ?? '',
  SUPABASE_URL: isValidUrl(SUPABASE_URL) ? SUPABASE_URL! : 'https://placeholder-project.supabase.co',
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ?? '',
} as const;

