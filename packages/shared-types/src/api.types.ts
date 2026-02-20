import type { ContentPhase, SessionDuration } from './scheduled-session.types';

/** GET /session/today?phase=lock_in&duration=10 */
export interface TodaySessionRequest {
  phase: ContentPhase;
  duration: SessionDuration;
}

export interface TodaySessionResponse {
  audioUrl: string;           // signed URL, 15 min TTL
  title: string;
  durationSeconds: number;
  scriptVersion: string;
  phase: ContentPhase;
  isFallback: boolean;        // true = no exact date match, using nearest previous
}
