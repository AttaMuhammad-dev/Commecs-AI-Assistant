import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../server/gemini', () => ({ generateChatStream: vi.fn() }));
import { generateChatStream } from '../../server/gemini';
import { app } from '../../server/app';
import { clearCache } from '../../server/cache';
import { acquireCapacity } from '../../server/capacity';
const generate = vi.mocked(generateChatStream);
let ip = 0;
const request = (body: unknown) => app.request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-vercel-forwarded-for': String(++ip) }, body: JSON.stringify(body) });
beforeEach(() => { vi.stubEnv('VERCEL','1'); vi.stubEnv('CACHE_ENABLED','true'); clearCache(); generate.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe('chat API', () => {
  it('rejects invalid and oversized input before calling the provider', async () => {
    expect((await request({message: 'x'.repeat(601)})).status).toBe(400);
    expect((await request({message: 'x'.repeat(40000)})).status).toBe(413);
    expect(generate).not.toHaveBeenCalled();
  });
  it('serves a reviewed answer without calling the provider', async () => {
    const response = await request({message:'Programs offered'});
    const text = await response.text();
    expect(text).toContain('"mode":"verified"');
    expect(text).toContain('"phase":"reviewed"');
    expect(text).toContain('event: sources');
    expect(text).toContain('"finishReason":"STOP"');
    expect(generate).not.toHaveBeenCalled();
  });
  it('returns a contact card when providers fail and does not cache the fallback', async () => {
    generate.mockRejectedValue(Object.assign(new Error('quota'), {code:'QUOTA_EXCEEDED'}));
    for (let i = 0; i < 2; i++) {
      const text = await (await request({message:'Is there a robotics club in the college?'})).text();
      expect(text).toContain('"fallback":true');
      expect(text).toContain('event: contact');
      expect(text).toContain('"phase":"service"');
      expect(text).not.toContain('event: sources');
    }
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('returns relevant saved evidence for non-bank questions under provider failures', async () => {
    generate.mockRejectedValue(Object.assign(new Error('quota'), {code:'QUOTA_EXCEEDED'}));
    const text = await (await request({message:'Please explain the published fee policy in detail.'})).text();
    expect(text).toContain('"local":true,"fallback":true');
    expect(text.indexOf('"phase":"fallback"')).toBeLessThan(text.indexOf('event: chunk'));
    expect(text).toContain('fee-payment-policy');
    expect(text).toContain('event: sources');
    expect(text).toContain('"finishReason":"STOP"');
  });
  it('caches complete grounded replies but excludes partial replies', async () => {
    const sources = [{title:'Policy',url:'https://commecscollege.edu.pk/fee-payment-policy/'}];
    generate.mockImplementation(async (_m,_h,_s,_l,onChunk,onSources) => {
      await onChunk('A complete sourced answer to the question.'); await onSources(sources);
      return { text:'A complete sourced answer to the question.', sources, finishReason:'STOP', model:'test', thinking:'LOW', attempts:1 };
    });
    const body = {message:'Explain the fee payment policy please.'};
    await (await request(body)).text();
    const cached = await (await request(body)).text();
    expect(cached).toContain('"cached":true');
    expect(cached).toContain('"phase":"cached"');
    expect(generate).toHaveBeenCalledTimes(1);
    clearCache();
    generate.mockResolvedValue({text:'Partial but sourced reply that must not be cached',sources,finishReason:'INTERRUPTED',model:'test',thinking:'LOW',attempts:1});
    await (await request(body)).text(); await (await request(body)).text();
    expect(generate).toHaveBeenCalledTimes(3);
  });
  it('forwards typed generator progress independently of lane and answer events', async () => {
    generate.mockImplementation(async (_m,_h,_s,_l,onChunk,onSources,_prefs,_provider,options) => {
      await options?.onProgress?.({ phase: 'retrieving' });
      await options?.onProgress?.({ phase: 'preparing' });
      await options?.onProgress?.({ phase: 'checking' });
      const sources = [{ title: 'Policy', url: 'https://commecscollege.edu.pk/fee-payment-policy/' }];
      await onSources(sources); await onChunk('Complete answer.');
      return { text: 'Complete answer.', sources, finishReason: 'STOP', model: 'test', thinking: 'LOW', attempts: 1 };
    });
    const text = await (await request({ message: 'Explain the fee policy in detail please.' })).text();
    expect(text).toContain('event: status');
    expect(text).toContain('event: progress\ndata: {"phase":"preparing"}');
    expect(text.indexOf('"phase":"checking"')).toBeLessThan(text.indexOf('event: chunk'));
    expect(text).toContain('event: done');
  });
  it('bounds concurrent calls and releases capacity exactly once', () => {
    const releases = [acquireCapacity(), acquireCapacity(), acquireCapacity()];
    expect(releases.every(Boolean)).toBe(true);
    expect(acquireCapacity()).toBe(null);
    releases[0]?.(); releases[0]?.();
    const next = acquireCapacity(); expect(next).not.toBe(null);
    expect(acquireCapacity()).toBe(null);
    next?.(); releases.slice(1).forEach(release => release?.());
  });
  it('never appends fallback text to a reply even when its first token arrives in zero milliseconds', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1790630000000);
    generate.mockImplementation(async (_m,_h,_s,_l,onChunk) => { await onChunk('Partial response'); throw new Error('Disconnected'); });
    const text = await (await request({message:'Explain the campus policies in a few sentences.'})).text();
    expect(text).toContain('Partial response');
    expect(text).toContain('"finishReason":"INTERRUPTED"');
    expect(text).not.toContain('"fallback":true');
    expect(text).not.toContain('event: contact');
  });
});
