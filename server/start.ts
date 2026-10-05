import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import { app } from './app.js';

if (!existsSync('dist/index.html')) throw new Error('Run npm run build before npm start.');
app.get('/api/*', c => c.json({ message: 'Not found' }, 404));
app.get('*', serveStatic({ root: './dist' }));
app.get('*', serveStatic({ path: './dist/index.html' }));
const port = Number(process.env.PORT || 3000);
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
console.log(`Commecs Assistant: http://localhost:${port}`);
console.log('Build: quality-20261005 | Local evidence + saved-source fallback enabled');

