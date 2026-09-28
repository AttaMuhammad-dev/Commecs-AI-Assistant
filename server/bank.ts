import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const BANK_PATH = resolve(process.cwd(), 'server/data/verified-answers.json');

export function normalizeForBank(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s\u0600-\u06FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'a','an','the','is','are','am','was','were','be','do','does','did','you','your','yours','guys','guy',
  'please','pls','plz','kindly','tell','me','us','about','can','could','would','will','i','we','my','our',
  'to','of','for','in','on','at','there','any','some','info','information','details','detail','regarding',
  'know','want','need','give','show','hi','hello','salam','bhai','bro','sir','madam','what','whats',
  'commecs','college','intermediate','it','its','this','that','have','has','get','also','and','or','with',
  'so','if','just','ok','okay',
]);

const SYN = new Map<string, string>(Object.entries({
  programme: 'program', programmes: 'program', course: 'program', courses: 'program',
  stream: 'program', streams: 'program', group: 'program', groups: 'program',
  offered: 'offer', offering: 'offer', offers: 'offer', provide: 'offer', provided: 'offer', available: 'offer',
  fees: 'fee', charges: 'fee', charge: 'fee', cost: 'fee', costs: 'fee', tuition: 'fee', price: 'fee',
  application: 'apply', applications: 'apply', applying: 'apply', applied: 'apply', enroll: 'apply', enrol: 'apply', join: 'apply',
  located: 'location', locate: 'location', address: 'location', situated: 'location', directions: 'location',
  mobile: 'phone', telephone: 'phone', call: 'phone', mail: 'email',
}));

// Topic words that must agree between the message and the bank entry, in both directions.
const GUARD = new Set([
  'fee','scholarship','discount','sibling','deadline','date','schedule','test','result','merit','interview',
  'medical','premedical','engineering','preengineering','commerce','computer','science','arts',
  'hostel','transport','uniform','booklist','book','timetable','phone','email','location','principal',
  'harassment','eligibility','percentage','marks','late','refund','grade','board',
  'not','never','without','cant','dont','doesnt','isnt','wont',
]);

function canon(text: string): string {
  return normalizeForBank(text)
    .replace(/\bpre ?medical\b/g, 'premedical')
    .replace(/\bpre ?engineering\b/g, 'preengineering')
    .replace(/\bcomputer science\b/g, 'computer')
    .replace(/\bcs\b/g, 'computer')
    .replace(/\btime ?table\b/g, 'timetable');
}

function stem(t: string): string {
  const direct = SYN.get(t);
  if (direct) return direct;
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) {
    const base = t.slice(0, -1);
    return SYN.get(base) ?? base;
  }
  return t;
}

function tokens(text: string): string[] {
  return canon(text)
    .split(' ')
    .filter(t => t && !STOP.has(t))
    .map(stem)
    .filter(t => !STOP.has(t));
}

function fuzzyScore(m: string[], e: string[]): number {
  if (m.length === 0 || e.length === 0) return 0;
  const M = new Set(m);
  const E = new Set(e);
  const strict = (t: string) => GUARD.has(t) || /\d/.test(t);
  for (const t of M) if (strict(t) && !E.has(t)) return 0;
  for (const t of E) if (strict(t) && !M.has(t)) return 0;
  let inter = 0;
  for (const t of E) if (M.has(t)) inter++;
  const covE = inter / E.size;
  const covM = inter / M.size;
  const extra = M.size - inter;
  return covE >= 0.8 && (covM >= 0.6 || extra <= 1) ? (covE + covM) / 2 : 0;
}

export function scoreMatch(message: string, variant: string): number {
  return fuzzyScore(tokens(message), tokens(variant));
}

type Prepared = { entry: any; exact: Set<string>; variants: string[][] };
let loaded: { mtimeMs: number; items: Prepared[] } | null = null;

function loadBank(): Prepared[] {
  try {
    const { mtimeMs } = statSync(BANK_PATH);
    if (loaded && loaded.mtimeMs === mtimeMs) return loaded.items;
    const bank = JSON.parse(readFileSync(BANK_PATH, 'utf-8'));
    if (!Array.isArray(bank)) throw new Error('top-level value must be an array');
    const items: Prepared[] = bank
      .filter((e: any) => e && e.verified === true && Array.isArray(e.match))
      .map((entry: any) => ({
        entry,
        exact: new Set<string>(entry.match.map((m: string) => normalizeForBank(m))),
        variants: entry.match.map((m: string) => tokens(m)),
      }));
    loaded = { mtimeMs, items };
    console.log(`[Bank] loaded ${items.length} verified entries`);
    return items;
  } catch (e: any) {
    if (e?.code !== 'ENOENT') console.error(`[Bank] FAILED TO LOAD verified-answers.json: ${e.message}`);
    return loaded?.items ?? [];
  }
}

export function getVerifiedAnswer(message: string, kbVersion: number) {
  const items = loadBank();
  if (items.length === 0) return null;
  const norm = normalizeForBank(message);
  if (!norm) return null;

  const msgTokens = /[\u0600-\u06FF]/.test(norm) ? null : tokens(message);
  let best: { p: Prepared; score: number; via: 'exact' | 'fuzzy' } | null = null;

  for (const p of items) {
    if (p.exact.has(norm)) { best = { p, score: 2, via: 'exact' }; break; }
    if (!msgTokens || process.env.BANK_FUZZY_MATCH !== 'true') continue;
    for (const v of p.variants) {
      const s = fuzzyScore(msgTokens, v);
      if (s > 0 && (!best || s > best.score)) best = { p, score: s, via: 'fuzzy' };
    }
  }

  if (!best) return null;
  if (!Number.isFinite(best.p.entry.verifiedAt) || best.p.entry.verifiedAt > Date.now() + 86400000 || best.p.entry.verifiedAt < kbVersion || Date.now() - best.p.entry.verifiedAt > 30 * 86400000) {
    console.log(`[Bank] STALE id=${best.p.entry.id}`);
    return null;
  }
  console.log(`[Bank] ${best.via.toUpperCase()} id=${best.p.entry.id} score=${best.score.toFixed(2)}`);
  return best.p.entry;
}