import { getSavedEvidence } from './savedEvidence.js';
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
import { getFacultyAnswer, refreshPublicFaculty } from './faculty.js';
import { getTimetableAnswer, checkTimetable } from './timetable.js';
import { getProgramAnswer } from './programs.js';
import { sourceWithDates } from './knowledge.js';
import { resolveLanguage, type ChatEvent, type Lane } from '../shared/chat.js';
import { selectAnswerSources } from '../shared/answerSources.js';
import { planQuery, withQuestionContext } from './queryPlan.js';
import { randomUUID } from 'node:crypto';
import { acquireSharedTraffic, trafficMode } from './sharedTraffic.js';
import { authorizedOperations, operationsSnapshot, recordOutcome, safeOutcomeCode, type Outcome } from './operations.js';
import { sourceAuditSummary, withSourceCheck } from './sourceFreshness.js';
import { boundaryResponse } from './boundaries.js';
import { publicSourceHealth } from './publicRead.js';

export const app = new Hono();
app.use('/api/*', cors({
  origin: (origin) => (process.env.ALLOWED_ORIGINS || 'https://commecs-ai-assistant.vercel.app,https://commecs-chatbot.vercel.app,http://localhost:5173').split(',').map(s => s.trim()).includes(origin) ? origin : undefined,
  allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type'], maxAge: 600,
}));
app.use('/api/chat', bodyLimit({ maxSize: 32768, onError: c => c.json({ code: 'BAD_REQUEST', message: 'Request too large.' }, 413) }));
app.get('/api/health', c => { c.header('Cache-Control', 'no-store'); return c.json({ ok: true, ready: !!process.env.GEMINI_API_KEY?.trim(), version: '2.7.1', build: 'public-source-runtime-20261006', localFaculty: true, savedSourceFallback: true, knowledgeUpdatedAt: getKbVersion() || null, trafficControl: trafficMode(), sourceAudit: sourceAuditSummary(), publicSources: publicSourceHealth() }); });
app.get('/api/metrics', c => { c.header('Cache-Control', 'no-store'); return authorizedOperations(c.req.header('Authorization')) ? c.json({ ...operationsSnapshot(), trafficControl: trafficMode(), sourceAudit: sourceAuditSummary() }) : c.json({ message: 'Not found' }, 404); });

