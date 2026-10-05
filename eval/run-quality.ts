import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseSSE } from '../src/lib/sseParser.js';
import { sanitizeSources, type Source } from '../shared/chat.js';
import { qualityCases, QUALITY_REVIEW } from './qualityCases.js';
import { scoreQuality } from './qualityScoring.js';
const option = (name: string, fallback: string) => process.argv.slice(2).find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3) || fallback;
type QualityRow = { id: string; category: string; question: string; questionContext?: string; score: ReturnType<typeof scoreQuality>; error?: string; mode: string; milliseconds: number; text: string; sources: Source[]; humanReview: { reviewer: string; reviewedAt: string; correctness: null; completeness: null; claimCitationSupport: null; adviceQuality: null; notes: string } };
async function main() {
  const base = new URL(option('base', 'http://localhost:3000'));
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Use an HTTP(S) base URL without credentials or query parameters.');
  const max = Number(option('max', '6')), delay = Number(option('delay', '12000')), only = option('only', '').split(',').filter(Boolean);
  if (!Number.isInteger(max) || max < 1 || max > qualityCases.length || !Number.isFinite(delay) || delay < 12000 || only.some(id => !qualityCases.some(t => t.id === id))) throw new Error('Invalid case selection or delay; use at least 12000 ms between requests.');
  const selected = qualityCases.filter(t => !only.length || only.includes(t.id)).slice(0, max);
  const output = option('out', 'eval/results/quality-latest.json'), results: QualityRow[] = [];
  const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify({ checkedAt: new Date().toISOString(), base: base.origin, review: QUALITY_REVIEW, results, humanReviewRequired: true }, null, 2)); };
  for (const test of selected) {
    if (results.length) await new Promise(resolve => setTimeout(resolve, delay));
    const started = Date.now(); let text = '', finishReason = '', fallback = false, mode = '', sources: Source[] = [];
    let error: string | undefined;
    try {
      const response = await fetch(new URL('/api/chat', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: test.question, questionContext: test.questionContext, history: [], preferences: { language: test.language, responseStyle: 'detailed' } }), signal: AbortSignal.timeout(45000) });
      if (!response.ok || !response.body) throw new Error('HTTP ' + response.status);
      for await (const { event, data } of parseSSE(response.body)) {
        if (event === 'chunk' && typeof data.text === 'string') text += data.text;
        if (event === 'sources') sources = sanitizeSources(data.sources);
        if (event === 'meta') { fallback = data.fallback === true; mode = fallback ? 'fallback' : data.cached ? 'cached' : data.local ? 'local' : 'live/reviewed'; }
        if (event === 'done') finishReason = String(data.finishReason);
        if (event === 'error') throw new Error('Stream failed');
      }
    } catch (e) { error = e instanceof Error ? e.message : 'Request failed'; }
    const score = scoreQuality(test, { text, sources, finishReason, fallback });
    const row: QualityRow = { id: test.id, category: test.category, question: test.question, questionContext: test.questionContext, score, error, mode, milliseconds: Date.now() - started, text, sources,
      humanReview: { reviewer: '', reviewedAt: '', correctness: null, completeness: null, claimCitationSupport: null, adviceQuality: null, notes: '' } };
    results.push(row); save();
    console.log(JSON.stringify({ id: row.id, passed: score.passed && !error, failures: score.failures, error, mode, milliseconds: row.milliseconds }));
  }
  if (results.some(r => !r.score.passed || r.error)) process.exitCode = 1;
}
main().catch(() => { console.error('Quality evaluation could not complete; check the base URL and flags.'); process.exitCode = 1; });
