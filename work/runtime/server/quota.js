// Process-local circuit breakers. Provider quotas remain authoritative across instances.
const exhausted = new Set();
const cooldowns = new Map();
let resetDay = '';
function checkReset() {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
    if (day !== resetDay) {
        exhausted.clear();
        resetDay = day;
    }
}
export function isExhausted(model) { checkReset(); return exhausted.has(model) || (cooldowns.get(model) || 0) > Date.now(); }
export function markExhausted(model, _reason) { checkReset(); exhausted.add(model); }
export function coolDown(model, milliseconds = 60000) { cooldowns.set(model, Date.now() + milliseconds); }
export function resetQuotaForTests() { exhausted.clear(); cooldowns.clear(); resetDay = ''; }
