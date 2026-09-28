import type { ChatMessage, BotChunk } from '../types/chat';
import { findBestMockMatch } from '../data/mockResponses';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function* streamBotResponse(
  userMessage: string,
  _history: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<BotChunk> {
  
  if (import.meta.env.DEV && userMessage === "/error") {
    throw new Error("Mock network error");
  }

  const match = findBestMockMatch(userMessage);
  const words = match.answer.split(" ");
  
  for (let i = 0; i < words.length; i++) {
    if (signal?.aborted) return;
    
    await delay(25 + Math.random() * 30);
    
    const isLast = i === words.length - 1;
    yield {
      text: words[i] + (isLast ? "" : " "),
      ...(isLast ? { mode: "fast" as const, finishReason: 'STOP' as const } : {}),
    };
  }
}
