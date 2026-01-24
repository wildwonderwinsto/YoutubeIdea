import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { SavedIdeasDialog } from './components/SavedIdeasDialog';
import { Toaster } from './components/ui/use-toast';
import { toast } from './components/ui/use-toast';
import { useLocalStorage } from './hooks/useLocalStorage';
import { fetchTrendingVideos, fetchChannelFromURL, fetchRecentChannelVideos } from './lib/youtube-api';
import { Video } from './types/video';
import { rankVideos } from './lib/viral-score';
import { generateNextVideoIdea, inferNicheFromMetadata, checkContentSafety } from './lib/gemini-api';
import { Loader2 } from 'lucide-react';
import { SearchFilters, DEFAULT_FILTERS } from './types/filters';

type AppState = 'landing' | 'dashboard' | 'error';

function App() {
    const [appState, setAppState] = useState<AppState>('landing');
    const [videos, setVideos] = useState<Video[]>([]);
    const [currentNiche, setCurrentNiche] = useState('');
    const [nextVideoIdea, setNextVideoIdea] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSavedDialog, setShowSavedDialog] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

    const {
        preferences,
        updateLastNiche,
        saveIdea,
        removeIdea,
        clearAllIdeas,
    } = useLocalStorage();

    const savedVideoIds = new Set(preferences.savedIdeas.map(idea => idea.video.id));

    const handleSearch = async (niche: string) => {
        // Content safety check
        const safetyCheck = await checkContentSafety(niche);
        if (!safetyCheck.safe) {
            toast({
                title: 'Content Policy Violation',
                description: safetyCheck.reason,
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);
        setCurrentNiche(niche);
        updateLastNiche(niche);

        try {
            // Fetch trending videos
            const fetchedVideos = await fetchTrendingVideos(niche, filters.dateRange);

            if (fetchedVideos.length === 0) {
                toast({
                    title: 'No results found',
                    description: 'Try a broader or different keyword, or choose from the example niches below.',
                });
                setIsLoading(false);
                return;
            }

            // Rank videos by viral score
            const rankedVideos = rankVideos(fetchedVideos);
            setVideos(rankedVideos);

            // Generate "Next Video Idea"
            try {
                const idea = await generateNextVideoIdea(rankedVideos);
                setNextVideoIdea(idea);
            } catch (error) {
                console.warn('Failed to generate video idea:', error);
                setNextVideoIdea('Create content similar to the top-ranked videos, focusing on recent trends and high-engagement topics in your niche.');
            }

            setAppState('dashboard');
        } catch (error: any) {
            console.error('Search error:', error);

            if (error.message === 'QUOTA_EXCEEDED') {
                toast({
                    title: 'Daily limit reached',
                    description: 'Try again tomorrow or use cached results.',
                    variant: 'destructive',
                });
            } else if (!navigator.onLine) {
                toast({
                    title: 'No internet connection',
                    description: 'Please check your connection and try again.',
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: 'Search failed',
                    description: 'Could not fetch trending videos. Please try again.',
                    variant: 'destructive',
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleChannelAnalysis = async (channelUrl: string) => {
        setIsLoading(true);

        try {
            // Fetch channel info
            const channelInfo = await fetchChannelFromURL(channelUrl);

            if (!channelInfo) {
                toast({
                    title: 'Channel not found',
                    description: 'Could not analyze this channel (no public videos or access is restricted). Try entering your niche manually below.',
                    variant: 'destructive',
                });
                setIsLoading(false);
                return;
            }

            toast({
                title: 'Analyzing channel...',
                description: `Found channel: ${channelInfo.channelName}`,
            });

            // Fetch recent videos for context
            const recentVideos = await fetchRecentChannelVideos(channelInfo.channelId);

            if (recentVideos.length === 0) {
                toast({
                    title: 'No videos found',
                    description: 'This channel has no recent public videos to analyze. Please enter your niche manually.',
                    variant: 'destructive',
                });
                setIsLoading(false);
                return;
            }

            // Infer niche using Gemini with metadata
            try {
                const inferredNiche = await inferNicheFromMetadata(channelInfo.channelName, recentVideos);

                toast({
                    title: 'Niche detected',
                    description: `We think your niche is: ${inferredNiche}`,
                });

                // Continue with regular search
                await handleSearch(inferredNiche);
            } catch (error: any) {
                console.error('Niche inference failed:', error);
                toast({
                    title: 'Could not infer niche',
                    description: error.message || 'Please enter your niche manually.',
                    variant: 'destructive',
                });
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Channel analysis error:', error);
            toast({
                title: 'Analysis failed',
                description: 'Could not analyze this channel. Please try again or enter your niche manually.',
                variant: 'destructive',
            });
            setIsLoading(false);
        }
    };

    const handleSaveIdea = (video: Video) => {
        const result = saveIdea({
            video,
            savedAt: new Date(),
        });

        if (result.success) {
            toast({
                title: 'Idea saved',
                description: result.message || 'Video saved to your ideas list.',
            });
        } else {
            toast({
                title: 'Could not save',
                description: result.message || 'Failed to save this video.',
                variant: 'destructive',
            });
        }
    };

    const handleRemoveIdea = (videoId: string) => {
        removeIdea(videoId);
        toast({
            title: 'Idea removed',
            description: 'Video removed from your saved ideas.',
        });
    };

    const handleClearAll = () => {
        clearAllIdeas();
        toast({
            title: 'All ideas cleared',
            description: 'Your saved ideas list has been emptied.',
        });
    };

    const handleBack = () => {
        setAppState('landing');
        setVideos([]);
        setCurrentNiche('');
        setNextVideoIdea('');
    };

    // Show loading overlay
    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black">
                <div className="text-center">
                    <Loader2 className="mx-auto h-12 w-12 animate-spin text-red-500" />
                    <p className="mt-4 text-lg text-gray-300">Analyzing trends...</p>
                    <p className="mt-2 text-sm text-gray-500">This may take a few moments</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {appState === 'landing' && (
                <LandingPage
                    onSearch={handleSearch}
                    onChannelAnalysis={handleChannelAnalysis}
                    isLoading={isLoading}
                    filters={filters}
                    onFilterChange={setFilters}
                />
            )}

            {appState === 'dashboard' && (
                <Dashboard
                    videos={videos}
                    niche={currentNiche}
                    nextVideoIdea={nextVideoIdea}
                    onSaveIdea={handleSaveIdea}
                    savedVideoIds={savedVideoIds}
                    onBack={handleBack}
                    onViewSaved={() => setShowSavedDialog(true)}
                    savedCount={preferences.savedIdeas.length}
                    filters={filters}
                    onFilterChange={setFilters}
                />
            )}

            <SavedIdeasDialog
                open={showSavedDialog}
                onOpenChange={setShowSavedDialog}
                savedIdeas={preferences.savedIdeas}
                onRemove={handleRemoveIdea}
                onClearAll={handleClearAll}
            />

            <Toaster />
        </>
    );
}

export default App;
