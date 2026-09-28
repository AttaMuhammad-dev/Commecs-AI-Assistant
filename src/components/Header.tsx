import { useEffect, useState } from 'react';
import { Moon, Sun, Menu, Download, BookOpen, RefreshCw } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
function exportChat() {
  const messages = useChatStore.getState().messages;
  const body = '# Commecs conversation\n\n' + messages.map(m => '## ' + (m.role === 'user' ? 'You' : 'Commecs Assistant') + '\n\n' + m.text + (m.sources?.length ? '\n\nSources:\n' + m.sources.map(s => '- ' + s.title + ': ' + s.url).join('\n') : '') + (m.finishReason && m.finishReason !== 'STOP' ? '\n\n[Reply incomplete]' : '')).join('\n\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'commecs-conversation.md'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Header({ onGuide }: { onGuide: () => void }) {
  const state = useChatStore();
  const [ready, setReady] = useState<boolean | null>(null);
  const [check, setCheck] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    const timeout = setTimeout(() => { ac.abort(); setReady(false); }, 8000);
    setReady(null);
    fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/health', { signal: ac.signal }).then(r => r.ok ? r.json() : null).then(data => setReady(data?.ready === true)).catch(() => { if (!ac.signal.aborted) setReady(false); }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); ac.abort(); };
  }, [check, state.isOffline]);
  const mock = import.meta.env.VITE_USE_MOCK === 'true';
  return <header className="chat-header">
    <div className="header-left"><button className="icon-button mobile-only" aria-label="Open navigation" aria-controls="navigation" aria-expanded={state.sidebarOpen} onClick={() => state.setSidebarOpen(true)}><Menu size={21} /></button><div><h1>Commecs Assistant</h1><p><span className={'status-dot ' + (!ready || mock ? 'muted-dot' : '')} />{mock ? 'Preview with sample answers' : state.isOffline ? 'Offline · previous chats available' : ready === false ? 'Live answers unavailable · guide available' : ready ? 'College information, within reach' : 'Checking connection…'}</p></div></div>
    <div className="header-actions">{ready === false && <button className="icon-button" onClick={() => setCheck(c => c + 1)} aria-label="Check connection again"><RefreshCw size={17} /></button>}<button className="icon-button" onClick={onGuide} aria-label="Open college guide" title="College guide"><BookOpen size={19} /></button><button className="icon-button" disabled={!state.messages.length || state.messages.some(m => ['sending','streaming'].includes(m.status))} onClick={exportChat} aria-label="Download conversation" title="Download conversation"><Download size={18} /></button><button className="icon-button" onClick={state.toggleTheme} aria-label={state.theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>{state.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button></div>
  </header>;
}