import type { SupabaseClient } from '@supabase/supabase-js';

const SIGNED_URL_TTL = 900; // 15 minutes

/** Generate a short-lived signed URL for audio playback */
export async function getSignedAudioUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? 'unknown'}`);
  }

  return data.signedUrl;
}

/** Generate a signed upload URL (admin server-side only) */
export async function getSignedUploadUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create upload URL: ${error?.message ?? 'unknown'}`);
  }

  return data.signedUrl;
}
