import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { generateChatStream, type StreamProvider } from '../../server/gemini';
import { resetQuotaForTests } from '../../server/quota';
import { getFastLadder } from '../../server/config/models';

const chunk = (text: string, finishReason?: string, grounded = false) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason,
  ...(grounded ? { groundingMetadata: { groundingChunks: [{ retrievedContext: { uri: 'https://commecscollege.edu.pk/about/', title: 'About' } }] } } : {}),
}] });
beforeEach(() => { resetQuotaForTests(); vi.stubEnv('MODEL_LADDER_FAST', 'gemini-3.5-flash-lite,gemini-3.1-flash-lite'); vi.stubEnv('FAKE_UPSTREAM_ERROR', ''); });
afterEach(() => vi.unstubAllEnvs());
const run = (provider: StreamProvider, received: string[] = []) => generateChatStream('A completely unknown campus fact', [], new AbortController().signal, 'fast', t => { received.push(t); }, () => undefined, undefined, provider, { buffered: true, requireSources: true });
describe('buffered live replies', () => {
  it('discards interrupted output and sends only a complete alternate answer', async () => {
    let calls = 0;
    const received: string[] = [];
    const result = await run(async () => {
      const attempt = ++calls;
      return (async function* () {
        if (attempt === 1) { yield chunk('Unfinished first answer'); throw { status: 503 }; }
        yield chunk('Complete alternate answer', 'STOP', true);
      })();
    }, received);
    expect(received).toEqual(['Complete alternate answer']);
    expect(result.finishReason).toBe('STOP');
    expect(calls).toBe(2);
  });
  it('does not expose complete college claims without official evidence', async () => {
    const received: string[] = []; let calls = 0;
    await expect(run(async () => { calls++; return (async function* () { yield chunk('Invented campus fact', 'STOP'); })(); }, received)).rejects.toMatchObject({ code: 'UNGROUNDED' });
    expect(received).toEqual([]);
    expect(calls).toBeLessThanOrEqual(3);
  });
  it('uses bundled evidence without requiring a remote store', async () => {
    vi.stubEnv('FILE_SEARCH_STORE_NAME', '');
    let tools: unknown; let system: unknown;
    const result = await generateChatStream('Explain penalties for late fee payment', [], new AbortController().signal, 'fast', () => undefined, () => undefined, undefined,
      async params => { tools = params.config?.tools; system = params.config?.systemInstruction; return (async function* () { yield chunk('The saved fee policy describes a Rs.1,000 late payment penalty.', 'STOP'); })(); },
      { buffered: true, requireSources: true });
    expect(String(system)).toContain('Rs.1,000');
    expect(result.sources.length).toBeGreaterThan(0);
    expect(tools).toBeUndefined();
  });
  it('recovers from invalid configured model identifiers', () => {
    vi.stubEnv('MODEL_LADDER_FAST', 'retired-model,typo');
    expect(getFastLadder()[0]).toBe('gemini-3.5-flash-lite');
  });
});