app.post('/api/chat', async c => {
  if (!/^application\/json(?:;|$)/i.test(c.req.header('Content-Type') || '')) return c.json({ code: 'BAD_REQUEST', message: 'Requires application/json.' }, 400);
  // Only trust a proxy-controlled address in Vercel. Local dev shares one bucket.
  const ip = process.env.VERCEL ? (c.req.header('x-vercel-forwarded-for') || 'unknown').split(',')[0].trim() : 'local';
  let body;
  try { body = sanitizeRequest(await c.req.json()); }
  catch (error) { return c.json({ code: 'BAD_REQUEST', message: error instanceof Error ? error.message : 'Invalid question.' }, 400); }
  const { message, history, preferences } = body;
  const proposedHistory = withQuestionContext(history, body.questionContext);
  const usesContext = planQuery(message, proposedHistory).contextual !== message;
  const questionContext = usesContext ? body.questionContext : undefined;
  const retrievalHistory = usesContext ? proposedHistory : history;
  const started = Date.now();
  const requestId = randomUUID(); c.header('X-Request-Id', requestId);
  const safety = distressReply(message);
  const notice = !safety ? boundaryResponse(message, preferences) : null;
  const timetable = !safety && !notice ? getTimetableAnswer(message, retrievalHistory, preferences) : null;
  const faculty = !safety && !notice && !timetable ? getFacultyAnswer(message, retrievalHistory, preferences) : null;
  const bankCandidate = !safety && !notice && !faculty && !timetable && retrievalHistory.length === 0 && preferences.responseStyle === 'concise' ? getVerifiedAnswer(message, getKbVersion()) : null;
  const bank = bankCandidate && (preferences.language === 'auto' || bankCandidate.language === preferences.language) ? bankCandidate : null;
  let local = timetable || faculty || (!safety && !notice && !bank ? getProgramAnswer(message, preferences) || getLocalGuideAnswer(message, preferences) : null);
  const route = routeQuestion(message, retrievalHistory);
  const lane: Lane = bank ? 'verified' : route.lane;
  const cached = !safety && !notice && !bank && !local && process.env.CACHE_ENABLED !== 'false' ? getCachedResponse(message, retrievalHistory, lane, preferences) : null;
  let backup = !safety && !notice && !local && !bank ? getSavedEvidence(message, retrievalHistory, preferences) : null;
  let locallyLimited = false;
  // Local answers do not spend provider quota and must remain available during a demo burst.
  if (!safety && !notice && !bank && !local && !cached && !checkRateLimit(ip)) { if (backup) locallyLimited = true; else { c.header('Retry-After', '60'); return c.json({ code: 'RATE_LIMITED', message: 'Please wait before asking again.' }, 429); } }
  c.header('Cache-Control', 'no-store');
  c.header('X-Accel-Buffering', 'no');
  return streamSSE(c, async stream => {
    const emit = (event: ChatEvent) => stream.writeSSE({ event: event.event, data: JSON.stringify(event.event === 'sources' ? { sources: event.data.sources.map(source => withSourceCheck(source)) } : event.data) });
    const ac = new AbortController();
    const abort = () => ac.abort();
    if (c.req.raw.signal.aborted) abort();
    c.req.raw.signal.addEventListener('abort', abort, { once: true });
    stream.onAbort(abort);
    const timeout = setTimeout(abort, 35000);
    const heartbeat = setInterval(() => { void stream.write(': keep-alive\n\n').catch(abort); }, 5000);
    // Reasoning requests may need all three bounded model attempts; ordinary lookups retain the shorter deadline.
    const evidenceTimeout = backup ? setTimeout(abort, lane === 'deep' ? 30000 : 15000) : undefined;
    let ttftMs = 0;
    let hasOutput = false;
    let release: (() => void) | null = null;
    let releaseShared: (() => Promise<void>) | undefined;
    let outcome: Outcome = 'error', outcomeCode: string | undefined;
    try {
      await emit({ event: 'status', data: { lane } });
      if ((faculty || timetable) && process.env.NODE_ENV !== 'test' && process.env.LIVE_WEBSITE_ENABLED !== 'false') {
        await emit({ event: 'progress', data: { phase: 'website' } });
        if(timetable) local=getTimetableAnswer(message,retrievalHistory,preferences,await checkTimetable(ac.signal));
        else { const refreshed=await refreshPublicFaculty(ac.signal);if(!refreshed) await emit({event:'progress',data:{phase:'websiteSaved'}});local=getFacultyAnswer(message,retrievalHistory,preferences); }
        if(ac.signal.aborted||stream.aborted) {outcome='cancelled';return;}
      }
      await emit({ event: 'meta', data: { mode: lane, cached: !!cached, local: !!local, verifiedAt: bank?.verifiedAt, ...(notice ? { notice: notice.notice } : {}) } });
      const instant = safety || notice?.text || bank?.answer || local?.answer || cached?.text;
      if (instant) {
        outcome = notice ? 'guarded' : bank ? 'reviewed' : local ? 'local' : cached ? 'cached' : 'local';
        await emit({ event: 'progress', data: { phase: bank ? 'reviewed' : local ? 'saved' : cached ? 'cached' : 'service' } });
        await emit({ event: 'chunk', data: { text: instant } });
        const sources = selectAnswerSources(instant, bank ? bank.sources.map((source: import('../shared/chat.js').Source) => sourceWithDates(source, bank.verifiedAt)) : local?.sources || cached?.sources || []);
        if (sources.length) await emit({ event: 'sources', data: { sources } });
        await emit({ event: 'done', data: { finishReason: 'STOP' } });
        return;
      }
      if (locallyLimited) throw Object.assign(new Error('Rate limited'), { code: 'RATE_LIMITED' });
      release = acquireCapacity();
      if (!release) throw Object.assign(new Error('Busy'), { code: 'BUSY' });
      const gate = await acquireSharedTraffic(ip, ac.signal);
      if (!gate.allowed) throw Object.assign(new Error('Live traffic unavailable'), { code: gate.code });
      releaseShared = gate.release;
      const result = await generateChatStream(message, history, ac.signal, lane,
        async text => { clearTimeout(evidenceTimeout); if (!hasOutput) ttftMs = Date.now() - started; hasOutput = true; await emit({ event: 'chunk', data: { text } }); },
        async sources => { await emit({ event: 'sources', data: { sources } }); }, preferences, undefined, {
          buffered: true, requireSources: true, questionContext,
          onProgress: async progress => { if (!ac.signal.aborted && !stream.aborted) await emit({ event: 'progress', data: progress }); },
          onEvidence: evidence => { backup = getSavedEvidence(message, retrievalHistory, preferences, evidence) || backup; },
        });
      // Never cache partial, blocked or ungrounded answers.
      if (process.env.CACHE_ENABLED !== 'false' && result.finishReason === 'STOP' && result.text.trim().length > 20 && result.sources.length) {
        setCachedResponse(message, retrievalHistory, result.text, result.sources, lane, preferences);
      }
      await emit({ event: 'done', data: { finishReason: result.finishReason } });
      outcome = result.finishReason === 'STOP' ? 'live' : 'error';
      console.info(JSON.stringify({ lane, model: result.model, thinking: result.thinking, attempts: result.attempts, ttftMs, totalMs: Date.now() - started, sources: result.sources.length, finishReason: result.finishReason }));
    } catch (error) {
      if (stream.aborted || c.req.raw.signal.aborted) { outcome = 'cancelled'; return; }
      const code = safeOutcomeCode((error as { code?: unknown })?.code);
      outcomeCode = code;
      if (hasOutput) { await emit({ event: 'done', data: { finishReason: 'INTERRUPTED' } }); return; }
      if (backup && code !== 'BLOCKED' && !c.req.raw.signal.aborted) {
        outcome = 'saved';
        await emit({ event: 'progress', data: { phase: 'fallback' } });
        await emit({ event: 'meta', data: { mode: lane, cached: false, local: true, fallback: true } });
        await emit({ event: 'chunk', data: { text: backup.answer } });
        await emit({ event: 'sources', data: { sources: selectAnswerSources(backup.answer, backup.sources) } });
        await emit({ event: 'done', data: { finishReason: 'STOP' } });
        console.info(JSON.stringify({ event: 'saved_source_fallback', code, totalMs: Date.now() - started }));
        return;
      }
      const responseLanguage = resolveLanguage(message, preferences.language);
      outcome = 'service';
      const isUrdu = responseLanguage === 'ur';
      const text = isUrdu
        ? 'میں اس وقت کالج کی معلومات کی تصدیق نہیں کر پا رہا۔ دوبارہ کوشش کریں یا داخلہ دفتر سے رابطہ کریں۔'
        : responseLanguage === 'roman' ? 'Main is waqt yeh maloomat check nahi kar pa raha. Dobara koshish karein ya neeche diye gaye admission office se rabta karein.'
        : code === 'NOT_CONFIGURED' ? 'The assistant is not connected to college information yet. You can still contact admissions below.'
        : code === 'QUOTA_EXCEEDED' ? 'The assistant has reached a usage limit for now. Please try again later or contact admissions below.'
        : code === 'BUSY' ? 'The assistant is helping several people right now. Try again shortly, or browse the college guide without waiting.'
        : code === 'BLOCKED' ? 'I couldn’t answer that question. Try asking about college programs, fees or admissions.'
        : 'I couldn’t complete that lookup. Please try again or contact admissions below.';
      await emit({ event: 'progress', data: { phase: 'service' } });
      await emit({ event: 'meta', data: { mode: lane, cached: false, fallback: true } });
      await emit({ event: 'chunk', data: { text } });
      await emit({ event: 'contact', data: contactInfo });
      await emit({ event: 'done', data: { finishReason: 'STOP' } });
      console.info(JSON.stringify({ lane, fallback: true, code, totalMs: Date.now() - started }));
    } finally { release?.(); clearTimeout(timeout); clearInterval(heartbeat); clearTimeout(evidenceTimeout); c.req.raw.signal.removeEventListener('abort', abort); recordOutcome(requestId, outcome, Date.now() - started, outcomeCode); await releaseShared?.(); }
  });
});



