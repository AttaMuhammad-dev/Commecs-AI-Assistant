import type { Source, Contact, Preferences, FinishReason, Lane } from '../../shared/chat';
export type { Source, Contact, Preferences };
export interface ChatMessage {
  id: string; role: 'user' | 'bot'; text: string; sources?: Source[];
  mode?: 'fast' | 'thinking' | 'verified'; contact?: Contact;
  status: 'sending' | 'streaming' | 'complete' | 'error' | 'stopped';
  createdAt: number; cached?: boolean; local?: boolean; fallback?: boolean; verifiedAt?: number;
  finishReason?: FinishReason; feedback?: 'up' | 'down';
}
export interface BotChunk {
  text?: string; sources?: Source[]; mode?: Lane | 'thinking'; contact?: Contact;
  cached?: boolean; local?: boolean; fallback?: boolean; verifiedAt?: number; finishReason?: FinishReason;
}
export interface Conversation { id: string; title: string; messages: ChatMessage[]; updatedAt: number }
