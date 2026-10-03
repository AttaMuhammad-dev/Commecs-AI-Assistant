export type ThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface ModelConfig {
  id: string;
  allowedThinking: ThinkingLevel[];
  defaultThinking: ThinkingLevel;
}

export const MODEL_CATALOG: Record<string, ModelConfig> = {
  'gemini-3.8-flash': { id: 'gemini-3.8-flash', allowedThinking: ['LOW', 'MEDIUM', 'HIGH'], defaultThinking: 'MEDIUM' },
  'gemini-3.7-flash': { id: 'gemini-3.7-flash', allowedThinking: ['LOW', 'MEDIUM', 'HIGH'], defaultThinking: 'MEDIUM' },
  'gemini-3.6-flash': { id: 'gemini-3.6-flash', allowedThinking: ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'], defaultThinking: 'MEDIUM' },
  'gemini-3.5-flash': { id: 'gemini-3.5-flash', allowedThinking: ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'], defaultThinking: 'MEDIUM' },
  'gemini-3.1-flash-lite': { id: 'gemini-3.1-flash-lite', allowedThinking: ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'], defaultThinking: 'LOW' },
  'gemini-3.5-flash-lite': { id: 'gemini-3.5-flash-lite', allowedThinking: ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'], defaultThinking: 'LOW' }
};

const thinkingRanks: Record<ThinkingLevel, number> = { 'MINIMAL': 1, 'LOW': 2, 'MEDIUM': 3, 'HIGH': 4 };

// A dynamic record to remember if we got a 400 error on a model's thinking level
export const downgradedModels = new Set<string>();

export function clampThinking(modelId: string, wanted: ThinkingLevel): ThinkingLevel {
  const config = MODEL_CATALOG[modelId];
  if (!config) return 'LOW';
  if (!(wanted in thinkingRanks)) wanted = config.defaultThinking;
  
  if (downgradedModels.has(modelId)) return 'LOW'; // Clamp permanently if it 400'd previously
  if (config.allowedThinking.includes(wanted)) return wanted;

  let closest = config.allowedThinking[0];
  let minDiff = Infinity;
  const wantedRank = thinkingRanks[wanted];

  for (const level of config.allowedThinking) {
    const diff = Math.abs(thinkingRanks[level] - wantedRank);
    if (diff < minDiff) {
      minDiff = diff;
      closest = level;
    }
  }
  return closest;
}

const defaults = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];
function ladder(value?: string): string[] {
  const configured = (value || '').split(',').map(s => s.trim()).filter(id => id in MODEL_CATALOG);
  // Invalid environment overrides must not leave an empty ladder.
  return [...new Set([...configured, ...defaults])].slice(0, 3);
}
export const getFastLadder = () => ladder(process.env.MODEL_LADDER_FAST);
export const getDeepLadder = () => ladder(process.env.MODEL_LADDER_DEEP);
