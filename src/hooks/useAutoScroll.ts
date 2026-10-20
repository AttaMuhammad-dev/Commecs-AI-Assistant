import { useLayoutEffect, useRef, useState, type UIEvent } from 'react';

// Keep the beginning of a new answer visible; later chunks never drag readers.
export function useAutoScroll(messageCount: number, lastMessageLength = 0, conversationId = '', layoutKey = '', lastId = '') {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const previous = useRef({ conversationId, lastId: '', hasText: false });
  const readerMoved = useRef(false);
  const updatePosition = () => {
    const el = scrollRef.current;
    setIsScrolledUp(!!el && el.scrollHeight - el.scrollTop - el.clientHeight > 100);
  };
  const handleScroll = (_event: UIEvent<HTMLDivElement>) => updatePosition();
  const handleReaderIntent = () => { readerMoved.current = true; };
  const scrollToBottom = () => {
    const el = scrollRef.current;
    readerMoved.current = true;
    if (el) el.scrollTop = el.scrollHeight;
    updatePosition();
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const changed = previous.current.conversationId !== conversationId || previous.current.lastId !== lastId;
    const firstText = !previous.current.hasText && lastMessageLength > 0;
    if (changed) readerMoved.current = false;
    if (!messageCount) el.scrollTop = 0;
    else if (changed || (firstText && !readerMoved.current)) {
      const latest = el.querySelector<HTMLElement>('.message:last-of-type');
      if (latest) el.scrollTop += latest.getBoundingClientRect().top - el.getBoundingClientRect().top - 20;
    }
    previous.current = { conversationId, lastId, hasText: lastMessageLength > 0 };
    updatePosition();
  }, [messageCount, lastMessageLength, conversationId, layoutKey, lastId]);
  return { scrollRef, handleScroll, handleReaderIntent, isScrolledUp, scrollToBottom };
}
