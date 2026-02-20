export type ContentPhase = 'lock_in' | 'unlock';
export type SessionDuration = 5 | 10 | 15 | 20;
export type ContentStatus = 'draft' | 'published' | 'archived';

export interface ScheduledSession {
  id: string;
  scheduledDate: string;                // YYYY-MM-DD (user-local calendar day)
  phase: ContentPhase;
  durationMinutes: SessionDuration;
  audioTrackId: string;
  title: string;
  status: ContentStatus;
  publishedAt: string | null;
  recommendedTimeLocal: string | null;  // HH:MM, nullable (future personalization)
  isActive: boolean;
  createdAt: string;
}
