import { handle } from 'hono/vercel';
import { app } from '../server/app.js';
export default handle(app);
export const maxDuration = 60;
