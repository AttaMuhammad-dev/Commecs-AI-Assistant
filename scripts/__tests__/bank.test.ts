import { describe, it, expect } from 'vitest';
import { scoreMatch } from '../../server/bank.js';

const hit = (msg: string, variant: string) => expect(scoreMatch(msg, variant)).toBeGreaterThan(0);
const miss = (msg: string, variant: string) => expect(scoreMatch(msg, variant)).toBe(0);

describe('bank fuzzy matching', () => {
  it('catches natural rewordings', () => {
    hit('what programs do you guys offer?', 'Programs offered');
    hit('Which courses do you provide', 'Programs offered');
    hit('how can I apply', 'How to apply');
    hit('tell me about the fees and scholarships', 'Fees & scholarships');
  });
  it('never crosses topics', () => {
    miss('programs offered fee', 'Programs offered');
    miss('fees for pre-medical', 'Fees for intermediate computer science');
    miss('I got 72% can I apply', 'How to apply');
    miss('when is the last date to apply', 'How to apply');
    miss('which programs are not offered', 'Programs offered');
    miss('fee', 'Fees & scholarships');
  });
});