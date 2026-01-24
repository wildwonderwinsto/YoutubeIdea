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
                parsed.savedIdeas = parsed.savedIdeas.map((idea: any) => ({
                    ...idea,
                    savedAt: new Date(idea.savedAt),
                    video: {
                        ...idea.video,
                        publishedAt: new Date(idea.video.publishedAt),
                        fetchedAt: new Date(idea.video.fetchedAt),
                    },
                }));
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
        let savedIdeas = [...preferences.savedIdeas];

        // Check if already saved
        if (savedIdeas.some(idea => idea.video.id === newIdea.video.id)) {
            return { success: false, message: 'This video is already saved' };
        }

        // Auto-delete oldest if at max capacity
        if (savedIdeas.length >= MAX_SAVED_IDEAS) {
            savedIdeas.shift(); // Remove oldest
            const result = savePreferences({ ...preferences, savedIdeas: [...savedIdeas, newIdea] });
            if (result === 'SUCCESS') {
                return { success: true, message: `Oldest idea removed to make room (max ${MAX_SAVED_IDEAS} saved)` };
            } else if (result === 'QUOTA_EXCEEDED') {
                return { success: false, message: 'Storage full. Please clear some saved ideas.' };
            }
            return { success: false, message: 'Failed to save idea' };
        }

        savedIdeas.push(newIdea);
        const result = savePreferences({ ...preferences, savedIdeas });

        if (result === 'SUCCESS') {
            return { success: true };
        } else if (result === 'QUOTA_EXCEEDED') {
            return { success: false, message: 'Storage full. Please clear some saved ideas.' };
        }
        return { success: false, message: 'Failed to save idea' };
    };

    const removeIdea = (videoId: string) => {
        const savedIdeas = preferences.savedIdeas.filter(idea => idea.video.id !== videoId);
        savePreferences({ ...preferences, savedIdeas });
    };

    const clearAllIdeas = () => {
        savePreferences({ ...preferences, savedIdeas: [] });
    };

    return {
        preferences,
        updateLastNiche,
        saveIdea,
        removeIdea,
        clearAllIdeas,
    };
}
