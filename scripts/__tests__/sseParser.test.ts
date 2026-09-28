import { describe, it, expect } from 'vitest';
import { parseSSE } from '../../src/lib/sseParser';

describe('parseSSE', () => {
  it('parses valid chunk streams with CRLF', async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("data: {\"text\":\"hello\"}\r\n\r\n"));
        c.close();
      }
    });
    const events = [];
    for await (const e of parseSSE(stream)) events.push(e);
    expect(events[0].data.text).toBe("hello");
  });
});