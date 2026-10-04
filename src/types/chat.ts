import type { Source, Contact, Preferences, FinishReason, Lane, ChatProgress, Language } from '../../shared/chat';
export type { Source, Contact, Preferences };
export interface ChatMessage {
  id: string; role: 'user' | 'bot'; text: string; sources?: Source[];
  mode?: 'fast' | 'thinking' | 'verified'; contact?: Contact;
  status: 'sending' | 'streaming' | 'complete' | 'error' | 'stopped';
  createdAt: number; cached?: boolean; local?: boolean; fallback?: boolean; verifiedAt?: number;
  finishReason?: FinishReason; feedback?: 'up' | 'down';
}
export interface BotChunk {
  progress?: ChatProgress;
  text?: string; sources?: Source[]; mode?: Lane | 'thinking'; contact?: Contact;
  cached?: boolean; local?: boolean; fallback?: boolean; verifiedAt?: number; finishReason?: FinishReason;
}
export interface RequestProgress {
  conversationId: string; messageId: string; startedAt: number;
  language: Exclude<Language, 'auto'>; phase: ChatProgress['phase'] | 'sending'; reason?: 'timeout';
}
export interface Conversation { id: string; title: string; messages: ChatMessage[]; updatedAt: number }
