import { describe, it, expect } from 'vitest';
import { generateKey } from '../../server/cache.js';
import { clampThinking } from '../../server/config/models.js';

describe('Part A Tests', () => {
  it('Cache keys differ by history', () => {
    const key1 = generateKey("Fees?", [], 'fast');
    const key2 = generateKey("Fees?", [{ role: 'model', text: 'Hi' }], 'fast');
    expect(key1).not.toEqual(key2);
  });
  
  it('Cache keys match exactly', () => {
    const key1 = generateKey("Fees?", [{ role: 'model', text: 'Hi' }], 'fast');
    const key2 = generateKey("Fees?", [{ role: 'model', text: 'Hi' }], 'fast');
    expect(key1).toEqual(key2);
  });

  it('clampThinking forces MINIMAL to LOW on gemini-3.8-flash', () => {
    expect(clampThinking('gemini-3.8-flash', 'MINIMAL')).toBe('LOW');
  });

  it('clampThinking allows MINIMAL on gemini-3.1-flash-lite', () => {
    expect(clampThinking('gemini-3.1-flash-lite', 'MINIMAL')).toBe('MINIMAL');
  });
});