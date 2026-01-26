/**
 * Helper to retrieve API keys, prioritizing LocalStorage > Environment Variables
 */

const STORAGE_KEY = 'viralvision_preferences';

// YouTube API key is now handled by the backend server
export function getBackendUrl(): string {
    return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
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
