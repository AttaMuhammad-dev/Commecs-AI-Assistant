import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseSSE } from '../src/lib/sseParser.js';
import { routeQuestion } from '../server/router.js';
import { scoreAnswer, type EvalCase } from './scoring.js';
import type { Source } from '../shared/chat.js';
const args = process.argv.slice(2);
const flag = (name:string, fallback:string) => args.find(a => a.startsWith('--' + name + '='))?.split('=')[1] || fallback;
async function main() {
  const lane = flag('lane','fast');
  if (!['fast','deep','all'].includes(lane)) throw new Error('Use --lane=fast|deep|all.');
  const max = Number(flag('max','5')), delay = Number(flag('delay','11000'));
  if (!Number.isInteger(max) || max < 1 || max > 30 || !Number.isFinite(delay) || delay < 0) throw new Error('Use --max=1..30 and a nonnegative delay.');
  const all: EvalCase[] = JSON.parse(readFileSync('eval/golden.json','utf8'));
  const selected = all.filter(c => !c.manualReview && (lane === 'all' || routeQuestion(c.q,[]).lane === lane)).slice(0, max);
  let deep = 0, failed = 0;
  const rows = ['| Case | Lane | First text ms | Total ms | Result |','|---|---|---:|---:|---|'];
  for (const test of selected) {
    if (routeQuestion(test.q,[]).lane === 'deep' && ++deep > 8) continue;
    const start = Date.now();
    let firstText = 0, text = '', usedLane = '', fallback = false, finishReason = '';
    let sources: Source[] = [];
    let failures: string[];
    try {
      const response = await fetch('http://localhost:8787/api/chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:test.q,history:[]}),signal:AbortSignal.timeout(60000)});
      if (!response.ok || !response.body) throw new Error('HTTP ' + response.status);
      for await (const {event,data} of parseSSE(response.body)) {
        if (event === 'error') throw new Error(String(data.code));
        if (event === 'chunk' && typeof data.text === 'string') { if (!firstText) firstText = Date.now()-start; text += data.text; }
        if (event === 'status') usedLane = String(data.lane);
        if (event === 'sources' && Array.isArray(data.sources)) sources = data.sources as Source[];
        if (event === 'meta') fallback = data.fallback === true;
        if (event === 'done') finishReason = String(data.finishReason);
      }
      failures = scoreAnswer(test,{text,lane:usedLane,sources,fallback,finishReason});
    } catch(error) { failures = [error instanceof Error ? error.message : 'request failed']; }
    if (failures.length) failed++;
    const result = failures.length ? failures.join('; ').replaceAll('|','/') : 'PASS';
    console.log(test.id + ': ' + result);
    rows.push('| ' + test.id + ' | ' + usedLane + ' | ' + firstText + ' | ' + (Date.now()-start) + ' | ' + result + ' |');
    if (test !== selected.at(-1)) await new Promise(resolve => setTimeout(resolve,delay));
  }
  mkdirSync('eval/results',{recursive:true});
  writeFileSync('eval/results/' + Date.now() + '.md', '# Live evaluation\n\n' + rows.join('\n') + '\n\nManual-review cases are skipped until their facts are checked against current official sources.\n');
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Evaluation failed'); process.exitCode = 1; });
