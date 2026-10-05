import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireSharedTraffic, trafficMode } from '../../server/sharedTraffic';
beforeEach(() => { vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://demo.upstash.io'); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'private-test-token'); vi.stubEnv('LIVE_REQUESTS_PER_HOUR', '30'); vi.stubEnv('TRAFFIC_NAMESPACE', 'test'); });
afterEach(() => vi.unstubAllEnvs());
const signal = () => new AbortController().signal;
const result = (data: unknown) => new Response(JSON.stringify({ result: data }), { headers: { 'Content-Type': 'application/json' } });
describe('optional shared traffic admission', () => {
  it('retains per-process operation when no shared backend is configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const fetcher = vi.fn(); expect(trafficMode()).toBe('per-process');
    expect(await acquireSharedTraffic('local', signal(), fetcher)).toEqual({ allowed: true }); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['http://demo.upstash.io', 'https://evil.example', 'https://demo.upstash.io/path', 'https://demo.upstash.io?token=secret'])('fails closed for invalid server configuration: %s', async url => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', url); const fetcher = vi.fn();
    expect(trafficMode()).toBe('shared-misconfigured');
    expect(await acquireSharedTraffic('ip', signal(), fetcher)).toEqual({ allowed: false, code: 'TRAFFIC_UNAVAILABLE' }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('hashes actor identifiers and releases the same expiring lease only once', async () => {
    const fetcher = vi.fn(async () => result([1, 'OK']));
    const lease = await acquireSharedTraffic('192.0.2.45', signal(), fetcher);
    expect(lease.allowed).toBe(true); const options = fetcher.mock.calls[0][1]! as RequestInit;
    const payload = String(options.body); expect(payload).not.toContain('192.0.2.45'); expect(payload).not.toContain('private-test-token');
    const command = JSON.parse(payload); expect(command[0]).toBe('EVAL'); expect(command[2]).toBe(3);
    expect(command[3]).toMatch(/^\{test\}:actor:[a-f0-9]{64}$/); expect(command[1]).toContain('now + 45');
    expect(options.redirect).toBe('error'); expect(options.signal).toBeInstanceOf(AbortSignal);
    await lease.release?.(); await lease.release?.(); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((fetcher.mock.calls[1][1] as RequestInit).body))).toEqual(['ZREM', command[5], command[6]]);
  });
  it.each(['BUSY', 'RATE_LIMITED'])('honors an actual shared rejection: %s', async code => {
    expect(await acquireSharedTraffic('ip', signal(), async () => result([0, code]))).toEqual({ allowed: false, code });
  });
  it.each([[1, 'BUSY'], [1, 'OK', 'extra'], ['1', 'OK'], 'OK'])('rejects malformed gate responses', async value => {
    expect(await acquireSharedTraffic('ip', signal(), async () => result(value))).toEqual({ allowed: false, code: 'TRAFFIC_UNAVAILABLE' });
  });
  it('handles backend errors and cancellation without exposing provider details', async () => {
    expect(await acquireSharedTraffic('ip', signal(), async () => new Response('secret', { status: 503 }))).toEqual({ allowed: false, code: 'TRAFFIC_UNAVAILABLE' });
    expect(await acquireSharedTraffic('ip', signal(), async () => new Response(JSON.stringify({ error: 'raw error' })))).toEqual({ allowed: false, code: 'TRAFFIC_UNAVAILABLE' });
    const ac = new AbortController(); ac.abort();
    expect(await acquireSharedTraffic('ip', ac.signal, async () => { throw new Error('cancelled'); })).toEqual({ allowed: false, code: 'ABORTED' });
  });
  it('coordinates independent callers through one backend contract', async () => {
    // REST contract simulation, not a claim that Lua was executed on real Redis.
    const leases = new Set<string>(); let requests = 0;
    const fetcher: typeof fetch = async (_url, options) => {
      const command = JSON.parse(String(options?.body));
      if (command[0] === 'ZREM') { leases.delete(command[2]); return result(1); }
      if (requests >= 4) return result([0, 'RATE_LIMITED']);
      if (leases.size >= 3) return result([0, 'BUSY']);
      leases.add(command[6]); requests++; return result([1, 'OK']);
    };
    const first = await Promise.all([1, 2, 3, 4].map(i => acquireSharedTraffic('actor-' + i, signal(), fetcher)));
    expect(first.map(r => r.allowed)).toEqual([true, true, true, false]); expect(first[3].code).toBe('BUSY');
    await first[0].release?.(); const next = await acquireSharedTraffic('actor-5', signal(), fetcher); expect(next.allowed).toBe(true);
    await next.release?.(); expect((await acquireSharedTraffic('actor-6', signal(), fetcher)).code).toBe('RATE_LIMITED');
  });
});
