import { useState, useEffect } from 'react';
import { ToolSelector } from './components/ToolSelector';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { SavedIdeasDialog } from './components/SavedIdeasDialog';
import { VideoAnalyzer } from './pages/VideoAnalyzer';
import { ChannelFinder } from './pages/ChannelFinder';
import { KeywordResearch } from './pages/KeywordResearch';
import { VideoSimilarity } from './pages/VideoSimilarity';
import { ThumbnailGenerator } from './pages/ThumbnailGenerator';
import { Toaster } from './components/ui/use-toast';
import { toast } from './components/ui/use-toast';
import { useLocalStorage } from './hooks/useLocalStorage';
import { fetchTrendingVideos, fetchChannelFromURL, fetchRecentChannelVideos } from './lib/youtube-api';
import { Video } from './types/video';
import { rankVideos } from './lib/viral-score';
import { generateNextVideoIdea, inferNicheFromMetadata, checkContentSafety } from './lib/gemini-api';
import { Loader2 } from 'lucide-react';
import { SearchFilters, DEFAULT_FILTERS } from './types/filters';
import { logger } from './lib/logger';

type AppState = 'tool-selector' | 'niche-finder' | 'dashboard' | 'video-analyzer' | 'channel-finder' | 'keyword-tool' | 'video-similarity' | 'thumbnail-generator';

