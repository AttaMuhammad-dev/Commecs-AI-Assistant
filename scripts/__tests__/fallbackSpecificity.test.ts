import { describe, expect, it } from 'vitest';
import { getSavedEvidence } from '../../server/savedEvidence';
import type { Evidence } from '../../server/knowledge';
describe('specific evidence gaps during a fallback', () => {
  it.each([
    ['en', 'cannot confirm'], ['ur', 'تصدیق نہیں ہو سکی'], ['roman', 'confirm nahi ho sakeen'],
  ] as const)('labels unknown named-club availability in %s without declaring it absent', (language, warning) => {
    const answer = getSavedEvidence('Is a robotics club available at Commecs?', [], { language, responseStyle: 'detailed' });
    expect(answer?.answer).toContain(warning);
    expect(answer?.answer).toContain('IT Club');
    expect(answer?.sources.some(s => /Brochure/.test(s.url))).toBe(true);
  });
  it('does not add an unknown-detail warning when supplied official evidence covers the named club', () => {
    const source = { title: 'Clubs', url: 'https://commecscollege.edu.pk/faqs/', type: 'live' };
    const supplied: Evidence[] = [{ source, sources: [source], kind: 'page', text: 'The Robotics Club meets weekly.', partial: false }];
    expect(getSavedEvidence('Is a robotics club available at Commecs?', [], { language: 'en', responseStyle: 'detailed' }, supplied)?.answer).not.toContain('cannot confirm');
  });
  it('keeps a generic clubs list useful without adding an unknown-specifics warning', () => {
    const answer = getSavedEvidence('Which clubs and societies can students join?', [], { language: 'en', responseStyle: 'detailed' });
    expect(answer?.answer).toContain('IT Club');
    expect(answer?.answer).not.toContain('cannot confirm');
  });
});
