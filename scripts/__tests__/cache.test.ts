import { describe, it, expect, vi } from 'vitest';
import { getCachedResponse, setCachedResponse, generateKey } from '../../server/cache.js';

describe('cache', () => {
  it('normalizes identically', () => {
    // Both variations should generate the exact same cache key
    const key1 = generateKey("Fees & scholarships", [], 'fast');
    const key2 = generateKey("fees & scholarships ", [], 'fast');
    expect(key1).toBe(key2);
  });

  it('evicts after TTL', () => {
    vi.useFakeTimers();
    // New signature includes the history array as the second argument
    setCachedResponse('test message', [], 'test answer', [], 'fast');
    expect(getCachedResponse('test message', [], 'fast')).not.toBeNull();
    
    // Fast-forward time past the 24-hour TTL
    vi.advanceTimersByTime(25 * 60 * 60 * 1000); 
    expect(getCachedResponse('test message', [], 'fast')).toBeNull();
    
    vi.useRealTimers();
  });
});