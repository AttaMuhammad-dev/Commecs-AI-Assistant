import { useEffect, useState } from 'react';
import CollegeGuide from './components/CollegeGuide';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MessageList from './components/MessageList';
import InputBar from './components/InputBar';
import OfflineBanner from './components/OfflineBanner';
import { useChatStore } from './store/useChatStore';
export default function App() {
  const [guideOpen, setGuideOpen] = useState(false);
  const setOffline = useChatStore(s => s.setOffline);
  useEffect(() => {
    const online = () => setOffline(false), offline = () => setOffline(true);
    window.addEventListener('online', online); window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, [setOffline]);
  return <div className="app-shell"><a className="skip-link" href="#question">Skip to question</a><Sidebar onGuide={() => setGuideOpen(true)} /><main className="chat-main"><OfflineBanner /><Header onGuide={() => setGuideOpen(true)} /><MessageList /><InputBar /></main><CollegeGuide open={guideOpen} onClose={() => setGuideOpen(false)} /></div>;
}