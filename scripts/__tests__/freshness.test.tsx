import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { auditPublicPage, snapshotFingerprint } from '../lib/freshness';
import { isKnownChanged, withSourceCheck, type Audit } from '../../server/sourceFreshness';
import SourceCards from '../../src/components/SourceCards';
const url = 'https://commecscollege.edu.pk/eligibility/';
const page = { url, slug: 'eligibility', modified: '2026-09-01T00:00:00', text: 'Science: **65%**.' };
const remote = (change: Record<string, unknown> = {}) => new Response(JSON.stringify([{ link: url, modified_gmt: page.modified, content: { rendered: '<p>Science: <strong>65%</strong>.</p>' }, ...change }]), { headers: { 'Content-Type': 'application/json' } });
describe('public source audit', () => {
  it('compares readable content and keeps source changes distinct from review dates', async () => {
    const row = await auditPublicPage(page, ['answer-1'], async () => remote());
    expect(row.status).toBe('unchanged'); expect(row.affectedAnswers).toEqual(['answer-1']);
    expect(row.snapshotHash).toBe(snapshotFingerprint(page.text));
    expect(snapshotFingerprint('**65%** [Policy](https://example.org)')).toBe(snapshotFingerprint('65% Policy'));
  });
  it.each([
    { content: { rendered: '<p>Science: 70%.</p>' } },
    { modified_gmt: '2026-10-01T00:00:00' },
  ])('requires review if content or modification date changes', async change => {
    expect((await auditPublicPage(page, [], async () => remote(change))).status).toBe('changed');
  });
  it.each([
    () => new Response('unavailable', { status: 503 }),
    () => remote({ link: 'https://evil.example/' }),
    () => remote({ content: { rendered: 123 } }),
    () => new Response('x'.repeat(600001), { headers: { 'Content-Type': 'application/json' } }),
  ])('treats failures as unknown instead of fresh', async response => {
    expect((await auditPublicPage(page, [], async () => response())).status).toBe('unavailable');
  });
  it('does not fetch an external target or a slug/path mismatch', async () => {
    let calls = 0; const fetcher = async () => { calls++; return remote(); };
    expect((await auditPublicPage({ ...page, url: 'https://evil.example/eligibility/' }, [], fetcher)).status).toBe('unavailable');
    expect((await auditPublicPage({ ...page, slug: 'admission-result' }, [], fetcher)).status).toBe('unavailable');
    expect(calls).toBe(0);
  });
  it('does not quarantine a newly refreshed snapshot using an older audit hash', () => {
    const audit: Audit = { checkedAt: '2026-10-05T00:00:00Z', sources: [{ url, status: 'changed', snapshotMatches: true }] };
    expect(isKnownChanged(url, audit)).toBe(true);
    expect(isKnownChanged(url, { ...audit, sources: [{ url, status: 'changed', snapshotMatches: false }] })).toBe(false);
    expect(withSourceCheck({ title: 'Eligibility', url }, audit).checkedAt).toBeUndefined();
    audit.sources![0].status = 'unchanged';
    const source = withSourceCheck({ title: 'Eligibility', url, reviewedAt: '2026-09-20', modified: page.modified }, audit);
    expect(source.checkedAt).toBe(audit.checkedAt); expect(source.reviewedAt).toBe('2026-09-20');
    expect(withSourceCheck({ title: 'Live', url, type: 'live' }, audit).checkedAt).toBeUndefined();
    const html = renderToStaticMarkup(<SourceCards sources={[source]} language="en" />);
    expect(html).toContain('Saved source compared'); expect(html).toContain('Review date: 20 Sept 2026');
  });
});
