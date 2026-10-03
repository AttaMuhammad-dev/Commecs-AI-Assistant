import { handle } from 'hono/vercel';
import { app } from '../server/app.js';
// Named Web handlers make Vercel consume the returned Response and SSE body.
// A default export is interpreted as a legacy (req, res) handler instead.
export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);
export const maxDuration = 60;
