/**
 * bulk-upload.ts — Upload 90 days of Lock In / Reflection audio to Supabase.
 *
 * Reads metadata from v1/json/day-XX.json, reads actual MP3 durations via
 * music-metadata, uploads files to Supabase Storage, and upserts audio_tracks rows.
 *
 * Usage:
 *   npx tsx scripts/bulk-upload.ts              # full upload
 *   npx tsx scripts/bulk-upload.ts --dry-run    # validate only, no writes
 *
 * Env: reads from scripts/.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseFile } from 'music-metadata';
import * as dotenv from 'dotenv';

// ── Load env ──
dotenv.config({ path: path.resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env');
  process.exit(1);
}

// ── Config ──
const DRY_RUN = process.argv.includes('--dry-run');
const V1_DIR = path.resolve(__dirname, '..', 'v1');
const AUDIO_DIR = path.join(V1_DIR, 'audio');
const JSON_DIR = path.join(V1_DIR, 'json');
const MANIFEST_PATH = path.join(V1_DIR, 'manifest.json');
const STORAGE_BUCKET = 'audio';
const SCRIPT_VERSION = 'v1';
const TOTAL_DAYS = 90;

// ── Types ──
interface DayMeta {
  day: number;
  theme: string;
  core_tenet: string;
  lock_in: { title: string };
  reflection: { title: string };
}

interface Manifest {
  voice_id: string;
}

interface TrackUpload {
  dayNumber: number;
  category: 'lock_in' | 'unlock';
  title: string;
  coreTenet: string;
  localPath: string;
  storagePath: string;
  durationSeconds: number;
  voiceId: string;
}

interface AuditResult {
  uploaded: number;
  skipped: number;
  failed: number;
  gaps: number[];
  durations: { min: number; max: number; avg: number };
}

// ── Helpers ──

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

async function getAudioDuration(filePath: string): Promise<number> {
  const metadata = await parseFile(filePath);
  return Math.round(metadata.format.duration ?? 0);
}

async function uploadToStorage(
  client: SupabaseClient,
  storagePath: string,
  localPath: string,
): Promise<boolean> {
  const fileBuffer = fs.readFileSync(localPath);
  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (error) {
    console.error(`  [STORAGE FAIL] ${storagePath}: ${error.message}`);
    return false;
  }
  return true;
}

async function upsertTrack(
  client: SupabaseClient,
  track: TrackUpload,
): Promise<boolean> {
  try {
    // Check if a matching active track already exists
    const { data: existing, error: selectErr } = await client
      .from('audio_tracks')
      .select('id')
      .eq('day_number', track.dayNumber)
      .eq('category', track.category)
      .eq('script_version', SCRIPT_VERSION)
      .eq('is_active', true)
      .maybeSingle();

    if (selectErr) {
      console.error(`  [DB FAIL] Day ${track.dayNumber} ${track.category}: ${selectErr.message}`);
      return false;
    }

    if (existing) {
      // Update existing row
      const { error: updateErr } = await client
        .from('audio_tracks')
        .update({
          title: track.title,
          storage_bucket: STORAGE_BUCKET,
          storage_path: track.storagePath,
          duration_seconds: track.durationSeconds,
          voice_id: track.voiceId,
          sort_order: track.dayNumber,
          core_tenet: track.coreTenet,
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error(`  [DB FAIL] Day ${track.dayNumber} ${track.category}: ${updateErr.message}`);
        return false;
      }
    } else {
      // Insert new row
      const { error: insertErr } = await client.from('audio_tracks').insert({
        title: track.title,
        category: track.category,
        storage_bucket: STORAGE_BUCKET,
        storage_path: track.storagePath,
        duration_seconds: track.durationSeconds,
        voice_id: track.voiceId,
        script_version: SCRIPT_VERSION,
        day_number: track.dayNumber,
        sort_order: track.dayNumber,
        is_active: true,
        core_tenet: track.coreTenet,
      });

      if (insertErr) {
        console.error(`  [DB FAIL] Day ${track.dayNumber} ${track.category}: ${insertErr.message}`);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error(`  [DB FAIL] Day ${track.dayNumber} ${track.category}: ${err}`);
    return false;
  }
}

// ── Main ──

async function main(): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Lock In — Bulk Audio Upload${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Read manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found: ${MANIFEST_PATH}`);
    process.exit(1);
  }
  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  console.log(`Voice ID: ${manifest.voice_id}`);
  console.log(`Script version: ${SCRIPT_VERSION}`);
  console.log(`Source: ${V1_DIR}\n`);

  // Create Supabase client
  const client = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // Collect tracks to upload
  const tracks: TrackUpload[] = [];
  const gaps: number[] = [];
  const allDurations: number[] = [];

  console.log('── Validating files ──\n');

  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const dayStr = pad(day);
    const jsonPath = path.join(JSON_DIR, `day-${dayStr}.json`);

    // Check JSON exists
    if (!fs.existsSync(jsonPath)) {
      console.warn(`  [GAP] Day ${day}: missing JSON metadata`);
      gaps.push(day);
      continue;
    }

    const meta: DayMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Process lock_in + reflection (unlock)
    const phases: Array<{
      category: 'lock_in' | 'unlock';
      sourceFile: string;
      title: string;
      storageFile: string;
    }> = [
      {
        category: 'lock_in',
        sourceFile: `day-${dayStr}-lock-in.mp3`,
        title: meta.lock_in.title,
        storageFile: 'lock_in.mp3',
      },
      {
        category: 'unlock',
        sourceFile: `day-${dayStr}-reflection.mp3`,
        title: meta.reflection.title,
        storageFile: 'unlock.mp3',
      },
    ];

    let dayValid = true;

    for (const p of phases) {
      const localPath = path.join(AUDIO_DIR, p.sourceFile);

      if (!fs.existsSync(localPath)) {
        console.warn(`  [GAP] Day ${day} ${p.category}: missing ${p.sourceFile}`);
        dayValid = false;
        continue;
      }

      const stat = fs.statSync(localPath);
      if (stat.size === 0) {
        console.warn(`  [GAP] Day ${day} ${p.category}: empty file`);
        dayValid = false;
        continue;
      }

      let duration: number;
      try {
        duration = await getAudioDuration(localPath);
      } catch (err) {
        console.warn(`  [GAP] Day ${day} ${p.category}: cannot read duration — ${err}`);
        dayValid = false;
        continue;
      }

      if (duration <= 0) {
        console.warn(`  [GAP] Day ${day} ${p.category}: duration is 0`);
        dayValid = false;
        continue;
      }

      const storagePath = `v1/day-${dayStr}/${p.storageFile}`;

      tracks.push({
        dayNumber: day,
        category: p.category,
        title: p.title,
        coreTenet: meta.core_tenet,
        localPath,
        storagePath,
        durationSeconds: duration,
        voiceId: manifest.voice_id,
      });

      allDurations.push(duration);
      console.log(`  [OK] Day ${day} ${p.category}: ${duration}s — ${p.title}`);
    }

    if (!dayValid) {
      gaps.push(day);
    }
  }

  console.log(`\n── Validation Summary ──\n`);
  console.log(`  Tracks to upload: ${tracks.length} / ${TOTAL_DAYS * 2}`);
  console.log(`  Gaps: ${gaps.length > 0 ? gaps.join(', ') : 'none'}`);

  if (allDurations.length > 0) {
    const minD = Math.min(...allDurations);
    const maxD = Math.max(...allDurations);
    const avgD = Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length);
    console.log(`  Duration range: ${minD}s – ${maxD}s (avg ${avgD}s)`);
  }

  if (DRY_RUN) {
    console.log(`\n  DRY RUN — no changes made.\n`);
    return;
  }

  if (tracks.length === 0) {
    console.log(`\n  Nothing to upload.\n`);
    return;
  }

  // ── Upload ──
  console.log(`\n── Uploading ──\n`);

  const audit: AuditResult = {
    uploaded: 0,
    skipped: 0,
    failed: 0,
    gaps,
    durations: {
      min: Math.min(...allDurations),
      max: Math.max(...allDurations),
      avg: Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length),
    },
  };

  for (const track of tracks) {
    process.stdout.write(`  Day ${track.dayNumber} ${track.category}... `);

    // 1. Upload to storage
    const storageOk = await uploadToStorage(client, track.storagePath, track.localPath);
    if (!storageOk) {
      audit.failed++;
      continue;
    }

    // 2. Upsert DB row
    const dbOk = await upsertTrack(client, track);
    if (!dbOk) {
      audit.failed++;
      continue;
    }

    audit.uploaded++;
    console.log('OK');
  }

  // ── Final Report ──
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Upload Complete`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Uploaded:  ${audit.uploaded}`);
  console.log(`  Failed:    ${audit.failed}`);
  console.log(`  Gaps:      ${audit.gaps.length > 0 ? audit.gaps.join(', ') : 'none'}`);
  console.log(`  Duration:  ${audit.durations.min}s – ${audit.durations.max}s (avg ${audit.durations.avg}s)`);
  console.log();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
