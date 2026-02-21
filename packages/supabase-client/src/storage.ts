import type { SupabaseClient } from '@supabase/supabase-js';

/** Generate a short-lived signed URL for audio playback.
 *  @param ttlSeconds - URL lifetime; default 1800 (30 min).
 *    SessionRepository passes a duration-aware value:
 *    Math.max(1800, durationMinutes * 60 * 2.5)
 */
export async function getSignedAudioUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
  ttlSeconds: number = 1800,
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);

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
