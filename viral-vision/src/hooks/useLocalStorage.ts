import { useState, useEffect } from 'react';
import { SavedIdea, UserPreferences } from '@/types/video';

const MAX_SAVED_IDEAS = 50;
const STORAGE_KEY = 'viralvision_preferences';

/**
 * Hook for managing user preferences in LocalStorage
 */
export function useLocalStorage() {
    const [preferences, setPreferences] = useState<UserPreferences>({
        lastNiche: '',
        savedIdeas: [],
    });

    // Load from LocalStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Convert ISO strings back to Date objects
                parsed.savedIdeas = parsed.savedIdeas
                    .map((idea: any) => {
                        try {
                            return {
                                ...idea,
                                savedAt: idea.savedAt ? new Date(idea.savedAt) : new Date(),
                                video: {
                                    ...idea.video,
                                    publishedAt: idea.video.publishedAt
                                        ? new Date(idea.video.publishedAt)
                                        : new Date(),
                                    fetchedAt: idea.video.fetchedAt
                                        ? new Date(idea.video.fetchedAt)
                                        : new Date(),
                                },
                            };
                        } catch {
                            return null;
                        }
                    })
                    .filter(Boolean);
                setPreferences(parsed);
            }
        } catch (error) {
            console.error('Failed to load preferences from LocalStorage:', error);
        }
    }, []);

    // Save to LocalStorage whenever preferences change
    const savePreferences = (newPreferences: UserPreferences) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
            setPreferences(newPreferences);
        } catch (error) {
            console.error('Failed to save preferences to LocalStorage:', error);
            // Check if quota exceeded
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                return 'QUOTA_EXCEEDED';
            }
            return 'ERROR';
        }
        return 'SUCCESS';
    };

    const updateLastNiche = (niche: string) => {
        const newPreferences = { ...preferences, lastNiche: niche };
        savePreferences(newPreferences);
    };

    const saveIdea = (newIdea: SavedIdea): { success: boolean; message?: string } => {
        let result: { success: boolean; message?: string } = { success: false };

        setPreferences(prev => {
            let savedIdeas = [...prev.savedIdeas];

            if (savedIdeas.some(idea => idea.video.id === newIdea.video.id)) {
                result = { success: false, message: 'This video is already saved' };
                return prev;
            }

            if (savedIdeas.length >= MAX_SAVED_IDEAS) {
                savedIdeas.shift();
                result = { success: true, message: `Oldest idea removed (max ${MAX_SAVED_IDEAS})` };
            } else {
                result = { success: true };
            }

            savedIdeas.push(newIdea);
            const newPreferences = { ...prev, savedIdeas };

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
            } catch (error) {
                if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                    result = { success: false, message: 'Storage full' };
                    return prev;
                }
            }

            return newPreferences;
        });

        return result;
    };

    const removeIdea = (videoId: string) => {
        const savedIdeas = preferences.savedIdeas.filter(idea => idea.video.id !== videoId);
        savePreferences({ ...preferences, savedIdeas });
    };

    const clearAllIdeas = () => {
        savePreferences({ ...preferences, savedIdeas: [] });
    };

    const updateApiKeys = (keys: { youtube?: string; gemini?: string }) => {
        const newPreferences = {
            ...preferences,
            apiKeys: {
                ...preferences.apiKeys,
                ...keys
            }
        };
        savePreferences(newPreferences);
    };

    return {
        preferences,
        updateLastNiche,
        saveIdea,
        removeIdea,
        clearAllIdeas,
        updateApiKeys,
    };
}


