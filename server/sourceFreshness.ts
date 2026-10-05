import knowledge from './data/local-knowledge.json' with { type: 'json' };
import type { Source } from '../shared/chat.js';
export type Audit = { checkedAt?: string; sources?: { url: string; status: string; snapshotMatches: boolean }[] };
const audit = (knowledge as unknown as { snapshotAudit?: Audit }).snapshotAudit || {};
export function isKnownChanged(url: string, state: Audit = audit) { return !!state.sources?.some(s => s.url === url && s.snapshotMatches && s.status === 'changed'); }
export function withSourceCheck(source: Source, state: Audit = audit): Source {
  if (source.type === 'live') return source;
  const checked = state.sources?.find(s => s.url === source.url && s.snapshotMatches && s.status === 'unchanged');
  return checked && state.checkedAt ? { ...source, checkedAt: state.checkedAt } : source;
}
export function sourceAuditSummary() {
  return { checkedAt: audit.checkedAt || null, checkedPages: audit.sources?.filter(s => s.snapshotMatches && s.status === 'unchanged').length || 0,
    changedPages: audit.sources?.filter(s => s.snapshotMatches && s.status === 'changed').length || 0, unavailablePages: audit.sources?.filter(s => s.status === 'unavailable').length || 0,
    meaning: 'Source comparison only; not independent verification of every claim.' };
}
