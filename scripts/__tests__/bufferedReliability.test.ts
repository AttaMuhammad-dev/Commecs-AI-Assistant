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
  it('retries an incomplete late-fee follow-up before releasing its text', async () => {
    let calls = 0; const received: string[] = [];
    await generateChatStream('Tell me more', [], new AbortController().signal, 'fast', text => { received.push(text); }, () => undefined, undefined,
      async () => (async function* () { yield chunk(++calls === 1 ? 'Readmission costs Rs.10000.' : 'The late penalty is Rs.1000. Readmission costs Rs.10000.', 'STOP'); })(),
      { buffered: true, requireSources: true, questionContext: 'What happens if college fees are paid late?' });
    expect(calls).toBe(2); expect(received).toEqual(['The late penalty is Rs.1000. Readmission costs Rs.10000.']);
  });
  it('rejects an invented fee before releasing text, then retries with the supported amount', async () => {
    let calls = 0; const received: string[] = [];
    await generateChatStream('Explain the late payment fee', [], new AbortController().signal, 'fast', text => { received.push(text); }, () => undefined, undefined,
      async () => (async function* () { yield chunk(++calls === 1 ? 'Late fees: Rs. 999999.' : 'Late fees: Rs. 1000.', 'STOP'); })(), { buffered: true, requireSources: true });
    expect(calls).toBe(2); expect(received).toEqual(['Late fees: Rs. 1000.']);
  });
  it('accepts readable official retrieval figures, not a bare grounding link', async () => {
    const provider = (readable: boolean): StreamProvider => async () => (async function* () { yield { candidates: [{ content: { parts: [{ text: 'The amount is Rs. 777777.' }] }, finishReason: 'STOP', groundingMetadata: { groundingChunks: [{ retrievedContext: { uri: 'https://commecscollege.edu.pk/about/', title: 'About', ...(readable ? { text: 'The amount is Rs. 777777.' } : {}) } }] } }] }; })();
    await expect(run(provider(false))).rejects.toMatchObject({ code: 'UNGROUNDED' });
    resetQuotaForTests(); expect((await run(provider(true))).text).toContain('777777');
  });
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
