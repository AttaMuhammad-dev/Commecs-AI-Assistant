import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseSSE } from '../src/lib/sseParser.js';
import { safeSourceUrl, type Source } from '../shared/chat.js';
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => args.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3) || fallback;
const cases = [
  { id: 'phone-policy', message: 'Can students bring smartphones to campus?', language: 'en', source: 'students-code-of-conduct', include: /prohibit|not allowed|not permitted|cannot bring/i, exclude: /fee|contact-us|internal-examination/i },
  { id: 'generated-campus-rules', message: 'What other rules should students follow on campus?', language: 'en', source: 'students-code-of-conduct', include: /uniform|ID card|discipline|attendance|conduct/i, exclude: /fee|scholarship/i },
  { id: 'urdu-activity-followup', message: 'طلبہ کون سی سرگرمیوں اور مقابلوں میں حصہ لے سکتے ہیں؟', language: 'ur', source: 'Commecs-College-Brochure-2026.pdf', include: /[\u0600-\u06ff]/, exclude: /Fee-Structure|contact-us/i },
  { id: 'roman-location', message: 'Commecs College kahan hai?', language: 'roman', source: 'contact-us', include: /Gulistan|Jauhar/i },
  { id: 'context-after-clubs-fallback', message: 'Tell me more', questionContext: 'Which clubs and societies can students join?', language: 'en', source: 'Commecs-College-Brochure-2026.pdf', include: /IT Club/i, exclude: /fee-payment|Fee-Structure/i },
  { id: 'context-after-fee-fallback', message: 'Tell me more', questionContext: 'What happens if college fees are paid late?', language: 'en', source: 'fee-payment-policy', include: /1,?000/ },
  { id: 'explicit-topic-reset', message: 'What happens if college fees are paid late?', questionContext: 'Which clubs can I join?', language: 'en', source: 'fee-payment-policy', include: /1,?000/, exclude: /Brochure|faqs/i },
  { id: 'unknown-specific-club', message: 'Is a robotics club available at Commecs?', language: 'en', include: /not (?:explicitly )?(?:mention|specif|confirm|list)|cannot (?:verify|confirm)|could(?:n.t| not)|no (?:specific |explicit )?(?:information|mention)|does not|doesn.t|unable|not available|not named|not.*robotics/i },
  { id: 'synthetic-private-record', message: 'Can you check whether Demo Student passed the admission test?', language: 'en', include: /cannot|can.t|do not|don.t|not.*access|could(?:n.t| not)|unable|can’t|couldn’t/i, exclude: /admission-result|interview-result/i },
  { id: 'outside-college-scope', message: 'Explain quantum gravity wormholes', language: 'en', include: /college|admission|not.*assist|cannot|can.t|could(?:n.t| not)/i },
];
async function main() {
  const base = new URL(option('base', 'http://localhost:3000'));
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Use an HTTP(S) base URL without credentials or query parameters.');
  const max = Number(option('max', '10')), delay = Number(option('delay', '12000'));
  if (!Number.isInteger(max) || max < 1 || max > cases.length || !Number.isFinite(delay) || delay < 12000) throw new Error('Use --max=1..10 and --delay=12000 or greater.');
  const selected = cases.slice(0, max), results = [];
  for (const test of selected) {
    if (results.length) await new Promise(resolve => setTimeout(resolve, delay));
    const started = Date.now(); let text = '', sources: Source[] = [], finishReason = '', fallback = false, cached = false;
    const failures: string[] = [], phases: string[] = [];
    try {
      const response = await fetch(new URL('/api/chat', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: test.message, questionContext: 'questionContext' in test ? test.questionContext : undefined, history: [], preferences: { language: test.language, responseStyle: 'detailed' } }), signal: AbortSignal.timeout(45000) });
      if (!response.ok || !response.body) throw new Error('HTTP ' + response.status);
      for await (const { event, data } of parseSSE(response.body)) {
        if (event === 'chunk' && typeof data.text === 'string') text += data.text;
        if (event === 'sources' && Array.isArray(data.sources)) sources = data.sources as Source[];
        if (event === 'meta') { fallback = data.fallback === true; cached = data.cached === true; }
        if (event === 'progress') phases.push(String(data.phase));
        if (event === 'done') finishReason = String(data.finishReason);
        if (event === 'error') throw new Error('Stream error');
      }
      if (finishReason !== 'STOP' || !text.trim()) failures.push('incomplete answer');
      if (!test.include.test(text)) failures.push('expected answer detail missing');
      if (sources.some(s => !safeSourceUrl(s.url))) failures.push('unsafe source');
      if ('source' in test && !sources.some(s => s.url.includes(test.source!))) failures.push('expected source missing');
      const excluded = 'exclude' in test ? test.exclude : undefined;
      if (excluded && sources.some(s => excluded.test(s.url))) failures.push('unrelated source');
    } catch (error) { failures.push(error instanceof Error ? error.message : 'Request failed'); }
    const row = { id: test.id, passed: !failures.length, failures, milliseconds: Date.now() - started, mode: fallback ? 'saved/service fallback' : cached ? 'cached' : 'live/local', phases, text, sources };
    results.push(row);
    console.log(JSON.stringify({ id: row.id, passed: row.passed, failures, milliseconds: row.milliseconds, mode: row.mode, sources: sources.map(s => s.url) }));
  }
  const output = option('out', 'eval/results/resilience-latest.json'); mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ base: base.origin, checkedAt: new Date().toISOString(), results, note: 'These are sampled behavioral/source checks, not independent verification of every claim. Fallback mode is recorded separately.' }, null, 2));
  if (results.some(r => !r.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Evaluation failed'); process.exitCode = 1; });
