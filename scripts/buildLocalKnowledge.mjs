import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Only public college information, never applicant/interview/result lists or blogs.
const approved = new Set([
  'about', 'faqs', 'contact-us', 'instructions-for-admission', 'eligibility',
  'admission-criteria', 'commecs-admission-test', 'admission-test-schedule',
  'register-for-admissions', 'fee-payment-policy', 'sibling-discount', 'alumni-discount',
  'scholarship-endowment-policies-session', 'downloads', 'student-portal',
  'internal-examination-policy-2026-2027', 'students-code-of-conduct',
  'discipline-policy', 'harassment-policy', 'grievances-settlemnet-policy',
  'social-media-policy', 'conflict-of-interest-policy', 'macro-plan',
  'merit-positions', 'merit-scholarships-holders',
]);
const manifest = JSON.parse(readFileSync('knowledge/manifest.json', 'utf8'));
const resources = JSON.parse(readFileSync('src/data/collegeResources.json', 'utf8'));
const documents = manifest.filter(p => p.status === 'included' && p.type === 'page' && approved.has(p.slug)).map(p => {
  const text = readFileSync(`knowledge/pages/${p.slug}.md`, 'utf8').replace(/\r\n/g, '\n').replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
  const resource = resources.find(r => r.url === p.url);
  return { id: p.slug, title: p.title, url: p.url, modified: p.modifiedGmt,
    keywords: resource?.keywords || '', text, verifiedAt: 0, kind: 'page' };
});
const bank = JSON.parse(readFileSync('server/data/verified-answers.json', 'utf8'));
for (const entry of bank) {
  if (!entry.verified || !entry.sources?.length || !Number.isFinite(entry.verifiedAt)) continue;
  documents.push({ id: entry.id, title: entry.match[0], url: entry.sources[0].url,
    modified: manifest.find(p => p.url === entry.sources[0].url)?.modifiedGmt || '', keywords: entry.match.join(' '),
    sources: entry.sources.map(s => ({ ...s, modified: manifest.find(p => p.url === s.url)?.modifiedGmt, reviewedAt: new Date(entry.verifiedAt).toISOString() })),
    text: entry.answer, verifiedAt: entry.verifiedAt, kind: 'reviewed' });
}
const version = createHash('sha256').update(JSON.stringify(documents)).digest('hex');
writeFileSync('server/data/local-knowledge.json', JSON.stringify({ version, documents }, null, 2) + '\n');
console.log(`Built ${documents.length} public pages and reviewed answers; no remote indexing or API cost.`);
