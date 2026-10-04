import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SourceCards from '../../src/components/SourceCards';
import { getFollowUps } from '../../src/lib/followUps';
import { readPreferences } from '../../src/lib/preferences';
import { streamGeminiResponse } from '../../src/lib/geminiChatService';
import { matchesGuideSearch } from '../../src/lib/guideSearch';
import resources from '../../src/data/collegeResources.json';
afterEach(() => vi.unstubAllGlobals());
describe('sources and personalized follow-ups', () => {
  it('shows safe, deduplicated source cards with separate dates', () => {
    const source = { title: 'Fee policy', url: 'https://commecscollege.edu.pk/fee-payment-policy/', modified: '2024-09-20T01:00:00Z', reviewedAt: '2026-09-20T01:00:00Z' };
    const html = renderToStaticMarkup(<SourceCards sources={[source, source, { title: 'Unsafe', url: 'javascript:alert(1)' }]} language="en" />);
    expect(html).toContain('Saved source date: 20 Sept 2024'); expect(html).toContain('Review date: 20 Sept 2026');
    expect(html.match(/href=/g)).toHaveLength(1); expect(html).not.toContain('<details'); expect(html).not.toContain('Unsafe');
  });
  it('labels old-format reviewed sources as review dates, never page updates', () => {
    const html = renderToStaticMarkup(<SourceCards sources={[{ title: 'Policy', url: 'https://commecscollege.edu.pk/about/', modified: '2026-09-20', type: 'reviewed' }]} language="roman" />);
    expect(html).toContain('Review ki date'); expect(html).not.toContain('Mehfooz source ki date');
  });
  it('shows missing dates honestly and localizes source labels', () => {
    const html = renderToStaticMarkup(<SourceCards sources={[{ title: 'Policy', url: 'https://commecscollege.edu.pk/about/', modified: 'invalid' }]} language="ur" />);
    expect(html).toContain('dir="rtl"'); expect(html).toContain('تاریخ درج نہیں');
  });
  it('uses topic-specific follow-ups and does not repeat the same question', () => {
    expect(getFollowUps('Explain late fee penalties').map(s => s.label)).toEqual(['Scholarships', 'Payment rules']);
    expect(getFollowUps('Who are the Physics teachers?').map(s => s.label)).toEqual(['Computer Science faculty']);
    expect(getFollowUps('What scholarships are available?').map(s => s.label)).toEqual(['Fee structure', 'Application steps']);
    expect(getFollowUps('Programs offered', [{ title: 'Eligibility', url: 'https://commecscollege.edu.pk/eligibility/' }]).map(s => s.label)).toEqual(['Compare programs', 'Eligibility']);
  });
  it('localizes the drafted questions as well as their labels', () => {
    expect(getFollowUps('Fee policy', [], 'ur')[0].question).toContain('اسکالرشپس');
    expect(getFollowUps('fees kitni hai')[0].question).toContain('kya hain');
  });
  it('restores only valid preferences without requiring chat persistence', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ language: 'roman', responseStyle: 'detailed', messages: ['private'] }) });
    expect(readPreferences()).toEqual({ language: 'roman', responseStyle: 'detailed' });
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ language: 'invalid', responseStyle: 'invalid' }) });
    expect(readPreferences()).toEqual({ language: 'auto', responseStyle: 'concise' });
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Unavailable'); } });
    expect(readPreferences()).toEqual({ language: 'auto', responseStyle: 'concise' });
  });
  it('rejects malformed source metadata at the client protocol boundary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('event: sources\ndata: {"sources":[{"title":"Policy","url":"https://commecscollege.edu.pk/about/","modified":{"secret":"bad"},"reviewedAt":"2026-09-20"}]}\n\nevent: done\ndata: {"finishReason":"STOP"}\n\n')));
    const chunks = []; for await (const chunk of streamGeminiResponse('Question', [])) chunks.push(chunk);
    expect(chunks[0]).toEqual({ sources: [{ title: 'Policy', url: 'https://commecscollege.edu.pk/about/', reviewedAt: '2026-09-20' }] });
  });
  it.each(['fees', 'فیس', 'fees kitni hai', 'admission documents', 'اہلیت'])('supports useful multilingual guide searches: %s', query => {
    expect(resources.filter(resource => matchesGuideSearch(resource, query)).length).toBeGreaterThan(0);
  });
  it('does not hide unrelated resources behind empty searches', () => {
    expect(resources.filter(resource => matchesGuideSearch(resource, '')).length).toBe(resources.length);
    expect(resources.filter(resource => matchesGuideSearch(resource, 'quantum wormholes'))).toEqual([]);
  });
});
