export type Lane = 'fast' | 'deep' | 'verified';
export type Language = 'auto' | 'en' | 'ur' | 'roman';
export type ResponseStyle = 'concise' | 'detailed';
export interface Preferences { language: Language; responseStyle: ResponseStyle }
export interface Source { title: string; url: string; modified?: string; reviewedAt?: string; checkedAt?: string; type?: string; attributed?: true }
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
export const PROGRESS_PHASES = ['retrieving', 'website', 'websiteSaved', 'preparing', 'retrying', 'checking', 'saved', 'cached', 'reviewed', 'fallback', 'service'] as const;
export type ProgressPhase = typeof PROGRESS_PHASES[number];
export interface ChatProgress { phase: ProgressPhase; reason?: 'timeout' }
export type ChatEvent =
  | { event: 'progress'; data: ChatProgress }
  | { event: 'status'; data: { lane: Lane } }
  | { event: 'meta'; data: { mode: Lane; cached: boolean; local?: boolean; fallback?: boolean; verifiedAt?: number; notice?: 'privacy' | 'security' } }
  | { event: 'chunk'; data: { text: string } }
  | { event: 'sources'; data: { sources: Source[] } }
  | { event: 'contact'; data: Contact }
  | { event: 'done'; data: { finishReason: FinishReason } }
  | { event: 'error'; data: { code: string; message: string } };
export function safeSourceUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && (url.hostname === 'commecscollege.edu.pk' || url.hostname.endsWith('.commecscollege.edu.pk')); }
  catch { return false; }
}
export function sanitizeSources(value: unknown): Source[] {
  if (!Array.isArray(value)) return [];
  return value.filter(s => !!s && typeof s.title === 'string' && s.title.trim() && typeof s.url === 'string' && s.url.length <= 2048 && safeSourceUrl(s.url)).slice(0, 10).map(s => ({
    title: s.title.slice(0, 300), url: s.url,
    ...(typeof s.modified === 'string' ? { modified: s.modified.slice(0, 100) } : {}),
    ...(typeof s.reviewedAt === 'string' ? { reviewedAt: s.reviewedAt.slice(0, 100) } : {}),
    ...(typeof s.checkedAt === 'string' && Number.isFinite(Date.parse(s.checkedAt)) ? { checkedAt: s.checkedAt.slice(0, 100) } : {}),
    ...(typeof s.type === 'string' ? { type: s.type.slice(0, 40) } : {}),
    ...(s.attributed === true ? { attributed: true as const } : {}),
  }));
}