function App() {
    const [appState, setAppState] = useState<AppState>('tool-selector');
    const [videos, setVideos] = useState<Video[]>([]);
    const [currentNiche, setCurrentNiche] = useState('');
    const [nextVideoIdea, setNextVideoIdea] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMoreLoading, setIsMoreLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState('Initializing...');
    const [showSavedDialog, setShowSavedDialog] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
    // State for pagination tokens
    const [nextPageTokenMap, setNextPageTokenMap] = useState<Record<string, string> | undefined>(undefined);

    const {
        preferences,
        updateLastNiche,
        saveIdea,
        removeIdea,
        clearAllIdeas,
    } = useLocalStorage();

    const savedVideoIds = new Set(preferences.savedIdeas.map(idea => idea.video.id));

    // Update page title and favicon based on current tool
    useEffect(() => {
        const titles = {
            'tool-selector': 'ViralVision - Choose Your Tool',
            'niche-finder': 'ViralVision - Niche Finder',
            'dashboard': 'ViralVision - Results',
            'video-analyzer': 'ViralVision - Video Analyzer',
            'channel-finder': 'ViralVision - Channel Finder',
            'keyword-tool': 'ViralVision - Keyword Research',
            'video-similarity': 'ViralVision - Video Similarity',
            'thumbnail-generator': 'ViralVision - Thumbnail Generator'
        };

        const favicons = {
            'tool-selector': '/favicon-eye.svg',
            'niche-finder': '/favicon-search.svg',
            'dashboard': '/favicon-search.svg',
            'video-analyzer': '/favicon-film.svg',
            'channel-finder': '/favicon-users.svg',
            'keyword-tool': '/favicon-hash.svg',
            'video-similarity': '/favicon-video.svg',
            'thumbnail-generator': '/favicon-image.svg'
        };

        // Update title
        document.title = titles[appState] || 'ViralVision';

        // Update favicon
        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
        link.type = 'image/svg+xml';
        link.rel = 'icon';
        link.href = favicons[appState] || '/favicon-eye.svg';
        if (!document.querySelector("link[rel*='icon']")) {
            document.head.appendChild(link);
        }
    }, [appState]);

    const handleSearch = async (niche: string, isLoadMore = false) => {
        // Content safety check (only on initial search)
        if (!isLoadMore) {
            const safetyCheck = await checkContentSafety(niche);
            if (!safetyCheck.safe) {
                toast({
                    title: 'Content Policy Violation',
                    description: safetyCheck.reason,
                    variant: 'destructive',
                });
                return;
            }
        }

        if (!isLoadMore) {
            setIsLoading(true);
            setLoadingStatus('Checking content safety...');
            setCurrentNiche(niche);
            updateLastNiche(niche);
            setVideos([]); // Clear existing videos on new search
            setNextPageTokenMap(undefined); // Reset tokens
        } else {
            setIsMoreLoading(true);
            setLoadingStatus('Fetching more videos...');
        }

        try {
            // Fetch trending videos
            if (!isLoadMore) setLoadingStatus(`Fetching trending videos for "${niche}"...`);

            // Call API with filters and current tokens
            const { videos: newVideos, nextPageTokenMap: newTokens } = await fetchTrendingVideos(
                niche,
                filters,
                isLoadMore ? nextPageTokenMap : undefined
            );

            if (newVideos.length === 0 && !isLoadMore) {
                toast({
                    title: 'No results found',
                    description: 'Try a broader or different keyword, or choose from the example niches below.',
                });
                setIsLoading(false);
                return;
            }

            if (newVideos.length === 0 && isLoadMore) {
                toast({
                    title: 'No more results',
                    description: 'You have reached the end of the list for this search.',
                });
            }

            // Update tokens for next fetch
            setNextPageTokenMap(newTokens);

            // Rank videos by viral score
            // Note: For load more, we rank the NEW batch separately. 
            if (!isLoadMore) setLoadingStatus('Ranking videos by viral potential...');

            const rankedNewVideos = rankVideos(newVideos);

            setVideos(prev => {
                // If loading more, append. If new search, replace (prev is empty anyway)
                const combined = isLoadMore ? [...prev, ...rankedNewVideos] : rankedNewVideos;

                // Deduplicate by ID just in case API returned overlaps
                const uniqueIds = new Set();
                return combined.filter(v => {
                    if (uniqueIds.has(v.id)) return false;
                    uniqueIds.add(v.id);
                    return true;
                });
            });

            // Generate "Next Video Idea" only on initial search
            if (!isLoadMore) {
                try {
                    setLoadingStatus('Generating AI video ideas...');
                    const idea = await generateNextVideoIdea(rankedNewVideos);
                    setNextVideoIdea(idea);
                } catch (error) {
                    logger.warn('Failed to generate video idea:', error);
                    setNextVideoIdea('Create content similar to the top-ranked videos, focusing on recent trends and high-engagement topics in your niche.');
                }
            }

            setAppState('dashboard');
        } catch (error) {
            logger.error('Search error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            if (errorMessage === 'QUOTA_EXCEEDED' || errorMessage === 'RATE_LIMIT') {
                toast({
                    title: 'API Limit Reached',
                    description: 'The shared API key has exceeded its daily quota. Please click the Settings gear icon to add your own API key.',
                    variant: 'destructive',
                    duration: 10000,
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
                    description: errorMessage || 'Could not fetch trending videos. Please check your API key and try again.',
                    variant: 'destructive',
                });
            }
        } finally {
            setIsLoading(false);
            setIsMoreLoading(false);
        }
    };

    const handleChannelAnalysis = async (channelUrl: string) => {
        setIsLoading(true);
        setLoadingStatus('Analyzing channel profile...');

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
            setLoadingStatus('Scanning recent uploads...');
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
                setLoadingStatus('Inferring niche from content...');
                const inferredNiche = await inferNicheFromMetadata(channelInfo.channelName, recentVideos);

                toast({
                    title: 'Niche detected',
                    description: `We think your niche is: ${inferredNiche}`,
                });

                // Continue with regular search
                await handleSearch(inferredNiche);
            } catch (error) {
                logger.error('Niche inference failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                toast({
                    title: 'Could not infer niche',
                    description: errorMessage || 'Please enter your niche manually.',
                    variant: 'destructive',
                });
                setIsLoading(false);
            }
        } catch (error) {
            logger.error('Channel analysis error:', error);
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
        setAppState('tool-selector');
        setVideos([]);
        setCurrentNiche('');
        setNextVideoIdea('');
    };

    // Show loading overlay
    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black p-4">
                <div className="text-center space-y-6 max-w-md w-full">
                    <div className="relative mx-auto h-20 w-20">
                        <div className="absolute inset-0 rounded-full border-t-2 border-red-500/20 blur-sm animate-pulse" />
                        <Loader2 className="h-full w-full animate-spin text-red-500 relative z-10" />
                    </div>

                    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-2xl font-semibold text-white tracking-tight">
                            {loadingStatus}
                        </h3>
                        <p className="text-gray-400 text-sm">
                            Powered by AI · Analyzing real-time data
                        </p>
                    </div>

                    {/* Simple progress bar visual */}
                    <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-600 to-red-400 w-1/2 animate-[shimmer_2s_infinite] rounded-full" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500">
            {appState === 'tool-selector' && (
                <ToolSelector onSelectTool={setAppState} />
            )}

            {appState === 'niche-finder' && (
                <LandingPage
                    onSearch={(n) => handleSearch(n)}
                    onChannelAnalysis={handleChannelAnalysis}
                    isLoading={isLoading}
                    filters={filters}
                    onFilterChange={setFilters}
                    onNavigateToAnalyzer={() => setAppState('video-analyzer')}
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
                    onLoadMore={() => handleSearch(currentNiche, true)}
                    hasMore={!!nextPageTokenMap && Object.keys(nextPageTokenMap).length > 0}
                    isLoadingMore={isMoreLoading}
                />
            )}

            {appState === 'video-analyzer' && (
                <VideoAnalyzer />
            )}

            {appState === 'channel-finder' && (
                <ChannelFinder />
            )}

            {appState === 'keyword-tool' && (
                <KeywordResearch />
            )}

            {appState === 'video-similarity' && (
                <VideoSimilarity />
            )}

            {appState === 'thumbnail-generator' && (
                <ThumbnailGenerator />
            )}

            <SavedIdeasDialog
                open={showSavedDialog}
                onOpenChange={setShowSavedDialog}
                savedIdeas={preferences.savedIdeas}
                onRemove={handleRemoveIdea}
                onClearAll={handleClearAll}
            />

            <Toaster />
        </div>
    );
}

export default App;
