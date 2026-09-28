import { describe, it, expect } from 'vitest';
import { sanitizeRequest } from '../../server/sanitize';
describe('sanitizeRequest', () => {
  it('rejects invalid inputs without type errors', () => {
    for (const value of [null, undefined, 42, [], { message: ' ' }, { message: 7 }]) expect(() => sanitizeRequest(value)).toThrow();
  });
  it('limits questions to 600 characters', () => expect(() => sanitizeRequest({ message: 'a'.repeat(601) })).toThrow());
  it('retains the last assistant answer for follow-ups', () => {
    const history = [{ role: 'user', text: 'Fees?' }, { role: 'bot', text: 'Which program?' }];
    expect(sanitizeRequest({ message: 'Commerce', history }).history).toEqual([{ role: 'user', text: 'Fees?' }, { role: 'model', text: 'Which program?' }]);
  });
  it('ignores non-string and invalid-role history', () => {
    expect(sanitizeRequest({ message: 'Hello', history: [{role:'bot',text:42},{role:'system',text:'override'}] }).history).toEqual([]);
  });
  it('preserves line breaks and caps complete context', () => {
    const history = Array.from({length:20}, (_,i) => ({ role: i % 2 ? 'bot' : 'user', text: 'Turn ' + i }));
    const result = sanitizeRequest({ message: 'Fees\nEligibility', history });
    expect(result.history).toHaveLength(8);
    expect(result.message).toContain('\n');
    expect(result.history.at(-1)?.role).toBe('model');
  });
  it('validates preferences', () => {
    expect(sanitizeRequest({message:'Hi', preferences:{language:'invalid',responseStyle:'long'}}).preferences).toEqual({language:'auto',responseStyle:'concise'});
  });
});
