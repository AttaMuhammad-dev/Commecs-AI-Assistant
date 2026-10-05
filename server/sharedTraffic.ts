import { createHmac, randomUUID } from 'node:crypto';
const acquireScript = `
local now = tonumber(redis.call('TIME')[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 3600)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - 3600)
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
if redis.call('ZCOUNT', KEYS[1], now - 60, '+inf') >= 6 or redis.call('ZCARD', KEYS[1]) >= 30 or redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[2]) then return {0, 'RATE_LIMITED'} end
if redis.call('ZCARD', KEYS[3]) >= 3 then return {0, 'BUSY'} end
redis.call('ZADD', KEYS[1], now, ARGV[1])
redis.call('ZADD', KEYS[2], now, ARGV[1])
redis.call('ZADD', KEYS[3], now + 45, ARGV[1])
redis.call('EXPIRE', KEYS[1], 3660)
redis.call('EXPIRE', KEYS[2], 3660)
redis.call('EXPIRE', KEYS[3], 90)
return {1, 'OK'}
`;
function configuration() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim(), token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url && !token) return null;
  const parsed = new URL(url || 'invalid:');
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.upstash.io') || parsed.username || parsed.password || parsed.port || !token || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw new Error('Invalid shared traffic configuration');
  const budget = Number(process.env.LIVE_REQUESTS_PER_HOUR || 30);
  if (!Number.isInteger(budget) || budget < 1 || budget > 5000) throw new Error('Invalid live request budget');
  const prefix = process.env.TRAFFIC_NAMESPACE || 'commecs-' + (process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL_ENV === 'preview' ? 'preview' : 'local');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(prefix)) throw new Error('Invalid traffic namespace');
  return { url: parsed.origin, token, budget, prefix: '{' + prefix + '}' };
}
export function trafficMode() {
  try { return configuration() ? 'shared-redis' : 'per-process'; } catch { return 'shared-misconfigured'; }
}
export async function acquireSharedTraffic(ip: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ allowed: boolean; code?: string; release?: () => Promise<void> }> {
  if (signal.aborted) return { allowed: false, code: 'ABORTED' };
  try {
    const config = configuration();
    if (!config) return { allowed: true };
    const actor = createHmac('sha256', config.token).update(ip).digest('hex'), lease = randomUUID();
    const keys = [config.prefix + ':actor:' + actor, config.prefix + ':requests', config.prefix + ':leases'];
    const command = async (body: unknown[], cancellation?: AbortSignal) => {
      const response = await fetcher(config.url, { method: 'POST', headers: { Authorization: 'Bearer ' + config.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: cancellation ? AbortSignal.any([cancellation, AbortSignal.timeout(1500)]) : AbortSignal.timeout(1500) });
      if (!response.ok) throw new Error('Shared traffic unavailable');
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || 'error' in data || !('result' in data)) throw new Error('Invalid shared traffic response');
      return (data as { result: unknown }).result;
    };
    const result = await command(['EVAL', acquireScript, 3, ...keys, lease, config.budget], signal);
    if (!Array.isArray(result) || result.length !== 2 || ![0, 1].includes(result[0]) || !['OK', 'BUSY', 'RATE_LIMITED'].includes(result[1]) || (result[0] === 1) !== (result[1] === 'OK')) throw new Error('Invalid shared gate result');
    if (result[0] === 0) return { allowed: false, code: result[1] };
    let released = false;
    return { allowed: true, release: async () => { if (released) return; released = true; try { await command(['ZREM', keys[2], lease]); } catch { /* The 45-second lease expires even after a process/network failure. */ } } };
  } catch { return { allowed: false, code: signal.aborted ? 'ABORTED' : 'TRAFFIC_UNAVAILABLE' }; }
}
