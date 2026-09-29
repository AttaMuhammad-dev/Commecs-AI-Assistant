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

// Log only safe diagnostics, never provider messages (which may contain credentials or prompts).
export function providerDiagnostic(error: unknown) {
  const e = error as { name?: string; status?: number; code?: string | number; cause?: { code?: string }; message?: string };
  const message = String(e?.message || '');
  const status = Number(e?.status || e?.code);
  const connectionCode = String(e?.cause?.code || '');
  return {
    status: Number.isFinite(status) ? status : undefined,
    connectionCode: /^[A-Z_0-9]+$/.test(connectionCode) ? connectionCode : undefined,
    reason: /api.key.*(?:invalid|expired)|API_KEY_INVALID/i.test(message) ? 'invalid_api_key'
      : /permission.denied|not authorized/i.test(message) ? 'permission_denied'
      : /thinking/i.test(message) ? 'thinking_configuration'
      : /fetch failed|network|socket|ECONN/i.test(message) ? 'connection_failed'
      : /timeout|LOCAL_TIMEOUT/i.test(message) ? 'timeout'
      : /file.?search|store/i.test(message) ? 'file_search'
      : 'provider_rejected_request',
  };
}
