import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROMPT_VERSION } from './systemPrompt.js';
import { DEFAULT_PREFERENCES } from '../shared/chat.js';
const cache = new Map();
const TTL = 1000 * 60 * 60;
let version = 0;
let checkedAt = 0;
export function getKbVersion() {
    if (!checkedAt || Date.now() - checkedAt > 60000) {
        try {
            const state = JSON.parse(readFileSync(resolve(process.cwd(), 'knowledge/.filesearch.json'), 'utf8'));
            const dates = Object.values(state.documents || {}).map((v) => { const d = v; return new Date(String(d.indexedAt || d.uploadedAt || d.updatedAt || '')).getTime(); }).filter(Number.isFinite);
            const top = new Date(state.lastRun || state.updatedAt || 0).getTime();
            version = Math.max(0, Number.isFinite(top) ? top : 0, ...dates);
        }
        catch {
            version = 0;
        }
        checkedAt = Date.now();
    }
    return version;
}
export function generateKey(message, history, lane = 'fast', preferences = DEFAULT_PREFERENCES) {
    return createHash('sha256').update(JSON.stringify({ message: message.trim().toLowerCase(), history: history.map(({ role, text }) => ({ role, text })), lane, preferences, kb: getKbVersion(), store: process.env.FILE_SEARCH_STORE_NAME || '', prompt: PROMPT_VERSION })).digest('hex');
}
export function getCachedResponse(message, history, lane = 'fast', preferences = DEFAULT_PREFERENCES) {
    const key = generateKey(message, history, lane, preferences);
    const value = cache.get(key);
    if (!value)
        return null;
    if (Date.now() - value.timestamp > TTL) {
        cache.delete(key);
        return null;
    }
    cache.delete(key);
    cache.set(key, value);
    return value;
}
export function setCachedResponse(message, history, text, sources, lane = 'fast', preferences = DEFAULT_PREFERENCES) {
    const key = generateKey(message, history, lane, preferences);
    cache.delete(key);
    if (cache.size >= 300)
        cache.delete(cache.keys().next().value);
    cache.set(key, { text, sources, timestamp: Date.now() });
}
export function clearCache() { cache.clear(); }
