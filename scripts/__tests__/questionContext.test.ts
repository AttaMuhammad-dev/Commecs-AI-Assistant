import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../server/gemini', () => ({ generateChatStream: vi.fn() }));
import { generateChatStream } from '../../server/gemini';
import { app } from '../../server/app';
import { clearCache } from '../../server/cache';
import { sanitizeRequest } from '../../server/sanitize';
import { acquireCapacity } from '../../server/capacity';
const generate = vi.mocked(generateChatStream);
let ip = 0;
const request = (body: unknown) => app.request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-vercel-forwarded-for': 'context-' + ++ip }, body: JSON.stringify(body) });
const frames = (text: string) => [...text.matchAll(/event: (\w+)\ndata: ([^\n]+)/g)].map(m => ({ event: m[1], data: JSON.parse(m[2]) }));
beforeEach(() => { vi.stubEnv('VERCEL', '1'); vi.stubEnv('CACHE_ENABLED', 'true'); clearCache(); generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
describe('bounded user-question context', () => {
  it('validates context separately without changing complete history or the current message', () => {
    expect(sanitizeRequest({ message: 'Tell me more', questionContext: ' Clubs?\u0000 ', history: [] })).toMatchObject({ message: 'Tell me more', questionContext: 'Clubs?', history: [] });
    for (const questionContext of [false, {}, [], 'x'.repeat(2401)]) expect(() => sanitizeRequest({ message: 'Tell me more', questionContext })).toThrow();
  });
  it('returns the correct saved evidence for a contextual follow-up when the provider fails', async () => {
    generate.mockRejectedValue(Object.assign(new Error('Unavailable'), { code: 'UPSTREAM_ERROR' }));
    const events = frames(await (await request({ message: 'Tell me more', questionContext: 'Which clubs and societies can students join?' })).text());
    expect(events.some(e => e.event === 'meta' && e.data.fallback)).toBe(true);
    expect(events.filter(e => e.event === 'chunk').map(e => e.data.text).join('')).toContain('IT Club');
    expect(generate.mock.calls[0][1]).toEqual([]);
    expect(generate.mock.calls[0][8]?.questionContext).toContain('clubs and societies');
  });
  it('does not share cached short follow-up answers between different topics', async () => {
    generate.mockImplementation(async (_m, _h, _s, _l, onChunk, onSources, _prefs, _provider, options) => {
      const clubs = options?.questionContext?.includes('clubs');
      const text = clubs ? 'Supported answer about the published IT Club.' : 'Supported answer about the late fee penalty.';
      const sources = [{ title: clubs ? 'FAQs' : 'Fee policy', url: 'https://commecscollege.edu.pk/' + (clubs ? 'faqs/' : 'fee-payment-policy/') }];
      await onSources(sources); await onChunk(text);
      return { text, sources, finishReason: 'STOP', model: 'test', thinking: 'LOW', attempts: 1 };
    });
    const clubBody = { message: 'Tell me more', questionContext: 'Which clubs are available?' };
    const feeBody = { message: 'Tell me more', questionContext: 'What happens if fees are paid late?' };
    const clubs = await (await request(clubBody)).text();
    const fees = await (await request(feeBody)).text();
    expect(clubs).toContain('IT Club'); expect(fees).toContain('late fee penalty'); expect(fees).not.toContain('IT Club');
    expect(await (await request(clubBody)).text()).toContain('"cached":true');
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('ignores old context for an explicit new topic, preserving the instant reviewed lane', async () => {
    const text = await (await request({ message: 'Programs offered', questionContext: 'Which clubs can students join?' })).text();
    expect(text).toContain('"mode":"verified"'); expect(generate).not.toHaveBeenCalled();
  });
  it('bounds live calls during a ten-request burst, serves saved backups and releases every slot', async () => {
    const complete: (() => Promise<void>)[] = [];
    generate.mockImplementation((_m, _h, _s, _l, onChunk, onSources) => new Promise(resolve => {
      complete.push(async () => {
        const sources = [{ title: 'Fee policy', url: 'https://commecscollege.edu.pk/fee-payment-policy/' }];
        const text = 'A complete supported answer about late payment.';
        await onSources(sources); await onChunk(text);
        resolve({ text, sources, finishReason: 'STOP', model: 'test', thinking: 'LOW', attempts: 1 });
      });
    }));
    const jobs = Array.from({ length: 10 }, (_, i) => request({ message: 'Tell me more', questionContext: 'What happens if fees are paid late? ' + i }).then(r => r.text()));
    await vi.waitFor(() => expect(complete).toHaveLength(3));
    await Promise.all(complete.map(done => done()));
    const replies = await Promise.all(jobs);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(replies.filter(reply => reply.includes('"fallback":true'))).toHaveLength(7);
    expect(replies.every(reply => reply.includes('"finishReason":"STOP"'))).toBe(true);
    const slot = acquireCapacity(); expect(slot).not.toBeNull(); slot?.();
  });
});
describe('HTTP input and browser-origin handling', () => {
  it.each([null, [], 7, {}, { message: null }, { message: ' ' }, { message: 'x'.repeat(601) }, { message: 'Hi', questionContext: {} }, { message: 'Hi', questionContext: 'x'.repeat(2401) }])('rejects malformed requests before requesting a model: %j', async body => {
    expect((await request(body)).status).toBe(400); expect(generate).not.toHaveBeenCalled();
  });
  it('rejects unsupported content types, malformed JSON and oversized bodies', async () => {
    expect((await app.request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' })).status).toBe(400);
    expect((await app.request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status).toBe(400);
    expect((await request({ message: 'x'.repeat(40000) })).status).toBe(413);
    expect(generate).not.toHaveBeenCalled();
  });
  it('provides CORS preflight only for configured browser origins', async () => {
    const preflight = (origin: string) => app.request('/api/chat', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type' } });
    expect((await preflight('https://commecs-ai-assistant.vercel.app')).headers.get('Access-Control-Allow-Origin')).toBe('https://commecs-ai-assistant.vercel.app');
    expect((await preflight('https://untrusted.example')).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
