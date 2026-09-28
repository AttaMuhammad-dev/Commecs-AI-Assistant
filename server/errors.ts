export class ChatError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'ChatError'; }
}
export function classifyProviderError(error: unknown): { kind: 'daily' | 'minute' | 'transient' | 'thinking' | 'unavailable' | 'fatal'; retryMs: number } {
  const e = error as { status?: number; code?: string | number; message?: string; cause?: { code?: string } };
  const message = String(e?.message || '');
  const status = Number(e?.status || e?.code);
  if (status === 429) return { kind: /per.?day|requestsperday|daily|permodelperday/i.test(message) ? 'daily' : 'minute', retryMs: Math.min(300000, Math.max(1000, Number(message.match(/retryDelay[^\d]*(\d+(?:\.\d+)?)s/i)?.[1] || 60) * 1000)) };
  if (status === 400 && /thinking/i.test(message)) return { kind: 'thinking', retryMs: 0 };
  if (status === 404) return { kind: 'unavailable', retryMs: 0 };
  if ([500, 502, 503, 504].includes(status) || /fetch failed|timeout|LOCAL_TIMEOUT|socket/i.test(message) || e?.cause?.code === 'ECONNRESET') return { kind: 'transient', retryMs: 1500 };
  return { kind: 'fatal', retryMs: 0 };
}
