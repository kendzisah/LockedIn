'use client';

import { useState, useRef, useEffect } from 'react';
import { getBrowserSupabase } from '../lib/supabase-browser';

interface OnboardingTrack {
  id: string;
  title: string;
  duration_seconds: number;
  created_at: string;
}

export function OnboardingTrackPanel() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState<OnboardingTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [audioInfo, setAudioInfo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Fetch current active onboarding track
  useEffect(() => {
    async function fetchCurrent() {
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from('audio_tracks')
        .select('id, title, duration_seconds, created_at')
        .eq('category', 'onboarding')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrent(data as unknown as OnboardingTrack | null);
      setLoading(false);
    }
    fetchCurrent();
  }, []);

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
        setAudioInfo(`${mins}m ${secs}s`);
      });
    }
  }

  async function handleUpload() {
    if (!file || !title) {
      setStatus('Title and audio file are required.');
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const ext = file.name.split('.').pop();
      const storagePath = `onboarding/track_${Date.now()}.${ext}`;

      // 1. Get signed upload URL
      const urlRes = await fetch('/api/signed-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'audio', path: storagePath }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error);

      // 2. Upload file
      const uploadRes = await fetch(urlData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload to storage failed');

      const supabase = getBrowserSupabase();

      // Read audio duration
      const audioDuration = await new Promise<number>((resolve) => {
        const a = new Audio(URL.createObjectURL(file));
        a.addEventListener('loadedmetadata', () => resolve(Math.round(a.duration)));
      });

      // 3. Deactivate any existing onboarding tracks
      await supabase
        .from('audio_tracks')
        .update({ is_active: false } as Record<string, unknown>)
        .eq('category', 'onboarding')
        .eq('is_active', true);

      // 4. Insert new onboarding track
      const { data: trackData, error: trackError } = await supabase
        .from('audio_tracks')
        .insert({
          title,
          category: 'onboarding',
          storage_bucket: 'audio',
          storage_path: storagePath,
          duration_seconds: audioDuration,
          is_active: true,
        } as Record<string, unknown>)
        .select('id, title, duration_seconds, created_at')
        .single();

      if (trackError) throw new Error(trackError.message);

      const newTrack = trackData as unknown as OnboardingTrack;
      setCurrent(newTrack);
      setStatus('✓ Onboarding track updated');
      setFile(null);
      setTitle('');
      setAudioInfo(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
      <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
        Onboarding Track
      </h3>

      {/* Current track display */}
      {loading ? (
        <div className="animate-pulse">
          <div className="h-4 bg-border rounded w-48" />
        </div>
      ) : current ? (
        <div className="bg-background rounded-md p-3 space-y-1 text-sm">
          <p>
            <span className="text-text-secondary">Active:</span>{' '}
            <span className="font-medium">{current.title}</span>
          </p>
          <p className="text-text-secondary text-xs">
            {formatDuration(current.duration_seconds)} — uploaded{' '}
            {new Date(current.created_at).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <p className="text-sm text-status-red">No onboarding track set</p>
      )}

      {/* Upload replacement */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Onboarding session title..."
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
            <p className="text-text-secondary text-xs mt-1">Duration: {audioInfo}</p>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-white rounded-md text-sm
                     font-medium transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : current ? 'Replace Onboarding Track' : 'Upload Onboarding Track'}
        </button>
      </div>

      {status && (
        <p className={`text-sm ${status.startsWith('✓') ? 'text-status-green' : 'text-status-red'}`}>
          {status}
        </p>
      )}
    </div>
  );
}
