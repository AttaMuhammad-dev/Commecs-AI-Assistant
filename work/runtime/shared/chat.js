export const MAX_MESSAGE_LENGTH = 600;
export const DEFAULT_PREFERENCES = { language: 'auto', responseStyle: 'concise' };
export function safeSourceUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && (url.hostname === 'commecscollege.edu.pk' || url.hostname.endsWith('.commecscollege.edu.pk'));
    }
    catch {
        return false;
    }
}
