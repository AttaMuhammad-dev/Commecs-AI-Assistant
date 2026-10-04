import { DEFAULT_PREFERENCES, type Preferences } from '../../shared/chat';
export const preferencesKey = 'commecs-preferences-v1';
export function readPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
    return {
      language: value && ['auto', 'en', 'ur', 'roman'].includes(value.language) ? value.language : DEFAULT_PREFERENCES.language,
      responseStyle: value && ['concise', 'detailed'].includes(value.responseStyle) ? value.responseStyle : DEFAULT_PREFERENCES.responseStyle,
    };
  } catch { return { ...DEFAULT_PREFERENCES }; }
}
