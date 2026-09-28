import { useEffect, useRef, useState } from 'react';
import { BookOpen, Search, X, ExternalLink, ArrowUpRight } from 'lucide-react';
import resources from '../data/collegeResources.json';
import { safeSourceUrl } from '../../shared/chat';
import { useChatStore } from '../store/useChatStore';

export default function CollegeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const setDraft = useChatStore(s => s.setDraft);
  useEffect(() => {
    if (!open) return;
    const prior = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); prior?.focus(); };
  }, [open]);
  const filtered = resources.filter(r => safeSourceUrl(r.url) && (category === 'All' || r.category === category) && (r.title + ' ' + r.category + ' ' + r.keywords).toLowerCase().includes(query.toLowerCase().trim()));
  return <dialog ref={dialog} className="guide-dialog" onCancel={onClose} aria-labelledby="guide-title" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="guide-shell">
      <div className="guide-heading"><div><span className="guide-eyebrow"><BookOpen size={16} /> College guide</span><h2 id="guide-title">Find your next step.</h2></div><button className="icon-button" onClick={onClose} aria-label="Close college guide"><X size={21} /></button></div>
      <p className="guide-intro">Official pages, in one place. Browse without using an AI request. Open a page to check its latest information.</p>
      <label className="guide-search"><Search size={18} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search fees, admissions, student life…" aria-label="Search college guide" /></label>
      <div className="guide-tabs" aria-label="Filter college guide">{['All', 'Admissions', 'Fees & support', 'Student life'].map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
      <div className="guide-results"><p className="guide-count" role="status">{filtered.length} official pages</p>{filtered.map(r => <article className="guide-card" key={r.url}><div><span className="guide-category">{r.category}</span><h3>{r.title}</h3><p>{r.description}</p></div><div className="guide-card-actions"><a href={r.url} target="_blank" rel="noreferrer">Open page <ExternalLink size={14} /></a><button onClick={() => { setDraft(r.question); onClose(); setTimeout(() => document.getElementById('question')?.focus(), 0); }}>Ask assistant <ArrowUpRight size={14} /></button></div></article>)}{!filtered.length && <p className="guide-empty">No matching pages. Try “fees”, “admissions” or “scholarships”.</p>}</div>
      <p className="guide-footer">Links remain browsable here offline. Opening the college website needs internet.</p>
    </div>
  </dialog>;
}
