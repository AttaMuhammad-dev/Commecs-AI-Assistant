import { timingSafeEqual } from 'node:crypto';
export type Outcome = 'live' | 'cached' | 'reviewed' | 'local' | 'guarded' | 'saved' | 'service' | 'cancelled' | 'error';
const outcomes: Outcome[] = ['live', 'cached', 'reviewed', 'local', 'guarded', 'saved', 'service', 'cancelled', 'error'];
const startedAt = Date.now();
const counts = Object.fromEntries(outcomes.map(o => [o, 0])) as Record<Outcome, number>;
const recent: { outcome: Outcome; durationMs: number }[] = [];
export function safeOutcomeCode(code: unknown): string {
  return typeof code === 'string' && ['ABORTED', 'BUSY', 'RATE_LIMITED', 'TRAFFIC_UNAVAILABLE', 'NOT_CONFIGURED', 'QUOTA_EXCEEDED', 'MODEL_UNAVAILABLE', 'UPSTREAM_ERROR', 'UNGROUNDED', 'INCOMPLETE', 'BLOCKED'].includes(code) ? code : 'UPSTREAM_ERROR';
}
export function recordOutcome(requestId: string, outcome: Outcome, durationMs: number, code?: string) {
  const duration = Math.max(0, Math.min(120000, Math.round(durationMs)));
  counts[outcome]++; recent.push({ outcome, durationMs: duration }); if (recent.length > 200) recent.shift();
  const safeCode = code && safeOutcomeCode(code) === code ? code : undefined;
  console.info(JSON.stringify({ event: 'chat_finished', requestId, outcome, durationMs: duration, ...(safeCode ? { code: safeCode } : {}) }));
}
export function operationsSnapshot() {
  const completed = recent.filter(r => !['cancelled', 'error'].includes(r.outcome));
  const fallback = completed.filter(r => ['saved', 'service'].includes(r.outcome)).length;
  const attempts = recent.filter(r => r.outcome !== 'cancelled'), errors = attempts.filter(r => r.outcome === 'error').length;
  const latencies = completed.map(r => r.durationMs).sort((a, b) => a - b);
  const p95Ms = latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1] : 0;
  return { scope: 'current-process', since: new Date(startedAt).toISOString(), counts: { ...counts }, recentCompleted: completed.length, recentFallbacks: fallback, p95Ms,
    recentErrors: errors, status: attempts.length >= 5 && (errors / attempts.length > 0.2 || fallback / completed.length > 0.5 || p95Ms > 25000) ? 'degraded' : 'observing',
    note: 'Process counters reset on restart. Aggregate chat_finished events across deployments in the hosting log service.' };
}
export function authorizedOperations(value: string | undefined) {
  const expected = process.env.OPS_METRICS_TOKEN?.trim();
  if (!expected || expected.length < 32 || !value?.startsWith('Bearer ')) return false;
  const a = Buffer.from(value.slice(7)), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function resetOperationsForTests() { for (const outcome of outcomes) counts[outcome] = 0; recent.length = 0; }
