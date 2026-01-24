/**
 * Helper to retrieve API keys, prioritizing LocalStorage > Environment Variables
 */

const STORAGE_KEY = 'viralvision_preferences';

export function getYouTubeApiKey(): string {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const preferences = JSON.parse(stored);
            if (preferences.apiKeys?.youtube) {
                return preferences.apiKeys.youtube;
            }
        }
    } catch (e) {
        // Ignore JSON parse errors
    }
    return import.meta.env.VITE_YOUTUBE_API_KEY || '';
}

export function getGeminiApiKey(): string {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const preferences = JSON.parse(stored);
            if (preferences.apiKeys?.gemini) {
                return preferences.apiKeys.gemini;
            }
        }
    } catch (e) {
        // Ignore JSON parse errors
    }
    return import.meta.env.VITE_GEMINI_API_KEY || '';
}

