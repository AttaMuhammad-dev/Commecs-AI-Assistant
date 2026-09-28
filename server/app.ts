import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { sanitizeRequest } from './sanitize.js';
import { checkRateLimit } from './rateLimit.js';
import { getCachedResponse, setCachedResponse, getKbVersion } from './cache.js';
import { generateChatStream } from './gemini.js';
import { contactInfo } from './config/contact.js';
import { routeQuestion } from './router.js';
import { getVerifiedAnswer } from './bank.js';
import { distressReply } from './safety.js';
import { acquireCapacity } from './capacity.js';
import { getLocalGuideAnswer } from './localGuide.js';
import { type ChatEvent, type Lane } from '../shared/chat.js';

export const app = new Hono();
app.use('/api/*', cors({
  origin: (origin) => (process.env.ALLOWED_ORIGINS || 'https://commecs-chatbot.vercel.app,http://localhost:5173').split(',').map(s => s.trim()).includes(origin) ? origin : undefined,
  allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type'], maxAge: 600,
}));
app.use('/api/chat', bodyLimit({ maxSize: 32768, onError: c => c.json({ code: 'BAD_REQUEST', message: 'Request too large.' }, 413) }));
app.get('/api/health', c => { c.header('Cache-Control', 'no-store'); return c.json({ ok: true, ready: !!(process.env.GEMINI_API_KEY?.trim() && process.env.FILE_SEARCH_STORE_NAME?.trim()), version: '2.1', knowledgeUpdatedAt: getKbVersion() || null }); });

app.post('/api/chat', async c => {
  if (!/^application\/json(?:;|$)/i.test(c.req.header('Content-Type') || '')) return c.json({ code: 'BAD_REQUEST', message: 'Requires application/json.' }, 400);
  // Only trust a proxy-controlled address in Vercel. Local dev shares one bucket.
  const ip = process.env.VERCEL ? (c.req.header('x-vercel-forwarded-for') || 'unknown').split(',')[0].trim() : 'local';
  let body;
  try { body = sanitizeRequest(await c.req.json()); }
  catch (error) { return c.json({ code: 'BAD_REQUEST', message: error instanceof Error ? error.message : 'Invalid question.' }, 400); }
  const { message, history, preferences } = body;
  const started = Date.now();
  const safety = distressReply(message);
  const bank = !safety && history.length === 0 && preferences.language === 'auto' && preferences.responseStyle === 'concise' ? getVerifiedAnswer(message, getKbVersion()) : null;
  const local = !safety && !bank ? getLocalGuideAnswer(message, preferences) : null;
  const route = routeQuestion(message, history);
  const lane: Lane = bank ? 'verified' : route.lane;
  const cached = !safety && !bank && !local && process.env.CACHE_ENABLED !== 'false' ? getCachedResponse(message, history, lane, preferences) : null;
  // Local answers do not spend provider quota and must remain available during a demo burst.
  if (!safety && !bank && !local && !cached && !checkRateLimit(ip)) { c.header('Retry-After', '60'); return c.json({ code: 'RATE_LIMITED', message: 'Please wait before asking again.' }, 429); }
  c.header('Cache-Control', 'no-store');
  c.header('X-Accel-Buffering', 'no');
  return streamSSE(c, async stream => {
    const emit = (event: ChatEvent) => stream.writeSSE({ event: event.event, data: JSON.stringify(event.data) });
    const ac = new AbortController();
    const abort = () => ac.abort();
    c.req.raw.signal.addEventListener('abort', abort, { once: true });
    stream.onAbort(abort);
    const timeout = setTimeout(abort, 55000);
    let ttftMs = 0;
    let hasOutput = false;
    let release: (() => void) | null = null;
    try {
      await emit({ event: 'status', data: { lane } });
      await emit({ event: 'meta', data: { mode: lane, cached: !!cached, local: !!local, verifiedAt: bank?.verifiedAt } });
      const instant = safety || bank?.answer || local?.answer || cached?.text;
      if (instant) {
        await emit({ event: 'chunk', data: { text: instant } });
        const sources = bank?.sources || local?.sources || cached?.sources || [];
        if (sources.length) await emit({ event: 'sources', data: { sources } });
        await emit({ event: 'done', data: { finishReason: 'STOP' } });
        return;
      }
      release = acquireCapacity();
      if (!release) throw Object.assign(new Error('Busy'), { code: 'BUSY' });
      const result = await generateChatStream(message, history, ac.signal, lane,
        async text => { if (!hasOutput) ttftMs = Date.now() - started; hasOutput = true; await emit({ event: 'chunk', data: { text } }); },
        async sources => { await emit({ event: 'sources', data: { sources } }); }, preferences);
      // Never cache partial, blocked or ungrounded answers.
      if (process.env.CACHE_ENABLED !== 'false' && result.finishReason === 'STOP' && result.text.trim().length > 20 && result.sources.length) {
        setCachedResponse(message, history, result.text, result.sources, lane, preferences);
      }
      await emit({ event: 'done', data: { finishReason: result.finishReason } });
      console.info(JSON.stringify({ lane, model: result.model, thinking: result.thinking, attempts: result.attempts, ttftMs, totalMs: Date.now() - started, sources: result.sources.length, finishReason: result.finishReason }));
    } catch (error) {
      if (stream.aborted) return;
      const code = (error as { code?: string })?.code || 'UPSTREAM_ERROR';
      if (hasOutput) { await emit({ event: 'done', data: { finishReason: 'INTERRUPTED' } }); return; }
      const isUrdu = preferences.language === 'ur' || (preferences.language === 'auto' && /[\u0600-\u06FF]/.test(message));
      const text = isUrdu
        ? 'میں اس وقت کالج کی معلومات کی تصدیق نہیں کر پا رہا۔ دوبارہ کوشش کریں یا داخلہ دفتر سے رابطہ کریں۔'
        : code === 'NOT_CONFIGURED' ? 'The assistant is not connected to college information yet. You can still contact admissions below.'
        : code === 'QUOTA_EXCEEDED' ? 'The assistant has reached a usage limit for now. Please try again later or contact admissions below.'
        : code === 'BUSY' ? 'The assistant is helping several people right now. Try again shortly, or browse the college guide without waiting.'
        : code === 'BLOCKED' ? 'I couldn’t answer that question. Try asking about college programs, fees or admissions.'
        : 'I couldn’t complete that lookup. Please try again or contact admissions below.';
      await emit({ event: 'meta', data: { mode: lane, cached: false, fallback: true } });
      await emit({ event: 'chunk', data: { text } });
      await emit({ event: 'contact', data: contactInfo });
      await emit({ event: 'done', data: { finishReason: 'STOP' } });
      console.info(JSON.stringify({ lane, fallback: true, code, totalMs: Date.now() - started }));
    } finally { release?.(); clearTimeout(timeout); c.req.raw.signal.removeEventListener('abort', abort); }
  });
});
