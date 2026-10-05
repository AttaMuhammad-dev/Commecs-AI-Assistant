import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { auditPublicPage } from './lib/freshness.js';
const option = (name: string, fallback: string) => process.argv.slice(2).find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3) || fallback;
async function main() {
  const kb = JSON.parse(readFileSync('server/data/local-knowledge.json', 'utf8')) as { documents: { id: string; url: string; modified: string; text: string; kind: string }[] };
  const bank = JSON.parse(readFileSync('server/data/verified-answers.json', 'utf8')) as { id: string; sources: { url: string }[]; verifiedAt: number }[];
  const max = Number(option('max', '25'));
  if (!Number.isInteger(max) || max < 1 || max > 25) throw new Error('Use --max=1..25');
  const pages = kb.documents.filter(d => d.kind === 'page').slice(0, max), results = [];
  // At most three bounded public requests at a time; no posts or applicant lists.
  for (let i = 0; i < pages.length; i += 3) {
    const batch = await Promise.all(pages.slice(i, i + 3).map(p => auditPublicPage({ ...p, slug: p.id }, bank.filter(b => b.sources.some(s => s.url === p.url)).map(b => b.id))));
    results.push(...batch); for (const row of batch) console.log(JSON.stringify({ url: row.url, status: row.status, affectedAnswers: row.affectedAnswers.length }));
  }
  const report = { checkedAt: new Date().toISOString(), sources: results, totalPublicPages: kb.documents.filter(d => d.kind === 'page').length, auditedPages: pages.length,
    expiredAnswers: bank.filter(b => Date.now() - b.verifiedAt > 30 * 86400000).map(b => b.id), humanReviewRequired: true,
    note: 'A changed page needs review. An unavailable check is unknown. Neither checkedAt nor modified time is a human review or proof that every policy is current. Corpus, remote index and answer review dates are unchanged.' };
  const output = option('out', 'eval/results/knowledge-freshness.json'); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2));
  if (process.argv.includes('--write-status')) {
    if (pages.length !== report.totalPublicPages) throw new Error('A partial audit cannot replace the runtime status.');
    writeFileSync('knowledge/audit-status.json', JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ checked: pages.length, changed: results.filter(r => r.status === 'changed').length, unavailable: results.filter(r => r.status === 'unavailable').length, expiredAnswers: report.expiredAnswers.length }));
  if (results.some(r => r.status !== 'unchanged') || report.expiredAnswers.length) process.exitCode = 1;
}
main().catch(() => { console.error('Source audit could not complete. Check input files and flags; no review dates were changed.'); process.exitCode = 1; });
