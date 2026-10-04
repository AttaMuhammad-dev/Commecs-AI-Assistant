export type Lane = 'fast' | 'deep' | 'verified';
export type Language = 'auto' | 'en' | 'ur' | 'roman';
export type ResponseStyle = 'concise' | 'detailed';
export interface Preferences { language: Language; responseStyle: ResponseStyle }
export interface Source { title: string; url: string; modified?: string; reviewedAt?: string; type?: string }
export interface Contact { email: string; landline: string; whatsapp: string }
export interface HistoryTurn { role: 'user' | 'model'; text: string }
export type FinishReason = 'STOP' | 'MAX_TOKENS' | 'INTERRUPTED' | 'BLOCKED';
export const MAX_MESSAGE_LENGTH = 600;
export const DEFAULT_PREFERENCES: Preferences = { language: 'auto', responseStyle: 'concise' };
export function resolveLanguage(message: string, language: Language): Exclude<Language, 'auto'> {
  if (language !== 'auto') return language;
  if (/[\u0600-\u06ff]/.test(message)) return 'ur';
  const words = message.toLowerCase().match(/\b(mujhe|aap|kitni|kitna|batao|chahiye|parhna|karna|kya|hai|hain|mein)\b/g) || [];
  return words.length >= 2 || /\b(mujhe|batao|chahiye|kitni|kitna)\b/i.test(message) ? 'roman' : 'en';
}
export const PROGRESS_PHASES = ['retrieving', 'preparing', 'retrying', 'checking', 'saved', 'cached', 'reviewed', 'fallback', 'service'] as const;
export type ProgressPhase = typeof PROGRESS_PHASES[number];
export interface ChatProgress { phase: ProgressPhase; reason?: 'timeout' }
export type ChatEvent =
  | { event: 'progress'; data: ChatProgress }
  | { event: 'status'; data: { lane: Lane } }
  | { event: 'meta'; data: { mode: Lane; cached: boolean; local?: boolean; fallback?: boolean; verifiedAt?: number } }
  | { event: 'chunk'; data: { text: string } }
  | { event: 'sources'; data: { sources: Source[] } }
  | { event: 'contact'; data: Contact }
  | { event: 'done'; data: { finishReason: FinishReason } }
  | { event: 'error'; data: { code: string; message: string } };
export function safeSourceUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'commecscollege.edu.pk' || url.hostname.endsWith('.commecscollege.edu.pk')); }
  catch { return false; }
}
