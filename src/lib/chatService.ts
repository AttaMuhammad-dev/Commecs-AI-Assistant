import { streamGeminiResponse } from './geminiChatService';
import { streamBotResponse as mockStream } from './mockChatService';
import type { BotChunk, ChatMessage, Preferences } from '../types/chat';
export async function* streamBotResponse(message: string, history: ChatMessage[], signal?: AbortSignal, preferences?: Preferences): AsyncGenerator<BotChunk> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    yield* mockStream(message, history, signal);
    yield { finishReason: 'STOP' };
  } else yield* streamGeminiResponse(message, history, signal, preferences);
}
