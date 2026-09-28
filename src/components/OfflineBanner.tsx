import { useChatStore } from '../store/useChatStore';

export default function OfflineBanner() {
  const isOffline = useChatStore((state) => state.isOffline);

  if (!isOffline) return null;

  return (
    <div className="w-full bg-accent text-ink py-2 px-4 text-center text-sm font-medium shadow-md z-50">
      You're offline. Reconnect to keep chatting.
    </div>
  );
}