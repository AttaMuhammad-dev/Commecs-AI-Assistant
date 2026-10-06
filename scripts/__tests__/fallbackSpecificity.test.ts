import { describe, expect, it } from 'vitest';
import { getSavedEvidence } from '../../server/savedEvidence';
import type { Evidence } from '../../server/knowledge';
import { selectAnswerSources } from '../../shared/answerSources';
describe('specific evidence gaps during a fallback', () => {
  it('keeps unavailable library-hour replies focused on library evidence', () => {
    const source = { title: 'Facilities', url: 'https://commecscollege.edu.pk/faqs/', type: 'live' };
    const supplied: Evidence[] = [{ source, sources: [source], kind: 'page', partial: false, text: '## Library\nA library with books supports students.\n\n## Cafeteria\n' + 'Lunch and coffee facilities. '.repeat(100) }];
    const response = getSavedEvidence('What are the exact current library opening hours?', [], { language: 'en', responseStyle: 'detailed' }, supplied)!;
    expect(response.answer).toContain('library with books'); expect(response.answer).not.toContain('Lunch and coffee');
    expect(response.answer.length).toBeLessThan(1800); expect(response.answer).toContain('cannot confirm');
  });
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
  it('keeps a late-payment follow-up focused during an outage as well as live generation', () => {
    const answer = getSavedEvidence('Tell me more', [{ role: 'user', text: 'What happens if college fees are paid late?' }], { language: 'en', responseStyle: 'detailed' });
    expect(answer?.answer).toContain('1,000');
    expect(answer?.answer).not.toContain('Sibling Discount');
    expect(selectAnswerSources(answer!.answer, answer!.sources).map(s => s.url)).toEqual(['https://commecscollege.edu.pk/fee-payment-policy/']);
  });
  it('retains discount evidence when the user explicitly asks about both policies', () => {
    const answer = getSavedEvidence('Compare late-fee rules and sibling discounts', [], { language: 'en', responseStyle: 'detailed' });
    expect(answer?.answer).toContain('Sibling Discount');
    expect(answer?.answer).toContain('1,000');
  });
});
