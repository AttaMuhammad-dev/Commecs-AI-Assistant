import { readFileSync } from 'node:fs';
import { normalizeForBank } from '../server/bank.js';
import { getKbVersion } from '../server/cache.js';
import { safeSourceUrl } from '../shared/chat.js';
const bank: { id:string; match:string[]; verified:boolean; verifiedAt:number; answer:string; sources:{title:string;url:string}[] }[] = JSON.parse(readFileSync('server/data/verified-answers.json','utf8'));
const seen = new Set<string>();
let issues = 0;
for (const entry of bank) {
  const problems: string[] = [];
  if (!entry.verified) problems.push('unverified');
  if (!Number.isFinite(entry.verifiedAt) || entry.verifiedAt < getKbVersion() || Date.now()-entry.verifiedAt > 30*86400000 || entry.verifiedAt > Date.now()+86400000) problems.push('stale or invalid review date');
  if (!entry.answer?.trim() || !entry.sources?.length || entry.sources.some(s => !safeSourceUrl(s.url))) problems.push('missing answer or official source');
  for(const variant of entry.match || []) {
    const normalized = normalizeForBank(variant);
    if(seen.has(normalized)) problems.push('duplicate variant: ' + variant);
    seen.add(normalized);
  }
  if (problems.length) { issues++; console.log(entry.id + ': ' + problems.join('; ')); }
}
console.log(bank.length + ' entries checked; ' + issues + ' need review. No verification dates were changed.');
if (issues) process.exitCode=1;
