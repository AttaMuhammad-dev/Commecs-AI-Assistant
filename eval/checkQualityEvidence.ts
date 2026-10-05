import { readFileSync } from 'node:fs';
import { qualityCases, QUALITY_REVIEW } from './qualityCases.js';
import { safeSourceUrl } from '../shared/chat.js';
const kb = JSON.parse(readFileSync('server/data/local-knowledge.json', 'utf8')) as { documents: { url: string; text: string; kind: string }[] };
let issues = 0;
const ids = new Set<string>();
for (const test of qualityCases) {
  if (ids.has(test.id)) { issues++; console.log('Duplicate case: ' + test.id); } ids.add(test.id);
  for (const fact of test.facts) {
    new RegExp(fact.pattern, 'is');
    if (fact.source && (!safeSourceUrl(fact.source) || !fact.anchor || !kb.documents.some(d => d.kind !== 'reviewed' && d.url === fact.source && d.text.toLowerCase().includes(fact.anchor!.toLowerCase())))) { issues++; console.log(test.id + ': original-source anchor missing for ' + fact.label); }
  }
}
console.log(JSON.stringify({ cases: qualityCases.length, issues, review: QUALITY_REVIEW, categories: [...new Set(qualityCases.map(t => t.category))] }));
if (issues) process.exitCode = 1;
