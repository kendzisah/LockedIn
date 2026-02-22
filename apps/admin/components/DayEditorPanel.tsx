'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '../lib/supabase-browser';

// ── Types ──

interface TrackRow {
  id: string;
  title: string;
  category: string;
  storage_path: string;
  duration_seconds: number;
  core_tenet: string | null;
  voice_id: string | null;
  script_version: string | null;
  created_at: string;
}

interface DayEditorPanelProps {
  dayNumber: number | null;
}

type Phase = 'lock_in' | 'unlock';

// ── Helpers ──

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

// ── Component ──

export function DayEditorPanel({ dayNumber }: DayEditorPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  // Current tracks for the selected day
  const [lockInTrack, setLockInTrack] = useState<TrackRow | null>(null);
  const [unlockTrack, setUnlockTrack] = useState<TrackRow | null>(null);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Upload form state
  const [phase, setPhase] = useState<Phase>('lock_in');
  const [title, setTitle] = useState('');
  const [coreTenet, setCoreTenet] = useState('');
  const [scriptVersion, setScriptVersion] = useState('v1');
  const [file, setFile] = useState<File | null>(null);
  const [audioInfo, setAudioInfo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch current tracks for selected day
  const fetchTracks = useCallback(async () => {
    if (!dayNumber) return;

    setLoadingTracks(true);
    const supabase = getBrowserSupabase();
    const { data } = await supabase
      .from('audio_tracks')
      .select('id, title, category, storage_path, duration_seconds, core_tenet, voice_id, script_version, created_at')
      .eq('day_number', dayNumber)
      .eq('is_active', true);

    const tracks = (data ?? []) as unknown as TrackRow[];
    setLockInTrack(tracks.find((t) => t.category === 'lock_in') ?? null);
    setUnlockTrack(tracks.find((t) => t.category === 'unlock') ?? null);
    setLoadingTracks(false);

    // Pre-fill core tenet from existing tracks
    const existing = tracks[0];
    if (existing?.core_tenet) {
      setCoreTenet(existing.core_tenet);
    }
  }, [dayNumber]);

  useEffect(() => {
    if (dayNumber) {
      fetchTracks();
      setStatus(null);
      setFile(null);
      setTitle('');
      setAudioInfo(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [dayNumber, fetchTracks]);

  // Prefill title from existing track when switching phase
  useEffect(() => {
    const track = phase === 'lock_in' ? lockInTrack : unlockTrack;
    if (track) {
      setTitle(track.title);
      if (track.script_version) setScriptVersion(track.script_version);
    } else {
      setTitle('');
    }
  }, [phase, lockInTrack, unlockTrack]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setAudioInfo(null);

    if (selected) {
      const audio = new Audio(URL.createObjectURL(selected));
      audio.addEventListener('loadedmetadata', () => {
        const actualSeconds = Math.round(audio.duration);
        setAudioInfo(`${formatDuration(actualSeconds)}`);
      });
    }
  }

  async function handleUpload() {
    setShowConfirm(true);
  }

  async function confirmUpload() {
    setShowConfirm(false);

    if (!file || !dayNumber || !title) {
      setStatus('Title and audio file are required.');
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const ext = file.name.split('.').pop();
      const storagePath = `program/day_${String(dayNumber).padStart(2, '0')}/${phase}.${ext}`;

      // 1. Get signed upload URL
      const urlRes = await fetch('/api/signed-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'audio', path: storagePath }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error);

      // 2. Upload file to storage
      const uploadRes = await fetch(urlData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload to storage failed');

      // 3. Read audio duration
      const audioDuration = await new Promise<number>((resolve) => {
        const a = new Audio(URL.createObjectURL(file));
        a.addEventListener('loadedmetadata', () => resolve(Math.round(a.duration)));
      });

      const supabase = getBrowserSupabase();

      // 4. Check for existing track (select-then-upsert for partial index compat)
      const { data: existingData } = await supabase
        .from('audio_tracks')
        .select('id')
        .eq('day_number', dayNumber)
        .eq('category', phase)
        .eq('is_active', true)
        .maybeSingle();

      const existing = existingData as unknown as { id: string } | null;

      if (existing) {
        // Update existing track in place
        const { error: updateErr } = await supabase
          .from('audio_tracks')
          .update({
            title,
            storage_path: storagePath,
            duration_seconds: audioDuration,
            core_tenet: coreTenet || null,
            script_version: scriptVersion || null,
          } as Record<string, unknown>)
          .eq('id', existing.id);

        if (updateErr) throw new Error(updateErr.message);
      } else {
        // Insert new track
        const { error: insertErr } = await supabase
          .from('audio_tracks')
          .insert({
            title,
            category: phase,
            storage_bucket: 'audio',
            storage_path: storagePath,
            duration_seconds: audioDuration,
            day_number: dayNumber,
            core_tenet: coreTenet || null,
            script_version: scriptVersion || null,
            sort_order: dayNumber,
            is_active: true,
          } as Record<string, unknown>)
          .select('id')
          .single();

        if (insertErr) throw new Error(insertErr.message);
      }

      // 5. If core_tenet was set, also update the other phase's track
      if (coreTenet) {
        const otherPhase: Phase = phase === 'lock_in' ? 'unlock' : 'lock_in';
        const { data: otherData } = await supabase
          .from('audio_tracks')
          .select('id')
          .eq('day_number', dayNumber)
          .eq('category', otherPhase)
          .eq('is_active', true)
          .maybeSingle();

        const other = otherData as unknown as { id: string } | null;
        if (other) {
          await supabase
            .from('audio_tracks')
            .update({ core_tenet: coreTenet } as Record<string, unknown>)
            .eq('id', other.id);
        }
      }

      setStatus('✓ Track updated successfully');
      setFile(null);
      setAudioInfo(null);
      if (fileRef.current) fileRef.current.value = '';

      // Refresh grid + local state
      fetchTracks();
      window.dispatchEvent(new CustomEvent('program-grid-refresh'));
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  // ── Update metadata only (no new audio file) ──

  async function handleUpdateMetadata() {
    if (!dayNumber || !title) {
      setStatus('Title is required.');
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const supabase = getBrowserSupabase();

      const { data: existingData } = await supabase
        .from('audio_tracks')
        .select('id')
        .eq('day_number', dayNumber)
        .eq('category', phase)
        .eq('is_active', true)
        .maybeSingle();

      const existing = existingData as unknown as { id: string } | null;
      if (!existing) {
        setStatus('No existing track to update. Upload audio first.');
        setUploading(false);
        return;
      }

      const { error } = await supabase
        .from('audio_tracks')
        .update({
          title,
          core_tenet: coreTenet || null,
          script_version: scriptVersion || null,
        } as Record<string, unknown>)
        .eq('id', existing.id);

      if (error) throw new Error(error.message);

      // Sync core_tenet to other phase
      if (coreTenet) {
        const otherPhase: Phase = phase === 'lock_in' ? 'unlock' : 'lock_in';
        const { data: otherData } = await supabase
          .from('audio_tracks')
          .select('id')
          .eq('day_number', dayNumber)
          .eq('category', otherPhase)
          .eq('is_active', true)
          .maybeSingle();

        const other = otherData as unknown as { id: string } | null;
        if (other) {
          await supabase
            .from('audio_tracks')
            .update({ core_tenet: coreTenet } as Record<string, unknown>)
            .eq('id', other.id);
        }
      }

      setStatus('✓ Metadata updated');
      fetchTracks();
      window.dispatchEvent(new CustomEvent('program-grid-refresh'));
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  // ── Render ──

  if (!dayNumber) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6">
        <p className="text-text-secondary text-sm">Select a day from the grid to view or edit its content.</p>
      </div>
    );
  }

  const currentTrack = phase === 'lock_in' ? lockInTrack : unlockTrack;

  return (
    <>
      <div className="bg-surface border border-border rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Day {dayNumber}
          </h3>
          <div className="flex gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${lockInTrack ? 'bg-status-green' : 'bg-status-red/40'}`}
                  title={lockInTrack ? 'Lock In uploaded' : 'Lock In missing'} />
            <span className={`w-2.5 h-2.5 rounded-full ${unlockTrack ? 'bg-status-green' : 'bg-status-red/40'}`}
                  title={unlockTrack ? 'Unlock uploaded' : 'Unlock missing'} />
          </div>
        </div>

        {/* Current tracks summary */}
        {loadingTracks ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-border rounded w-48" />
            <div className="h-4 bg-border rounded w-40" />
          </div>
        ) : (
          <div className="space-y-2">
            {[
              { label: 'Lock In', track: lockInTrack },
              { label: 'Unlock', track: unlockTrack },
            ].map(({ label, track }) => (
              <div key={label} className="bg-background rounded-md p-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-xs">{label}</span>
                  {track ? (
                    <span className="text-status-green text-xs">✓</span>
                  ) : (
                    <span className="text-status-red text-xs">Missing</span>
                  )}
                </div>
                {track && (
                  <div className="mt-1">
                    <p className="font-medium text-xs truncate">{track.title}</p>
                    <p className="text-text-secondary text-[10px]">
                      {formatDuration(track.duration_seconds)}
                      {track.script_version && ` · ${track.script_version}`}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {(lockInTrack?.core_tenet || unlockTrack?.core_tenet) && (
              <div className="bg-background rounded-md p-2.5 text-sm">
                <span className="text-text-secondary text-xs">Core Tenet</span>
                <p className="text-xs mt-0.5">{lockInTrack?.core_tenet || unlockTrack?.core_tenet}</p>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Edit / Replace form */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {currentTrack ? 'Replace Track' : 'Upload Track'}
          </h4>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Phase</label>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as Phase)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="lock_in">Lock In</option>
              <option value="unlock">Unlock (Reflection)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title..."
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Core Tenet</label>
            <input
              type="text"
              value={coreTenet}
              onChange={(e) => setCoreTenet(e.target.value)}
              placeholder="e.g. Discipline is earned..."
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-text-secondary text-[10px] mt-0.5">
              Applied to both Lock In & Unlock for this day.
            </p>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Script Version</label>
            <input
              type="text"
              value={scriptVersion}
              onChange={(e) => setScriptVersion(e.target.value)}
              placeholder="v1"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Audio File (MP3)</label>
            <input
              ref={fileRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp3"
              onChange={handleFileChange}
              className="w-full text-sm text-text-secondary file:mr-3 file:px-3 file:py-1.5
                         file:bg-surface file:border file:border-border file:rounded-md
                         file:text-text-primary file:text-sm file:cursor-pointer
                         hover:file:bg-border transition-colors"
            />
            {audioInfo && (
              <p className="text-text-secondary text-xs mt-1">Duration: {audioInfo}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {currentTrack && (
            <button
              onClick={handleUpdateMetadata}
              disabled={uploading || !title}
              className="flex-1 py-2 px-3 bg-surface border border-border rounded-md text-sm
                         hover:bg-border transition-colors disabled:opacity-50"
            >
              Update Metadata
            </button>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading || !file || !title}
            className="flex-1 py-2 px-3 bg-accent hover:bg-accent-hover text-white rounded-md text-sm
                       font-medium transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : file ? 'Upload & Replace' : 'Select file first'}
          </button>
        </div>

        {status && (
          <p className={`text-sm ${status.startsWith('✓') ? 'text-status-green' : 'text-status-red'}`}>
            {status}
          </p>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold">Confirm Upload</h3>
            <div className="space-y-2 text-sm">
              <p className="text-text-secondary">
                {currentTrack
                  ? 'This will replace the existing track:'
                  : 'This will add a new track:'}
              </p>
              <div className="bg-background rounded-md p-3 space-y-1">
                <p><span className="text-text-secondary">Day:</span> {dayNumber}</p>
                <p><span className="text-text-secondary">Phase:</span> {phase === 'lock_in' ? 'Lock In' : 'Unlock'}</p>
                <p><span className="text-text-secondary">Title:</span> {title}</p>
                {coreTenet && <p><span className="text-text-secondary">Tenet:</span> {coreTenet}</p>}
                {audioInfo && <p><span className="text-text-secondary">Duration:</span> {audioInfo}</p>}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 px-3 bg-surface border border-border rounded-md text-sm
                           hover:bg-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpload}
                className="flex-1 py-2 px-3 bg-accent hover:bg-accent-hover text-white rounded-md text-sm
                           font-medium transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
