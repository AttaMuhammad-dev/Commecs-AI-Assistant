import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../server/gemini', () => ({ generateChatStream: vi.fn() }));
vi.mock('../../server/sharedTraffic', () => ({ acquireSharedTraffic: vi.fn(), trafficMode: () => 'shared-redis' }));
import { generateChatStream } from '../../server/gemini';
import { acquireSharedTraffic } from '../../server/sharedTraffic';
import { app } from '../../server/app';
let id = 0;
const request = () => app.request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-vercel-forwarded-for': 'shared-test-' + (++id) }, body: JSON.stringify({ message: 'Explain the late fee payment penalty in detail.' }) });
beforeEach(() => { vi.stubEnv('VERCEL', '1'); vi.stubEnv('CACHE_ENABLED', 'false'); vi.mocked(generateChatStream).mockReset(); vi.mocked(acquireSharedTraffic).mockReset(); });
afterEach(() => vi.unstubAllEnvs());
describe('shared admission in the actual SSE route', () => {
  it.each(['BUSY', 'RATE_LIMITED', 'TRAFFIC_UNAVAILABLE'])('serves the saved source and skips the model when the gate returns %s', async code => {
    vi.mocked(acquireSharedTraffic).mockResolvedValue({ allowed: false, code });
    const text = await (await request()).text();
    expect(text).toContain('"fallback":true'); expect(text).toContain('fee-payment-policy');
    expect(text).toContain('"phase":"fallback"'); expect(generateChatStream).not.toHaveBeenCalled();
  });
  it('releases an admitted lease after a provider failure', async () => {
    const release = vi.fn(async () => undefined);
    vi.mocked(acquireSharedTraffic).mockResolvedValue({ allowed: true, release });
    vi.mocked(generateChatStream).mockRejectedValue(Object.assign(new Error('private provider body'), { code: 'UPSTREAM_ERROR' }));
    const text = await (await request()).text(); expect(text).toContain('"fallback":true'); expect(text).not.toContain('private provider body');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
