import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { RequestProgress } from '../types/chat';
import { progressLabel, waitingLabel } from '../lib/progressText';

export default function TypingIndicator({ progress }: { progress: RequestProgress | null }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [progress?.startedAt]);
  const language = progress?.language || 'en';
  const seconds = progress ? Math.max(0, Math.floor((now - progress.startedAt) / 1000)) : 0;
  return <div className="typing" dir={language === 'ur' ? 'rtl' : 'ltr'}>
    <LoaderCircle size={16} className="typing-spinner" aria-hidden="true" />
    <div className="typing-text">
      <span role="status" aria-live="polite" aria-atomic="true">{progressLabel(progress?.phase || 'sending', language, progress?.reason)}</span>
      {seconds >= 8 && <small aria-hidden="true">{waitingLabel(language, seconds)}</small>}
    </div>
  </div>;
}
