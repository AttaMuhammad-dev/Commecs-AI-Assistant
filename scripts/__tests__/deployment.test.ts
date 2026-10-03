import { describe, expect, it } from 'vitest';
import * as handler from '../../api/index';

describe('Vercel Web handler contract', () => {
  it('exports named HTTP handlers and returns health immediately', async () => {
    expect(handler).not.toHaveProperty('default');
    expect(typeof handler.POST).toBe('function');
    expect(typeof handler.OPTIONS).toBe('function');
    const response = await handler.GET(new Request('https://commecs-ai-assistant.vercel.app/api/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, build: 'stable-20261003' });
  });
  it('returns the SSE response body through the POST handler', async () => {
    const response = await handler.POST(new Request('https://commecs-ai-assistant.vercel.app/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Student portal' }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    const body = await response.text();
    expect(body).toContain('event: sources');
    expect(body).toContain('"finishReason":"STOP"');
  });
});
