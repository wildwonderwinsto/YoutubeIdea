

// YouTube API key is now handled by the backend server
export function getBackendUrl(): string {
    return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
}

const STORAGE_KEY = 'viralvision_preferences';

export function getAuthHeaders(): HeadersInit {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const preferences = JSON.parse(stored);
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (preferences?.apiKeys?.youtube) {
                headers['x-youtube-api-key'] = preferences.apiKeys.youtube;
            }
            if (preferences?.apiKeys?.gemini) {
                headers['x-gemini-api-key'] = preferences.apiKeys.gemini;
            }
            return headers;
        }
    } catch (e) {
        // Ignore JSON parse errors
    }
    return { 'Content-Type': 'application/json' };
}
