import { describe, expect, it, vi } from 'vitest';
vi.mock('../../server/sourceFreshness', () => ({ isKnownChanged: (url: string) => /eligibility|fee-payment-policy/.test(url) }));
import { getVerifiedAnswer } from '../../server/bank';
import { getLocalGuideAnswer } from '../../server/localGuide';
import { retrieveEvidence } from '../../server/knowledge';
import guides from '../../server/data/local-guide.json';
import bank from '../../server/data/verified-answers.json';
describe('known-changed evidence quarantine', () => {
  it('skips changed bank and guide answers without discarding unrelated ones', () => {
    const entry = bank.find(e => e.sources.some(s => s.url.includes('fee-payment-policy')))!;
    expect(entry).toBeTruthy(); expect(getVerifiedAnswer(entry.match[0], 0)).toBeNull();
    expect(getLocalGuideAnswer(guides.find(g => g.title === 'Eligibility')!.question, { language: 'en', responseStyle: 'concise' })).toBeNull();
    expect(getLocalGuideAnswer('What programs do you offer?', { language: 'en', responseStyle: 'concise' })).not.toBeNull();
  });
  it('excludes original and reviewed passages linked to changed pages', () => {
    const evidence = retrieveEvidence('Explain the late fee penalty');
    expect(evidence.some(e => e.sources.some(s => /fee-payment-policy/.test(s.url)))).toBe(false);
    expect(retrieveEvidence('What clubs and societies are available?').some(e => e.kind === 'document')).toBe(true);
  });
});
