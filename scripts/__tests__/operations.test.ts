import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../server/app';
import { authorizedOperations, operationsSnapshot, recordOutcome, resetOperationsForTests } from '../../server/operations';
beforeEach(() => { resetOperationsForTests(); vi.spyOn(console, 'info').mockImplementation(() => undefined); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe('private operational diagnostics', () => {
  it('conceals metrics without a sufficiently long configured token', async () => {
    vi.stubEnv('OPS_METRICS_TOKEN', '');
    expect((await app.request('/api/metrics')).status).toBe(404);
    vi.stubEnv('OPS_METRICS_TOKEN', 'short'); expect(authorizedOperations('Bearer short')).toBe(false);
    vi.stubEnv('OPS_METRICS_TOKEN', 'a'.repeat(40));
    expect((await app.request('/api/metrics', { headers: { Authorization: 'Bearer ' + 'b'.repeat(40) } })).status).toBe(404);
    const response = await app.request('/api/metrics', { headers: { Authorization: 'Bearer ' + 'a'.repeat(40) } });
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ scope: 'current-process', trafficControl: 'per-process' });
  });
  it('logs bounded outcomes and discards raw provider errors', () => {
    recordOutcome('test-id', 'saved', 1234.2, 'secret provider error text');
    expect(console.info).toHaveBeenLastCalledWith(JSON.stringify({ event: 'chat_finished', requestId: 'test-id', outcome: 'saved', durationMs: 1234 }));
    recordOutcome('test-id', 'service', 500, 'QUOTA_EXCEEDED');
    expect(String(vi.mocked(console.info).mock.calls.at(-1)?.[0])).toContain('QUOTA_EXCEEDED');
    expect(operationsSnapshot().counts.saved).toBe(1);
  });
  it('reports fallback/error deterioration and keeps only 200 recent samples', () => {
    for (let i = 0; i < 5; i++) recordOutcome('id', 'error', 1);
    expect(operationsSnapshot().status).toBe('degraded');
    for (let i = 0; i < 201; i++) recordOutcome('id', 'live', 1000);
    expect(operationsSnapshot()).toMatchObject({ status: 'observing', recentCompleted: 200, recentErrors: 0, p95Ms: 1000 });
    resetOperationsForTests();
    for (let i = 0; i < 5; i++) recordOutcome('id', 'saved', 30000);
    expect(operationsSnapshot()).toMatchObject({ status: 'degraded', recentFallbacks: 5 });
  });
});
