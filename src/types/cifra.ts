import { Timestamp } from 'firebase/firestore';

export type InstrumentType = 'Violão' | 'Guitarra' | 'Ukulele' | 'Teclado';
export type DifficultyLevel = 'Iniciante' | 'Intermediário' | 'Avançado';

export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  MAX_ID_LEN: 128,
  MAX_DISPLAY_NAME_LEN: 100,
  MAX_TITLE_LEN: 140,
  MAX_ARTIST_LEN: 120,
  MAX_GENRE_LEN: 60,
  MAX_KEY_LEN: 10,
  MAX_TIME_SIG_LEN: 10,
  MAX_CONTENT_LEN: 30000,
  MAX_NOTES_LEN: 1000,
  MAX_SETLIST_NAME_LEN: 120,
  MAX_VENUE_LEN: 120,
  MAX_EVENT_DATE_LEN: 32,
  MAX_DESCRIPTION_LEN: 500,
  MAX_TRANSCRIPT_LEN: 300,
  MAX_INTENT_LEN: 60,
  MAX_RESPONSE_LEN: 400,
  MIN_TRANSPOSE: -11,
  MAX_TRANSPOSE: 11,
  MIN_CAPO: 0,
  MAX_CAPO: 11,
  MIN_BPM: 40,
  MAX_BPM: 240,
} as const;

export const ALLOWED_INSTRUMENTS: InstrumentType[] = [
  'Violão',
  'Guitarra',
  'Ukulele',
  'Teclado',
];

export const ALLOWED_DIFFICULTIES: DifficultyLevel[] = [
  'Iniciante',
  'Intermediário',
  'Avançado',
];

export interface UserProfile {
  userId: string;
  displayName: string;
  preferredInstrument: InstrumentType;
  stageDarkMode: boolean;
  hasSeededLibrary: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Song {
  id: string;
  userId: string;
  title: string;
  artist: string;
  genre: string;
  originalKey: string;
  transposeOffset: number;
  capo: number;
  bpm: number;
  timeSignature: string;
  difficulty: DifficultyLevel;
  isFavorite: boolean;
  content: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Setlist {
  id: string;
  userId: string;
  name: string;
  venue: string;
  eventDate: string;
  description: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SetlistItem {
  id: string;
  userId: string;
  setlistId: string;
  songId: string;
  order: number;
  customTranspose: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface VoiceLog {
  id: string;
  userId: string;
  transcript: string;
  intent: string;
  responseSummary: string;
  createdAt?: Timestamp;
}

export function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, n));
}

export function sanitizeStr(value: string, maxLen: number, fallback = ''): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

export function generateSafeId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 20) || 'id';
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${cleanPrefix}_${rand}`.slice(0, BLUEPRINT_LIMITS.MAX_ID_LEN);
}
