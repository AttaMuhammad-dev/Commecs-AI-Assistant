import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateChatStream, type StreamProvider } from '../../server/gemini';
import { resetQuotaForTests } from '../../server/quota';
import type { ChatProgress } from '../../shared/chat';
const answer = { candidates: [{ content: { parts: [{ text: 'A complete answer.' }] }, finishReason: 'STOP', groundingMetadata: { groundingChunks: [{ retrievedContext: { uri: 'https://commecscollege.edu.pk/about/', title: 'About' } }] } }] };
beforeEach(() => { resetQuotaForTests(); vi.stubEnv('MODEL_LADDER_FAST', 'gemini-3.5-flash-lite,gemini-3.1-flash-lite'); vi.stubEnv('FAKE_UPSTREAM_ERROR', ''); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const run = (provider: StreamProvider, events: string[], progress: ChatProgress[] = [], signal = new AbortController().signal) => generateChatStream('An unknown question', [], signal, 'fast', () => { events.push('answer'); }, () => { events.push('sources'); }, undefined, provider, {
  buffered: true, requireSources: true, onProgress: p => { progress.push(p); events.push(p.phase); },
});
describe('observable backend progress', () => {
  it('reports retrieval and request, then checks before releasing buffered output', async () => {
    const events: string[] = [];
    await run(async () => { events.push('provider'); return (async function* () { yield answer; })(); }, events);
    expect(events).toEqual(['retrieving', 'preparing', 'provider', 'checking', 'sources', 'answer']);
  });
  it('retains the current phase while a slow provider runs, then reports an actual timeout retry', async () => {
    vi.useFakeTimers(); const events: string[] = [], progress: ChatProgress[] = []; let calls = 0;
    const task = run(async () => { if (++calls === 1) return new Promise(() => {}); return (async function* () { yield answer; })(); }, events, progress);
    await vi.advanceTimersByTimeAsync(8000);
    expect(events).toEqual(['retrieving', 'preparing']);
    await vi.advanceTimersByTimeAsync(2000); await task;
    expect(calls).toBe(2);
    expect(progress).toContainEqual({ phase: 'retrying', reason: 'timeout' });
    expect(events.slice(-4)).toEqual(['retrying', 'checking', 'sources', 'answer']);
  });
  it('does not claim a timeout when a provider rejects immediately', async () => {
    const progress: ChatProgress[] = []; let calls = 0;
    await run(async () => { if (++calls === 1) throw { status: 503 }; return (async function* () { yield answer; })(); }, [], progress);
    expect(progress).toContainEqual({ phase: 'retrying' });
    expect(progress.some(p => p.reason === 'timeout')).toBe(false);
  });
  it('checks incomplete output before discarding it and retrying', async () => {
    const events: string[] = []; let calls = 0;
    await run(async () => { const response = ++calls === 1 ? { ...answer, candidates: [{ ...answer.candidates[0], finishReason: 'MAX_TOKENS' }] } : answer; return (async function* () { yield response; })(); }, events);
    expect(events).toEqual(['retrieving', 'preparing', 'checking', 'retrying', 'checking', 'sources', 'answer']);
  });
  it('emits no retry or check after cancellation of a waiting request', async () => {
    const controller = new AbortController(), events: string[] = [];
    const provider = vi.fn(async () => new Promise<AsyncIterable<typeof answer>>(() => {}));
    const task = run(provider, events, [], controller.signal);
    await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
    controller.abort(); await expect(task).rejects.toMatchObject({ code: 'ABORTED' });
    expect(events).toEqual(['retrieving', 'preparing']);
  });
});
