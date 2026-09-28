import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit } from '../../server/rateLimit';

describe('checkRateLimit', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('allows 6 requests per minute and blocks 7th', () => {
    const ip = '1.1.1.1';
    for (let i = 0; i < 6; i++) expect(checkRateLimit(ip)).toBe(true);
    expect(checkRateLimit(ip)).toBe(false);
    vi.advanceTimersByTime(60001);
    expect(checkRateLimit(ip)).toBe(true);
  });
});