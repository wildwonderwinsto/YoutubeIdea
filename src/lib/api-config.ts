
/**
 * API configuration utilities for secure backend communication.
 * Supports BYOK (Bring Your Own Key) where user-provided keys
 * are sent via headers and prioritized over server defaults.
 */

// YouTube API key is now handled by the backend server
export function getBackendUrl(): string {
    return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
}

const STORAGE_KEY = 'viralvision_preferences';

// Cache for parsed preferences to avoid repeated JSON parsing
let cachedPreferences: { apiKeys?: { youtube?: string; gemini?: string } } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

// Type guard for preferences validation
function isValidPreferences(obj: any): obj is { apiKeys?: { youtube?: string; gemini?: string } } {
    if (!obj || typeof obj !== 'object') return false;

    if (obj.apiKeys !== undefined) {
        if (typeof obj.apiKeys !== 'object') return false;

        const { youtube, gemini } = obj.apiKeys;
        if (youtube !== undefined && typeof youtube !== 'string') return false;
        if (gemini !== undefined && typeof gemini !== 'string') return false;
    }

    return true;
}

function getPreferences(): { apiKeys?: { youtube?: string; gemini?: string } } | null {
    const now = Date.now();

    // Return cached value if valid
    if (cachedPreferences && (now - cacheTimestamp) < CACHE_TTL) {
        return cachedPreferences;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            cachedPreferences = null;
            cacheTimestamp = now;
            return null;
        }

        const parsed = JSON.parse(stored);

        if (!isValidPreferences(parsed)) {
            console.warn('[api-config] Invalid preferences schema in localStorage');
            cachedPreferences = null;
            cacheTimestamp = now;
            return null;
        }

        cachedPreferences = parsed;
        cacheTimestamp = now;
        return parsed;
    } catch (e) {
        if (import.meta.env.DEV) {
            console.error('[api-config] Failed to parse preferences:', e);
        }
        cachedPreferences = null;
        cacheTimestamp = now;
        return null;
    }
}

// Invalidate cache when storage changes (e.g., from another tab or component)
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            cachedPreferences = null;
            cacheTimestamp = 0;
        }
    });
}

/**
 * Get authentication headers for API requests.
 * Includes user-provided API keys if available.
 * Note: Content-Type is always included for consistency with POST requests.
 */
export function getAuthHeaders(): HeadersInit {
    const preferences = getPreferences();
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

/**
 * Manually invalidate the preferences cache.
 * Call this after updating localStorage outside of this module.
 */
export function invalidatePreferencesCache(): void {
    cachedPreferences = null;
    cacheTimestamp = 0;
}
