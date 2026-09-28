import { GoogleGenAI, ThinkingLevel as SDKThinkingLevel, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { buildSystemPrompt } from './systemPrompt.js';
import { getFastLadder, getDeepLadder, clampThinking, downgradedModels, type ThinkingLevel } from './config/models.js';
import { isExhausted, markExhausted, coolDown } from './quota.js';
import { ChatError, classifyProviderError } from './errors.js';
import { DEFAULT_PREFERENCES, safeSourceUrl, type Preferences, type Source, type FinishReason } from '../shared/chat.js';

export type StreamProvider = (params: GenerateContentParameters) => Promise<AsyncIterable<GenerateContentResponse>>;

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new ChatError('ABORTED', 'Request stopped.'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new ChatError('ABORTED', 'Request stopped.'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function generateChatStream(
  message: string, history: { role: string; text: string }[], signal: AbortSignal, lane: string,
  onChunk: (text: string) => Promise<void> | void,
  onSources: (sources: Source[]) => Promise<void> | void,
  preferences: Preferences = DEFAULT_PREFERENCES,
  provider?: StreamProvider
) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const rawStore = process.env.FILE_SEARCH_STORE_NAME?.trim();
  if ((!apiKey || !rawStore) && !provider) throw new ChatError('NOT_CONFIGURED', 'The assistant is not connected yet.');
  const storeName = 'fileSearchStores/' + (rawStore || 'test').replace(/^(corpora\/|fileSearchStores\/)/, '');
  const generate = provider || ((params: GenerateContentParameters) => new GoogleGenAI({ apiKey }).models.generateContentStream(params));
  const contents = [...history.map(h => ({ role: h.role === 'bot' ? 'model' : h.role, parts: [{ text: h.text }] })), { role: 'user', parts: [{ text: message }] }];
  const ladder = lane === 'deep' ? getDeepLadder() : getFastLadder();
  const started = Date.now();
  let attempts = 0;
  let lastCode = 'QUOTA_EXCEEDED';
  // A single request has at most three provider calls and a 50-second total deadline.
  for (const model of ladder) {
    if (isExhausted(model)) continue;
    let thinking = clampThinking(model, (lane === 'deep' ? process.env.DEEP_THINKING || 'MEDIUM' : process.env.FAST_THINKING || 'MINIMAL') as ThinkingLevel);
    for (let retry = 0; retry < 2; retry++) {
      if (signal.aborted) throw new ChatError('ABORTED', 'Request stopped.');
      if (attempts >= 3 || Date.now() - started >= 50000) throw new ChatError(lastCode, 'No model is available right now.');
      attempts++;
      const ac = new AbortController();
      const forwardAbort = () => ac.abort();
      signal.addEventListener('abort', forwardAbort, { once: true });
      const timer = setTimeout(() => ac.abort(), Math.min(20000, 50000 - (Date.now() - started)));
      let text = '';
      const sourceMap = new Map<string, Source>();
      let finishReason: FinishReason = 'INTERRUPTED';
      let iterator: AsyncIterator<GenerateContentResponse> | undefined;
      try {
        if (process.env.NODE_ENV !== 'production' && process.env.FAKE_UPSTREAM_ERROR) {
          const fake = process.env.FAKE_UPSTREAM_ERROR;
          throw { status: fake.startsWith('429') ? 429 : 503, message: fake === '429-daily' ? 'quota per day' : 'unavailable' };
        }
        const stream = await abortable(generate({ model, contents, config: {
          systemInstruction: buildSystemPrompt(preferences),
          tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
          thinkingConfig: { thinkingLevel: SDKThinkingLevel[thinking], includeThoughts: false },
          maxOutputTokens: lane === 'deep' || preferences.responseStyle === 'detailed' ? 4096 : 2048,
          abortSignal: ac.signal,
        } }), ac.signal);
        iterator = stream[Symbol.asyncIterator]();
        while (true) {
          const item = await abortable(iterator.next(), ac.signal);
          if (item.done) break;
          const candidate = item.value.candidates?.[0];
          if (item.value.promptFeedback?.blockReason) finishReason = 'BLOCKED';
          if (candidate?.finishReason) {
            finishReason = candidate.finishReason === 'STOP' ? 'STOP' : candidate.finishReason === 'MAX_TOKENS' ? 'MAX_TOKENS' : 'BLOCKED';
          }
          for (const grounding of candidate?.groundingMetadata?.groundingChunks || []) {
            const ctx = grounding.retrievedContext;
            if (!ctx) continue;
            const meta = (key: string) => ctx.customMetadata?.find(m => m.key === key)?.stringValue;
            const url = meta('url') || ctx.uri;
            if (url && safeSourceUrl(url)) sourceMap.set(url, { title: meta('title') || ctx.title || 'College source', url, modified: meta('modified'), type: meta('type') });
          }
          const part = candidate?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '';
          if (part) { text += part; await onChunk(part); }
        }
        const sources = Array.from(sourceMap.values()).slice(0, 5);
        if (sources.length) await onSources(sources);
        if (!text.trim()) throw new ChatError(finishReason === 'BLOCKED' ? 'BLOCKED' : 'UPSTREAM_ERROR', 'No answer was returned.');
        return { text, sources, finishReason, model, thinking, attempts };
      } catch (error) {
        if (signal.aborted) throw new ChatError('ABORTED', 'Request stopped.');
        if (text) {
          const sources = Array.from(sourceMap.values()).slice(0, 5);
          if (sources.length) await onSources(sources);
          return { text, sources, finishReason: 'INTERRUPTED' as const, model, thinking, attempts };
        }
        const failure = classifyProviderError(ac.signal.aborted ? { message: 'LOCAL_TIMEOUT' } : error);
        if (failure.kind === 'daily') { markExhausted(model, 'daily'); lastCode = 'QUOTA_EXCEEDED'; break; }
        if (failure.kind === 'minute') { coolDown(model, failure.retryMs); lastCode = 'QUOTA_EXCEEDED'; break; }
        if (failure.kind === 'unavailable') { coolDown(model, 3600000); lastCode = 'MODEL_UNAVAILABLE'; break; }
        if (failure.kind === 'thinking' && retry === 0 && thinking !== 'LOW') { thinking = 'LOW'; downgradedModels.add(model); continue; }
        if (failure.kind === 'transient') { coolDown(model, 15000); lastCode = 'UPSTREAM_ERROR'; break; }
        if (error instanceof ChatError) throw error;
        throw new ChatError('UPSTREAM_ERROR', 'The assistant could not connect. Please try again.');
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', forwardAbort);
        ac.abort();
        // Do not wait indefinitely for a broken provider iterator.
        void iterator?.return?.().catch(() => undefined);
      }
    }
  }
  throw new ChatError(lastCode, 'No model is available right now.');
}
