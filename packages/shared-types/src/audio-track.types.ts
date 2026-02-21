export type AudioCategory = 'lock_in' | 'unlock' | 'ambient' | 'guided' | 'onboarding';

export interface AudioTrack {
  id: string;
  title: string;
  category: AudioCategory;
  storageBucket: string;         // e.g. "audio"
  storagePath: string;           // e.g. "tracks/2026-02-20/lock_in_10.mp3"
  durationSeconds: number;
  voiceId: string | null;        // ElevenLabs voice ID
  scriptVersion: string | null;
  hash: string | null;           // file integrity / dedupe
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}
