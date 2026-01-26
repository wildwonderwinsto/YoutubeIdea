import { useState, useEffect } from 'react';
import { SavedIdea, UserPreferences } from '@/types/video';
import { logger } from '@/lib/logger';

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
    // Helper to safely parse stored data
    const parsePreferences = (stored: string | null): UserPreferences => {
        if (!stored) {
            return { lastNiche: '', savedIdeas: [] };
        }
        try {
            const parsed = JSON.parse(stored);
            // Convert ISO strings back to Date objects
            parsed.savedIdeas = (parsed.savedIdeas || [])
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
            return parsed;
        } catch (error) {
            logger.error('Failed to parse preferences:', error);
            return { lastNiche: '', savedIdeas: [] };
        }
    };

    // Load from LocalStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        setPreferences(parsePreferences(stored));

        // Listen for changes from other components/tabs
        const handleStorageChange = () => {
            const fresh = localStorage.getItem(STORAGE_KEY);
            setPreferences(parsePreferences(fresh));
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Safe read-modify-write operation
    const modifyPreferences = (updater: (current: UserPreferences) => UserPreferences): string => {
        try {
            // 1. Read latest from disk to avoid stale state
            const stored = localStorage.getItem(STORAGE_KEY);
            const current = parsePreferences(stored);

            // 2. Apply update
            const newValue = updater(current);

            // 3. Write back
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newValue));

            // 4. Update local state
            setPreferences(newValue);
            return 'SUCCESS';
        } catch (error) {
            logger.error('Failed to save preferences to LocalStorage:', error);
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                return 'QUOTA_EXCEEDED';
            }
            return 'ERROR';
        }
    };

    const updateLastNiche = (niche: string) => {
        modifyPreferences(prev => ({ ...prev, lastNiche: niche }));
    };

    const saveIdea = (newIdea: SavedIdea): { success: boolean; message?: string } => {
        let result: { success: boolean; message?: string } = { success: false };

        modifyPreferences(prev => {
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
            return { ...prev, savedIdeas };
        });

        return result;
    };

    const removeIdea = (videoId: string) => {
        modifyPreferences(prev => ({
            ...prev,
            savedIdeas: prev.savedIdeas.filter(idea => idea.video.id !== videoId)
        }));
    };

    const clearAllIdeas = () => {
        modifyPreferences(prev => ({ ...prev, savedIdeas: [] }));
    };

    return {
        preferences,
        updateLastNiche,
        saveIdea,
        removeIdea,
        clearAllIdeas,
    };
}


