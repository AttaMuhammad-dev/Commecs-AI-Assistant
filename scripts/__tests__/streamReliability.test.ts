import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { generateChatStream, type StreamProvider } from '../../server/gemini';
import { resetQuotaForTests, isExhausted } from '../../server/quota';
import { classifyProviderError } from '../../server/errors';
import { GenerateContentResponse, FinishReason } from '@google/genai';
function chunk(text: string, finish?: FinishReason) {
  return Object.assign(new GenerateContentResponse(), { candidates: [{ content: { parts: [{text}] }, finishReason: finish }] });
}
const run = (provider: StreamProvider, chunks: string[] = [], signal = new AbortController().signal) =>
  generateChatStream('A question', [], signal, 'fast', text => { chunks.push(text); }, () => undefined, undefined, provider);
beforeEach(() => { resetQuotaForTests(); vi.stubEnv('MODEL_LADDER_FAST','gemini-3.1-flash-lite,gemini-3.5-flash-lite'); vi.stubEnv('FAKE_UPSTREAM_ERROR',''); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('provider execution', () => {
  it('falls back after a daily 429 without retrying the exhausted model', async () => {
    const calls: string[] = [];
    const provider: StreamProvider = async params => {
      calls.push(params.model);
      if (calls.length === 1) throw { status:429, message:'GenerateRequestsPerDayPerProjectPerModel' };
      return (async function* () { yield chunk('Answer', FinishReason.STOP); })();
    };
    const result = await run(provider);
    expect(calls).toEqual(['gemini-3.1-flash-lite','gemini-3.5-flash-lite']);
    expect(result.finishReason).toBe('STOP');
    expect(isExhausted(calls[0])).toBe(true);
  });
  it('falls back if the stream breaks before any text', async () => {
    let calls = 0;
    const provider: StreamProvider = async () => (async function* () {
      calls++;
      if (calls === 1) throw {status:503,message:'unavailable'};
      yield chunk('Recovered', FinishReason.STOP);
    })();
    expect((await run(provider)).text).toBe('Recovered');
    expect(calls).toBe(2);
  });
  it('never mixes two model answers after partial output', async () => {
    let calls = 0;
    const provider: StreamProvider = async () => { calls++; return (async function* () { yield chunk('Partial'); throw {status:503}; })(); };
    const result = await run(provider);
    expect(calls).toBe(1);
    expect(result.finishReason).toBe('INTERRUPTED');
    expect(result.text).toBe('Partial');
  });
  it('preserves MAX_TOKENS rather than claiming STOP', async () => {
    const provider: StreamProvider = async () => (async function* () { yield chunk('Short', FinishReason.MAX_TOKENS); })();
    expect((await run(provider)).finishReason).toBe('MAX_TOKENS');
  });
  it('does not stream thought parts', async () => {
    const provider: StreamProvider = async () => (async function* () {
      yield Object.assign(new GenerateContentResponse(), {candidates:[{content:{parts:[{text:'secret',thought:true},{text:'Answer'}]},finishReason:FinishReason.STOP}]});
    })();
    const received: string[] = [];
    expect((await run(provider,received)).text).toBe('Answer');
    expect(received.join('')).not.toContain('secret');
  });
  it('cancels a stalled stream immediately', async () => {
    const ac = new AbortController();
    const provider: StreamProvider = async () => ({ [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => undefined) }) });
    const promise = run(provider, [], ac.signal);
    ac.abort();
    await expect(promise).rejects.toMatchObject({code:'ABORTED'});
  });
  it('bounds stalled attempts and provider call count', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const provider: StreamProvider = async () => { calls++; return new Promise(() => undefined); };
    const result = run(provider).catch(error => error);
    await vi.advanceTimersByTimeAsync(51000);
    expect((await result).code).toBe('UPSTREAM_ERROR');
    expect(calls).toBeLessThanOrEqual(3);
  });
  it('classifies structured daily names and respects minute retry duration', () => {
    expect(classifyProviderError({status:429,message:'GenerateRequestsPerDayPerProjectPerModel'}).kind).toBe('daily');
    expect(classifyProviderError({status:429,message:'{"retryDelay":"30s"}'})).toEqual({kind:'minute',retryMs:30000});
    expect(classifyProviderError({status:400,message:'bad file search tool'}).kind).toBe('fatal');
  });
});
