import * as cheerio from 'cheerio';
import knowledge from './data/local-knowledge.json' with { type: 'json' };
import { selectEvidenceText, type Evidence } from './knowledge.js';
import { searchTokens, type planQuery } from './queryPlan.js';
const origin = 'https://commecscollege.edu.pk';
const pages = knowledge.documents.filter(d => d.kind === 'page');
const publicPaths = new Set(pages.map(d => new URL(d.url).pathname));
const cache = new Map<string, { at: number; text: string; source: Evidence['source']; retrievedAt: string }>();
const maxBytes = 600_000;
export type WebsiteProvider = (plan: ReturnType<typeof planQuery>, sources: { url: string }[], signal: AbortSignal) => Promise<Evidence[]>;
export function isPublicCollegePage(url: string): boolean {
  try { const parsed = new URL(url); return parsed.origin === origin && !parsed.username && !parsed.password && publicPaths.has(parsed.pathname); } catch { return false; }
}
export function websiteText(html: string) {
  const $ = cheerio.load(html);
  $('script,style,iframe,form,nav,header,footer,.elementor-location-footer').remove();
  $('a').each((_, el) => { const url = $(el).attr('href'); if (url && isPublicCollegePage(url)) $(el).append(` (${url})`); });
  $('p,div,li,h1,h2,h3,h4,tr,br').each((_, el) => { $(el).append('\n\n'); });
  return $.root().text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
}
async function json(url: URL, signal: AbortSignal, fetcher: typeof fetch) {
  const response = await fetcher(url, { signal, redirect: 'error', headers: { Accept: 'application/json' } });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Website response unavailable');
  const reader = response.body?.getReader(); if (!reader) throw new Error('No website content');
  let bytes = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const item = await reader.read(); if (item.done) break; bytes += item.value.byteLength; if (bytes > maxBytes) throw new Error('Website response too large'); chunks.push(item.value); } }
  finally { await reader.cancel().catch(() => undefined); }
  const data = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(data));
}
export async function retrieveOfficialWebsite(plan: ReturnType<typeof planQuery>, sources: { url: string }[], signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Evidence[]> {
  // Only approved public pages. Never send a question, conversation or person's name to website search.
  if (/\b(cnic|password|salary|attendance|my result|his result|her result|did .+ get admission)\b/i.test(plan.contextual)) return [];
  const ac = new AbortController(), abort = () => ac.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) ac.abort();
  const timeout = setTimeout(abort, 5000);
  try {
    const targets = new Set(sources.filter(s => isPublicCollegePage(s.url)).slice(0, 2).map(s => s.url));
    if (!targets.size) {
      // Generic topic terms only; no user-supplied URLs or identifying details.
      const terms = [...new Set(plan.topics.map(t => t.search))].slice(0, 2);
      const results = await Promise.allSettled(terms.map(async term => {
        const url = new URL('/wp-json/wp/v2/search', origin); url.search = new URLSearchParams({ search: term, subtype: 'page', per_page: '5', _fields: 'url,title' }).toString();
        const data: unknown = await json(url, ac.signal, fetcher);
        return Array.isArray(data) ? data.filter(p => p && typeof p.url === 'string' && isPublicCollegePage(p.url)).map(p => p.url as string) : [];
      }));
      for (const result of results) if (result.status === 'fulfilled') for (const url of result.value) { if (targets.size < 2) targets.add(url); }
    }
    const results = await Promise.allSettled([...targets].map(async target => {
      const cached = cache.get(target);
      if (cached && Date.now() - cached.at < 300_000) {
        const excerpt = selectEvidenceText(cached.text, plan.expanded, 6500);
        return excerpt.text ? { source: cached.source, sources: [cached.source], ...excerpt, kind: 'page', reviewedAt: undefined, retrievedAt: cached.retrievedAt } as Evidence : null;
      }
      const slug = new URL(target).pathname.split('/').filter(Boolean).at(-1) || '';
      const url = new URL('/wp-json/wp/v2/pages', origin); url.search = new URLSearchParams({ slug, _fields: 'link,title,content,modified_gmt', per_page: '1' }).toString();
      const data: unknown = await json(url, ac.signal, fetcher);
      const page = Array.isArray(data) ? data[0] : null;
      if (!page || typeof page.link !== 'string' || !isPublicCollegePage(page.link) || new URL(page.link).pathname !== new URL(target).pathname || typeof page.content?.rendered !== 'string') return null;
      const full = websiteText(page.content.rendered);
      if (!plan.expanded.some(t => searchTokens(full).includes(t))) return null;
      const excerpt = selectEvidenceText(full, plan.expanded, 6500); if (!excerpt.text) return null;
      const evidence: Evidence = { source: { title: websiteText(page.title?.rendered || 'College page'), url: page.link, type: 'live', ...(typeof page.modified_gmt === 'string' ? { modified: page.modified_gmt } : {}) }, sources: [], ...excerpt, kind: 'page', reviewedAt: undefined, retrievedAt: new Date().toISOString() };
      evidence.sources = [evidence.source];
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(target, { at: Date.now(), text: full, source: evidence.source, retrievedAt: evidence.retrievedAt! }); return evidence;
    }));
    return results.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []);
  } catch { return []; }
  finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
export function resetWebsiteCacheForTests() { cache.clear(); }
