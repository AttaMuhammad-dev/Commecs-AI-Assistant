import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ManifestRecord, WpMedia } from './types.js';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const PAGES_DIR = path.join(KNOWLEDGE_DIR, 'pages');
const POSTS_DIR = path.join(KNOWLEDGE_DIR, 'posts');

export async function ensureDirs() {
  await fs.mkdir(PAGES_DIR, { recursive: true });
  await fs.mkdir(POSTS_DIR, { recursive: true });
}

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function loadPreviousManifest(): Promise<Record<string, ManifestRecord>> {
  try {
    const data = await fs.readFile(path.join(KNOWLEDGE_DIR, 'manifest.json'), 'utf-8');
    const arr: ManifestRecord[] = JSON.parse(data);
    return arr.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
  } catch {
    return {};
  }
}

export async function writeDocument(record: ManifestRecord, markdown: string) {
  const dir = record.type === 'page' ? PAGES_DIR : POSTS_DIR;
  const fileName = `${record.slug}.md`;
  record.file = `${record.type}s/${fileName}`;

  const frontMatter = `---
title: "${record.title.replace(/"/g, '\\"')}"
url: ${record.url}
slug: ${record.slug}
type: ${record.type}
id: ${record.id}
modified: ${record.modifiedGmt}Z
timeSensitive: ${record.timeSensitive}
---

`;
  await fs.writeFile(path.join(dir, fileName), frontMatter + markdown);
}

export async function generateAggregates(manifest: ManifestRecord[], pdfs: WpMedia[]) {
  await fs.writeFile(path.join(KNOWLEDGE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const pdfRecords = pdfs.map(p => ({
    title: p.title.rendered,
    url: p.source_url,
    modified: p.modified_gmt,
    size: p.media_details?.filesize || null
  }));
  await fs.writeFile(path.join(KNOWLEDGE_DIR, 'pdfs.json'), JSON.stringify(pdfRecords, null, 2));

  const included = manifest.filter(m => m.status === 'included');
  let allContent = '';
  let indexContent = '# Commecs Knowledge Base Index\n\n| Title | Type | Modified | Excerpt/Slug |\n|---|---|---|---|\n';

  for (const doc of included) {
    if (doc.file) {
      const fullPath = path.join(KNOWLEDGE_DIR, doc.file);
      const content = await fs.readFile(fullPath, 'utf-8');
      const body = content.split('---').slice(2).join('---').trim();
      
      allContent += `<document>\n<source>${doc.url}</source>\n<title>${doc.title}</title>\n<modified>${doc.modifiedGmt}</modified>\n${body}\n</document>\n\n`;
      indexContent += `| [${doc.title}](${doc.file}) | ${doc.type} | ${doc.modifiedGmt.split('T')[0]} | ${doc.slug} |\n`;
    }
  }

  await fs.writeFile(path.join(KNOWLEDGE_DIR, 'all.md'), allContent);
  await fs.writeFile(path.join(KNOWLEDGE_DIR, 'index.md'), indexContent);
  return allContent.length;
}

export async function writeReport(manifest: ManifestRecord[], allMdLength: number, failures: any[], rawStats: any, boilerplateDocs: string[]) {
  const counts = manifest.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const externalHosts = manifest.flatMap(m => m.externalLinks || []).reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let report = `# Ingestion Report\nGenerated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n- **Tokens in all.md (approx):** ${Math.round(allMdLength / 4).toLocaleString()}\n`;
  for (const [status, count] of Object.entries(counts)) report += `- **${status}:** ${count}\n`;

  const lowValue = manifest.filter(m => m.status === 'low_value');
  if (lowValue.length) {
    report += `\n## Low Value Documents\n`;
    lowValue.forEach(m => report += `- ${m.slug} (${m.wordCount} words)\n`);
  }

  const listings = rawStats.hadListingWidget;
  if (listings.length) {
    report += `\n## Documents Containing Dynamic Listings\n`;
    listings.forEach((s: string) => report += `- ${s}\n`);
  }

  const overCleaned = manifest.filter(m => {
    const rawLen = rawStats.lengths[m.slug] || 0;
    const cleanLen = m.wordCount * 5; 
    return rawLen > 500 && (rawLen - cleanLen) / rawLen > 0.6;
  });
  if (overCleaned.length) {
    report += `\n## Over-Cleaned Documents (>60% removed)\n`;
    overCleaned.forEach(m => report += `- ${m.slug}\n`);
  }

  if (boilerplateDocs.length) {
    report += `\n## Stripped Boilerplate Applied To\n`;
    boilerplateDocs.forEach(s => report += `- ${s}\n`);
  }

  if (failures.length > 0) {
    report += `\n## Failures\n`;
    failures.forEach(f => report += `- [${f.id}] ${f.url}: ${f.error}\n`);
  }

  report += `\n## External Systems Linked\n`;
  for (const [host, count] of Object.entries(externalHosts)) report += `- ${host}: ${count} references\n`;

  report += `\n## Full Manifest\n| Title | Type | Status | Reason | Words | Time Sensitive |\n|---|---|---|---|---|---|\n`;
  manifest.forEach(m => {
    report += `| ${m.title} | ${m.type} | ${m.status} | ${m.reason} | ${m.wordCount} | ${m.timeSensitive ? '✅' : ''} |\n`;
  });

  await fs.writeFile(path.join(KNOWLEDGE_DIR, 'report.md'), report);
}