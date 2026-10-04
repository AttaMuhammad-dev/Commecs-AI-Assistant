import { useEffect, useRef } from 'react';
import { Plus, MessageSquare, ExternalLink, Trash2, X, GraduationCap, ShieldCheck, BookOpen } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { stopResponse } from '../hooks/useChat';
export default function Sidebar({ onGuide }: { onGuide: () => void }) {
  const state = useChatStore();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!state.sidebarOpen) return;
    const prior = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') state.setSidebarOpen(false);
      if (event.key === 'Tab') {
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button, a, input') || []).filter(el => el.offsetParent !== null);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); prior?.focus(); };
  }, [state.sidebarOpen, state.setSidebarOpen]);
  return <>
    {state.sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => state.setSidebarOpen(false)} />}
    <aside ref={panel} id="navigation" className={'sidebar ' + (state.sidebarOpen ? 'is-open' : '')} aria-label="Conversation navigation" role={state.sidebarOpen ? 'dialog' : undefined} aria-modal={state.sidebarOpen || undefined}>
      <div className="brand"><div className="brand-mark"><GraduationCap size={24} /></div><div><strong>COMMECS</strong><span>College assistant</span></div><button className="icon-button mobile-only close-nav" aria-label="Close navigation" onClick={() => state.setSidebarOpen(false)}><X size={20} /></button></div>
      <button className="new-chat" onClick={() => { stopResponse(); state.newChat(); }}><Plus size={18} /> New conversation <kbd>+</kbd></button>
      <button className="guide-nav" onClick={() => { state.setSidebarOpen(false); onGuide(); }}><BookOpen size={17} /> Browse college guide</button>
      <div className="nav-label">Your conversations</div>
      <div className="conversation-list">
        {!state.conversations.length && <p className="sidebar-empty">A little guidance goes a long way.<br />Your conversations will appear here.</p>}
        {state.conversations.map(c => <div key={c.id} className={'conversation ' + (c.id === state.activeId ? 'selected' : '')}>
          <button onClick={() => { stopResponse(); state.openChat(c.id); }} title={c.title}><MessageSquare size={15} /><span>{c.title}</span></button>
          <button className="delete-chat" aria-label={'Delete conversation: ' + c.title} onClick={() => { if (c.id === state.activeId) stopResponse(); state.deleteChat(c.id); }}><Trash2 size={14} /></button>
        </div>)}
      </div>
      <div className="sidebar-bottom">
        <div className="privacy-control"><ShieldCheck size={18} /><label><input type="checkbox" checked={state.remember} onChange={e => state.setRemember(e.target.checked)} /> Save chats on this device</label></div>
        <p className="privacy-note" role={state.storageError ? 'status' : undefined}>{state.storageError ? state.remember ? 'Chats could not be saved on this device. Keep this page open to retain your current conversation.' : 'Saved copies could not be removed. Please try again when browser storage is available.' : state.remember ? 'Saved in this browser. Turn off to erase saved copies.' : 'Chats stay in memory and clear when you reload.'}</p>
        <a className="college-link" href="https://commecscollege.edu.pk/" target="_blank" rel="noreferrer">Visit college website <ExternalLink size={15} /></a>
        <div className="sidebar-signature"><span className="small-seal">C</span><span>Curiosity starts here.<br /><small>Commecs College, Karachi</small></span></div>
      </div>
    </aside>
  </>;
}
