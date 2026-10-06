import type { ChatMessage, BotChunk } from '../types/chat';
import { DEFAULT_PREFERENCES, PROGRESS_PHASES, sanitizeSources, type Preferences, type FinishReason, type ProgressPhase } from '../../shared/chat';
import { parseSSE } from './sseParser';
export async function* streamGeminiResponse(userMessage: string, history: ChatMessage[], signal?: AbortSignal, preferences: Preferences = DEFAULT_PREFERENCES, questionContext?: string): AsyncGenerator<BotChunk> {
  const request = new AbortController();
  const abort = () => request.abort();
  if (signal?.aborted) request.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 65000);
  try {
  const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage, history: history.slice(-8).map(h => ({ role: h.role, text: h.text })), preferences, ...(questionContext ? { questionContext } : {}) }), signal: request.signal,
  });
  if (!res.ok) throw new Error(res.status === 429 ? 'RATE_LIMITED' : res.status === 400 ? 'BAD_REQUEST' : 'UPSTREAM_ERROR');
  if (!res.body) throw new Error('UPSTREAM_ERROR');
  let finished = false;
  for await (const { event, data } of parseSSE(res.body)) {
    if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    if (event === 'error') throw new Error(typeof data.code === 'string' ? data.code : 'UPSTREAM_ERROR');
    if (event === 'progress' && PROGRESS_PHASES.includes(data.phase as ProgressPhase)) yield { progress: { phase: data.phase as ProgressPhase, ...(data.reason === 'timeout' ? { reason: 'timeout' as const } : {}) } };
    if (event === 'chunk' && typeof data.text === 'string') yield { text: data.text };
    if (event === 'status' && ['fast','deep','verified'].includes(String(data.lane))) yield { mode: data.lane as 'fast' | 'deep' | 'verified' };
    if (event === 'meta') yield { cached: data.cached === true, local: data.local === true, fallback: data.fallback === true, verifiedAt: typeof data.verifiedAt === 'number' ? data.verifiedAt : undefined, ...(data.notice === 'privacy' || data.notice === 'security' ? { notice: data.notice } : {}) };
    if (event === 'sources' && Array.isArray(data.sources)) yield { sources: sanitizeSources(data.sources) };
    if (event === 'contact' && typeof data.email === 'string' && typeof data.landline === 'string' && typeof data.whatsapp === 'string') yield { contact: { email: data.email, landline: data.landline, whatsapp: data.whatsapp } };
    if (event === 'done') { finished = true; yield { finishReason: ['STOP','MAX_TOKENS','BLOCKED','INTERRUPTED'].includes(String(data.finishReason)) ? data.finishReason as FinishReason : 'INTERRUPTED' }; break; }
  }
  if (!finished) throw new Error('INTERRUPTED');
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); request.abort(); }
}
