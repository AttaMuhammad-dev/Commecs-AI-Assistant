// Bounded per-process limiter. Use a shared gateway limiter for multi-instance production.
const requests = new Map();
let lastSweep = 0;
export function checkRateLimit(ip) {
    const now = Date.now();
    if (now - lastSweep > 60000) {
        for (const [key, entries] of requests)
            if (!entries.some(t => t > now - 3600000))
                requests.delete(key);
        lastSweep = now;
    }
    const entries = (requests.get(ip) || []).filter(t => t > now - 3600000);
    if (entries.filter(t => t > now - 60000).length >= 6 || entries.length >= 30)
        return false;
    if (!requests.has(ip) && requests.size >= 10000)
        return false;
    entries.push(now);
    requests.set(ip, entries);
    return true;
}
