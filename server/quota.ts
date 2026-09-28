// Process-local circuit breakers. Provider quotas remain authoritative across instances.
const exhausted = new Set<string>();
const cooldowns = new Map<string, number>();
let resetDay = '';
function checkReset() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  if (day !== resetDay) { exhausted.clear(); resetDay = day; }
}
export function isExhausted(model: string) { checkReset(); return exhausted.has(model) || (cooldowns.get(model) || 0) > Date.now(); }
export function markExhausted(model: string, _reason: string) { checkReset(); exhausted.add(model); }
export function coolDown(model: string, milliseconds = 60000) { cooldowns.set(model, Date.now() + milliseconds); }
export function resetQuotaForTests() { exhausted.clear(); cooldowns.clear(); resetDay = ''; }
