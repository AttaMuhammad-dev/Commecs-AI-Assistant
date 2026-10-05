import { createHash } from 'node:crypto';
import { cleanHtml } from './cleanHtml.js';
export const snapshotFingerprint = (text: string) => createHash('sha256').update(text.replace(/\r\n/g, '\n').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*_`|\\]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()).digest('hex');
export type AuditRow = { url: string; snapshotHash: string; status: 'unchanged' | 'changed' | 'unavailable'; snapshotModified?: string; remoteModified?: string; affectedAnswers: string[] };
export async function auditPublicPage(page: { url: string; slug: string; modified?: string; text: string }, answerIds: string[], fetcher: typeof fetch = fetch): Promise<AuditRow> {
  const row: AuditRow = { url: page.url, snapshotHash: snapshotFingerprint(page.text), status: 'unavailable', snapshotModified: page.modified, affectedAnswers: answerIds };
  try {
    const target = new URL(page.url);
    if (target.origin !== 'https://commecscollege.edu.pk' || target.username || target.password || !/^[a-z0-9-]+$/.test(page.slug) || target.pathname !== '/' + page.slug + '/') throw new Error('Invalid public target');
    const url = new URL('/wp-json/wp/v2/pages', target.origin); url.search = new URLSearchParams({ slug: page.slug, _fields: 'link,content,modified_gmt', per_page: '1' }).toString();
    const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json', 'User-Agent': 'CommecsAssistantSourceAudit/2.6' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || !response.body) throw new Error('Unavailable');
    const reader = response.body.getReader(); let text = '', size = 0; const decoder = new TextDecoder();
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 600000) throw new Error('Too large'); text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); }
    finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    const data: unknown = JSON.parse(text), remote = Array.isArray(data) ? data[0] : null;
    if (!remote || typeof remote.content?.rendered !== 'string' || remote.link !== page.url || typeof remote.modified_gmt !== 'string' || !Number.isFinite(Date.parse(remote.modified_gmt))) throw new Error('Invalid page');
    row.remoteModified = remote.modified_gmt;
    const changedDate = page.modified && Date.parse(page.modified) !== Date.parse(remote.modified_gmt);
    row.status = changedDate || snapshotFingerprint(cleanHtml(remote.content.rendered)) !== row.snapshotHash ? 'changed' : 'unchanged';
    return row;
  } catch { return row; }
}
