'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '../lib/supabase-browser';
import { PublishConfirmModal } from './PublishConfirmModal';
import type { ContentPhase } from '@lockedin/shared-types';

const SESSION_DURATION = 5; // all sessions are ~5 min

const PHASES: { value: ContentPhase; label: string }[] = [
  { value: 'lock_in', label: 'Lock In' },
  { value: 'unlock', label: 'Unlock' },
];

export function SlotUploadPanel() {
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(searchParams.get('date') ?? '');
  const [phase, setPhase] = useState<ContentPhase>(
    (searchParams.get('phase') as ContentPhase) ?? 'lock_in',
  );
  const [title, setTitle] = useState('');
  const [scriptVersion, setScriptVersion] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [audioInfo, setAudioInfo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Prefill from URL params when they change
  useEffect(() => {
    if (searchParams.get('date')) setDate(searchParams.get('date')!);
    if (searchParams.get('phase')) setPhase(searchParams.get('phase') as ContentPhase);
  }, [searchParams]);

  // Client-side audio info (advisory only)
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setAudioInfo(null);

    if (selected) {
      const audio = new Audio(URL.createObjectURL(selected));
      audio.addEventListener('loadedmetadata', () => {
        const actualSeconds = Math.round(audio.duration);
        const mins = Math.floor(actualSeconds / 60);
        const secs = actualSeconds % 60;
        setAudioInfo(`Audio length: ${mins}m ${secs}s`);
      });
    }
  }

  async function handleSaveDraft() {
    await doUpload('draft');
  }

  async function handlePublish() {
    setShowConfirm(true);
  }

  async function confirmPublish() {
    setShowConfirm(false);
    await doUpload('published');
  }

  async function doUpload(targetStatus: 'draft' | 'published') {
    if (!file || !date || !title) {
      setStatus('Please fill in all required fields.');
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const storagePath = `tracks/${date}/${phase}.${file.name.split('.').pop()}`;

      // 1. Get signed upload URL from server
      const urlRes = await fetch('/api/signed-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'audio', path: storagePath }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error);

      // 2. Upload file to Storage via signed URL
      const uploadRes = await fetch(urlData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload to storage failed');

      // 3. Create audio_track + scheduled_session via Supabase (uses RLS)
      const supabase = getBrowserSupabase();

      // Read audio duration for the track record
      const audioDuration = await new Promise<number>((resolve) => {
        const a = new Audio(URL.createObjectURL(file));
        a.addEventListener('loadedmetadata', () => resolve(Math.round(a.duration)));
      });

      const { data: trackData, error: trackError } = await supabase
        .from('audio_tracks')
        .insert({
          title,
          category: phase,
          storage_bucket: 'audio',
          storage_path: storagePath,
          duration_seconds: audioDuration,
          script_version: scriptVersion || null,
        } as Record<string, unknown>)
        .select('id')
        .single();

      if (trackError) throw new Error(trackError.message);
      const track = trackData as unknown as { id: string };

      // Check if slot already exists (update-in-place to avoid UNIQUE constraint conflict)
      const { data: existingData } = await supabase
        .from('scheduled_sessions')
        .select('id')
        .eq('scheduled_date', date)
        .eq('phase', phase)
        .maybeSingle();

      const existing = existingData as unknown as { id: string } | null;

      if (existing) {
        // Update existing session in place (same UNIQUE key slot)
        const { error: sessionError } = await supabase
          .from('scheduled_sessions')
          .update({
            audio_track_id: track.id,
            title,
            status: targetStatus,
            published_at: targetStatus === 'published' ? new Date().toISOString() : null,
            is_active: targetStatus === 'published',
          } as Record<string, unknown>)
          .eq('id', existing.id);

        if (sessionError) throw new Error(sessionError.message);
      } else {
        // No existing session — insert new
        const { error: sessionError } = await supabase
          .from('scheduled_sessions')
          .insert({
            scheduled_date: date,
            phase,
            duration_minutes: SESSION_DURATION,
            audio_track_id: track.id,
            title,
            status: targetStatus,
            published_at: targetStatus === 'published' ? new Date().toISOString() : null,
            is_active: targetStatus === 'published',
          } as Record<string, unknown>);

        if (sessionError) throw new Error(sessionError.message);
      }

      setStatus(
        targetStatus === 'published'
          ? '✓ Published successfully'
          : '✓ Saved as draft',
      );
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
          Upload / Edit Slot
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Phase</label>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as ContentPhase)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {PHASES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
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
            <label className="block text-xs text-text-secondary mb-1">Script Version</label>
            <input
              type="text"
              value={scriptVersion}
              onChange={(e) => setScriptVersion(e.target.value)}
              placeholder="v1.0 (optional)"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Audio File</label>
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
              <p className="text-text-secondary text-xs mt-1">{audioInfo}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSaveDraft}
            disabled={uploading}
            className="flex-1 py-2 px-3 bg-surface border border-border rounded-md text-sm
                       hover:bg-border transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={handlePublish}
            disabled={uploading}
            className="flex-1 py-2 px-3 bg-accent hover:bg-accent-hover text-white rounded-md text-sm
                       font-medium transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Publish'}
          </button>
        </div>

        {status && (
          <p className={`text-sm ${status.startsWith('✓') ? 'text-status-green' : 'text-status-red'}`}>
            {status}
          </p>
        )}
      </div>

      {showConfirm && (
        <PublishConfirmModal
          date={date}
          phase={phase}
          title={title}
          onConfirm={confirmPublish}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
