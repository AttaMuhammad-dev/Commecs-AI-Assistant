import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface FileSearchState {
  storeName?: string;
  embeddingModel?: string;
  documents: Record<string, { 
    documentName: string; 
    contentHash: string; 
    modifiedGmt: string; 
  }>;
  lastRun?: string;
}

const STATE_PATH = resolve(process.cwd(), 'knowledge', '.filesearch.json');

export function loadState(): FileSearchState {
  try {
    const raw = readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { documents: {} };
  }
}

export function saveState(state: FileSearchState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}