import { Video } from '@/types/video';
import { VideoCard } from './VideoCard';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Lightbulb, TrendingUp, BarChart3, BookOpen, Home, Bookmark, Sparkles } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useState, useEffect } from 'react';
import { generateWhyItWorksExplanation } from '@/lib/gemini-api';

import { SearchFilters } from '@/types/filters';
import { FilterDialog } from './FilterDialog';
import { ApiKeySettings } from './ApiKeySettings';

interface DashboardProps {
    videos: Video[];
    niche: string;
    nextVideoIdea: string;
    onSaveIdea: (video: Video) => void;
    savedVideoIds: Set<string>;
    onBack: () => void;
    onViewSaved: () => void;
    savedCount: number;
    filters: SearchFilters;
    onFilterChange: (filters: SearchFilters) => void;
}

export function Dashboard({
    videos,
    niche,
    nextVideoIdea,
    onSaveIdea,
    savedVideoIds,
    onBack,
    onViewSaved,
    savedCount,
    filters,
    onFilterChange,
}: DashboardProps) {
    const [activeTab, setActiveTab] = useState('leaderboard');
    const [explanations, setExplanations] = useState<Record<string, string>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const APP_PAGE_SIZE = 24;

    // Reset page on filter/tab change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters, activeTab, videos]);

    // Apply filters
    const filteredVideos = videos.filter(v => {
        // Region filter
        if (filters.region !== 'ALL' && v.region !== filters.region) return false;

        // Duration filter
        if (filters.duration === 'SHORT' && v.lengthSeconds >= 60) return false;
        if (filters.duration === 'MEDIUM' && (v.lengthSeconds < 60 || v.lengthSeconds > 300)) return false;
        if (filters.duration === 'LONG' && v.lengthSeconds <= 300) return false;

        // Channel Size filter
        if (filters.channelSize === 'SMALL' && v.subscriberCount >= 10000) return false;
        if (filters.channelSize === 'MEDIUM' && (v.subscriberCount < 10000 || v.subscriberCount > 500000)) return false;
        if (filters.channelSize === 'LARGE' && v.subscriberCount <= 500000) return false;

        // Min Views filter
        const minViews = filters.minViews === 'ALL' ? 0 : parseInt(filters.minViews);
        if (v.views < minViews) return false;

        return true;
    });

    // Pagination Logic
    const totalItems = filteredVideos.length;
    const totalPages = Math.ceil(totalItems / APP_PAGE_SIZE);
    const startIndex = (currentPage - 1) * APP_PAGE_SIZE;
    const currentVideos = filteredVideos.slice(startIndex, startIndex + APP_PAGE_SIZE);

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(prev => prev + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // Filter outlier videos from the filtered set
    const outlierVideos = filteredVideos.filter(v => v.isOutlier && v.subscriberCount < 5000);

    // Prepare graph data from filtered set
    const graphData = filteredVideos.map(v => ({
        length: v.lengthSeconds,
        avdTier: v.estimatedAVDTier === 'High' ? 100 : v.estimatedAVDTier === 'Medium' ? 60 : 30,
        viralScore: v.viralScore,
        title: v.title,
        id: v.id,
    }));

    // Load explanations for strategy feed
    useEffect(() => {
        if (activeTab === 'strategy' && currentVideos.length > 0) {
            // Only explain currently visible videos to save quota/performance
            const visibleStrategyVideos = currentVideos.slice(0, 5);

            visibleStrategyVideos.forEach(async (video) => {
                if (!explanations[video.id]) {
                    try {
                        const explanation = await generateWhyItWorksExplanation(video);
                        setExplanations(prev => ({ ...prev, [video.id]: explanation }));
                    } catch (error) {
                        console.error('Failed to load explanation:', error);
                    }
                }
            });
        }
    }, [activeTab, currentVideos, explanations]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-white/10 bg-gray-900/80 backdrop-blur-lg">
                <div className="container mx-auto flex items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onBack}
                            className="text-gray-400 hover:text-white"
                        >
                            <Home className="mr-2 h-4 w-4" />
                            New Search
                        </Button>
                        <div className="h-6 w-px bg-gray-700" />
                        <div className="flex items-center gap-2">
                            <div className="rounded-full bg-gradient-to-r from-red-500 to-orange-500 p-1.5">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                            <h1 className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-xl font-black text-transparent">
                                ViralVision
                            </h1>
                            <div className="mx-2 h-6 w-px bg-gray-700" />
                            <span className="text-lg font-medium text-white capitalize">
                                {niche}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ApiKeySettings />
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                                >
                                    <Lightbulb className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="border-yellow-500/20 bg-gray-900 sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-xl text-white">
                                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                                        Next Video Idea
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="py-4">
                                    <p className="text-lg leading-relaxed text-gray-200">{nextVideoIdea}</p>
                                    <p className="mt-4 text-sm text-gray-400 border-t border-white/10 pt-4">
                                        AI-generated recommendation based on current viral trends.
                                    </p>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onViewSaved}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                            <Bookmark className="mr-2 h-4 w-4" />
                            Saved Ideas ({savedCount}/50)
                        </Button>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-8">
                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <TabsList className="bg-gray-900/50 w-full grid grid-cols-4 md:w-auto md:grid-cols-none md:flex">
                            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                                <TrendingUp className="mr-2 h-4 w-4" />
                                <span className="hidden md:inline">Leaderboard</span>
                                <span className="md:hidden">Top</span>
                            </TabsTrigger>
                            <TabsTrigger value="outlier" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                                <Sparkles className="mr-2 h-4 w-4" />
                                <span className="hidden md:inline">Outlier Radar</span>
                                <span className="md:hidden">Radar</span>
                            </TabsTrigger>
                            <TabsTrigger value="graph" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                                <BarChart3 className="mr-2 h-4 w-4" />
                                <span className="hidden md:inline">Graph View</span>
                                <span className="md:hidden">Graph</span>
                            </TabsTrigger>
                            <TabsTrigger value="strategy" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                                <BookOpen className="mr-2 h-4 w-4" />
                                <span className="hidden md:inline">Strategy Feed</span>
                                <span className="md:hidden">Feed</span>
                            </TabsTrigger>
                        </TabsList>

                        <FilterDialog
                            filters={filters}
                            onFilterChange={onFilterChange}
                        />
                    </div>

                    {/* Leaderboard Tab */}
                    <TabsContent value="leaderboard" className="space-y-6">
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {currentVideos.map((video) => (
                                <VideoCard
                                    key={video.id}
                                    video={video}
                                    onSave={() => onSaveIdea(video)}
                                    isSaved={savedVideoIds.has(video.id)}
                                />
                            ))}
                        </div>
                        {currentVideos.length === 0 && (
                            <Card className="border-white/10 bg-gray-900/50 p-12 text-center">
                                <p className="text-gray-400">No videos found matching your filters.</p>
                            </Card>
                        )}

                        {/* Pagination Footer */}
                        {totalItems > 0 && (
                            <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-gray-800 pt-6 sm:flex-row">
                                <p className="text-sm text-gray-400">
                                    Showing <span className="font-medium text-white">{startIndex + 1}-{Math.min(startIndex + APP_PAGE_SIZE, totalItems)}</span> of <span className="font-medium text-white">{totalItems}</span> results
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 1}
                                        className="border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                                    >
                                        Previous
                                    </Button>
                                    <div className="flex items-center gap-1 px-2 text-sm text-gray-400">
                                        Page <span className="font-medium text-white">{currentPage}</span> of {totalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleNextPage}
                                        disabled={currentPage === totalPages}
                                        className="border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* Outlier Radar Tab */}
                    <TabsContent value="outlier" className="space-y-6">
                        <Card className="border-yellow-500/30 bg-yellow-950/20">
                            <CardContent className="p-4">
                                <p className="text-sm text-yellow-200">
                                    <strong>Outlier Radar:</strong> Small channels (&lt;5k subs) with viral signals in the last 7 days.
                                    These creators are "punching above their weight" – perfect inspiration for your next video.
                                </p>
                            </CardContent>
                        </Card>

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {outlierVideos.map((video) => (
                                <VideoCard
                                    key={video.id}
                                    video={video}
                                    onSave={() => onSaveIdea(video)}
                                    isSaved={savedVideoIds.has(video.id)}
                                />
                            ))}
                        </div>

                        {outlierVideos.length === 0 && (
                            <Card className="border-white/10 bg-gray-900/50 p-12 text-center">
                                <p className="text-gray-400">
                                    No outlier videos found. Try a different niche or broader search term.
                                </p>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Graph View Tab */}
                    <TabsContent value="graph" className="space-y-6">
                        <Card className="border-white/10 bg-gray-900/50">
                            <CardHeader>
                                <CardTitle className="text-white">Video Length vs. Estimated AVD Tier</CardTitle>
                                <p className="text-sm text-gray-400">
                                    Scatter plot showing relationship between video length and retention tier.
                                    Larger circles = higher viral scores.
                                </p>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis
                                            dataKey="length"
                                            name="Length"
                                            type="number"
                                            stroke="#9ca3af"
                                            tickFormatter={(value) => {
                                                const minutes = Math.floor(value / 60);
                                                const seconds = value % 60;
                                                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                            }}
                                            label={{ value: 'Video Length (mm:ss)', position: 'insideBottom', offset: -10, fill: '#9ca3af' }}
                                        />
                                        <YAxis
                                            dataKey="avdTier"
                                            name="AVD Tier"
                                            type="number"
                                            domain={[0, 110]}
                                            ticks={[30, 60, 100]}
                                            tickFormatter={(value) => value === 30 ? 'Low' : value === 60 ? 'Medium' : 'High'}
                                            stroke="#9ca3af"
                                            width={50}
                                        />
                                        <Tooltip
                                            content={({ active, payload }: any) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="rounded-lg border border-white/10 bg-gray-900 p-3 shadow-lg">
                                                            <p className="mb-1 font-semibold text-white">{data.title}</p>
                                                            <p className="text-sm text-gray-300">Length: {data.length}s</p>
                                                            <p className="text-sm text-gray-300">Viral Score: {data.viralScore.toFixed(0)}/100</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Scatter data={graphData}>
                                            {graphData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.viralScore > 70 ? '#ef4444' : entry.viralScore > 50 ? '#f59e0b' : '#6b7280'}
                                                    r={4 + (entry.viralScore / 10)}
                                                />
                                            ))}
                                        </Scatter>
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="border-blue-500/30 bg-blue-950/20">
                            <CardContent className="p-4 text-sm text-blue-200">
                                <p>
                                    <strong>ℹ️ Note:</strong> Retention tiers are AI estimates based on public signals (view velocity, subscriber ratio, engagement).
                                    Actual AVD data is not available through YouTube's public API.
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Strategy Feed Tab */}
                    <TabsContent value="strategy" className="space-y-6">
                        {currentVideos.slice(0, 5).map((video) => (
                            <Card key={video.id} className="border-white/10 bg-gray-900/50">
                                <div className="flex flex-col gap-4 p-6 md:flex-row">
                                    {/* Thumbnail */}
                                    <div className="relative aspect-video w-full overflow-hidden rounded-lg md:w-64">
                                        <img
                                            src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`}
                                            alt={video.title}
                                            className="h-full w-full object-cover"
                                        />
                                        {video.isOutlier && (
                                            <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 px-2 py-0.5 text-xs font-bold text-black">
                                                OUTLIER
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 space-y-3">
                                        <h3 className="text-lg font-semibold text-white">{video.title}</h3>

                                        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                                            <span>{video.views.toLocaleString()} views</span>
                                            <span>{video.subscriberCount.toLocaleString()} subs</span>
                                            <span className="text-red-400">Viral Score: {video.viralScore.toFixed(0)}/100</span>
                                        </div>

                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-green-400">Why This Video Went Viral:</h4>
                                            {explanations[video.id] ? (
                                                <div className="whitespace-pre-line text-sm text-gray-300">
                                                    {explanations[video.id]}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500">Loading AI analysis...</p>
                                            )}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                            onClick={() => window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank')}
                                        >
                                            Watch on YouTube
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

