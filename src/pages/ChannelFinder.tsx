import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Search, TrendingUp, Calendar, ArrowRight, ArrowLeft } from 'lucide-react';
import { analyzeChannel, extractChannelId } from '@/lib/channel-finder-api';
import { SimilarChannel, ChannelAnalysis } from '@/types/channel';
import { toast } from '@/components/ui/use-toast';
import { ApiKeySettings } from '@/components/ApiKeySettings';

export function ChannelFinder() {
    const [urlInput, setUrlInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState<ChannelAnalysis | null>(null);

    const handleSearch = async () => {
        if (!urlInput.trim()) return;

        // Try to extract ID or handle
        let idOrHandle = extractChannelId(urlInput);
        if (!idOrHandle) {
            // Allow searching by exact handle/name if extraction fails
            idOrHandle = urlInput.trim();
        }

        setIsLoading(true);
        try {
            const result = await analyzeChannel(idOrHandle);
            setAnalysis(result);
            toast({
                title: 'Analysis Complete',
                description: `Found ${result.similarChannels.length} similar channels for ${result.targetChannel.title}`
            });
        } catch (error) {
            console.error('Channel analysis error:', error);
            const msg = error instanceof Error ? error.message : 'Failed to analyze channel';
            toast({
                title: 'Error',
                description: msg,
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        setAnalysis(null);
        setUrlInput('');
    };

    // Format numbers compactly (e.g., 1.2M)
    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('en-US', {
            notation: "compact",
            maximumFractionDigits: 1
        }).format(num);
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-gray-950 via-gray-900 to-black px-4 py-12">

            {/* Settings */}
            <div className="fixed top-6 right-6 z-50">
                <ApiKeySettings />
            </div>

            <div className="mx-auto max-w-6xl w-full">
                {/* Header */}
                <div className="text-center mb-12">
                    {/* Back Button */}
                    {analysis && (
                        <Button
                            onClick={handleBack}
                            variant="ghost"
                            className="mb-6 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Search
                        </Button>
                    )}

                    {/* Branding */}
                    <div className="mb-6 flex items-center justify-center gap-3">
                        <div className="rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-3">
                            <Users className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-5xl font-black text-transparent">
                            ViralVision
                        </h1>
                    </div>

                    <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
                        Channel Finder
                    </h2>
                    <p className="text-lg text-gray-400">
                        The Competitor Spy: Find similar channels and analyze their strategy
                    </p>
                </div>

                {/* Search Input State */}
                {!analysis && (
                    <div className="mx-auto max-w-2xl bg-gray-900/50 p-8 rounded-2xl border border-gray-800 backdrop-blur-sm">
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-300">
                                Enter Channel URL or Handle
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="e.g., https://youtube.com/@MrBeast or @MrBeast"
                                    className="bg-gray-800 border-gray-700 text-white"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Button
                                    onClick={handleSearch}
                                    disabled={isLoading}
                                    className="bg-purple-600 hover:bg-purple-700 min-w-[120px]"
                                >
                                    {isLoading ? 'Analyzing...' : 'Find Similar'}
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500">
                                Works with any public YouTube channel URL or handle
                            </p>
                        </div>
                    </div>
                )}

                {/* Results State */}
                {analysis && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Target Channel Overview */}
                        <div className="bg-gray-900/50 border border-purple-500/20 rounded-2xl p-6">
                            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                                <img
                                    src={analysis.targetChannel.thumbnailUrl}
                                    alt={analysis.targetChannel.title}
                                    className="w-24 h-24 rounded-full border-2 border-purple-500"
                                />
                                <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-2xl font-bold text-white mb-2">
                                        Analysis: {analysis.targetChannel.title}
                                    </h3>
                                    <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                                        {analysis.keywords.map(k => (
                                            <span key={k} className="px-2 py-1 bg-purple-500/10 text-purple-300 text-xs rounded-full border border-purple-500/20">
                                                #{k}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-center md:text-left">
                                        <div>
                                            <p className="text-gray-400 text-xs uppercase">Subscribers</p>
                                            <p className="text-xl font-bold text-white">{formatNumber(analysis.targetChannel.subscriberCount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400 text-xs uppercase">Videos</p>
                                            <p className="text-xl font-bold text-white">{formatNumber(analysis.targetChannel.videoCount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400 text-xs uppercase">Uploads</p>
                                            <p className="text-xl font-bold text-white">{analysis.targetChannel.uploadFrequency}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Similar Channels Grid */}
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                                <TrendingUp className="h-6 w-6 text-green-400" />
                                Similar Channels found
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {analysis.similarChannels.map((channel) => (
                                    <Card key={channel.id} className="bg-gray-900/50 border-gray-800 hover:border-purple-500/30 transition-all">
                                        <CardContent className="p-5">
                                            {/* Channel Header */}
                                            <div className="flex items-center gap-3 mb-4">
                                                <img
                                                    src={channel.thumbnailUrl}
                                                    alt={channel.title}
                                                    className="w-12 h-12 rounded-full"
                                                />
                                                <div className="overflow-hidden">
                                                    <h4 className="font-bold text-white truncate">{channel.title}</h4>
                                                    <p className="text-sm text-gray-400">{formatNumber(channel.subscriberCount)} subs</p>
                                                </div>
                                            </div>

                                            {/* Stats */}
                                            <div className="flex items-center justify-between text-sm py-3 border-t border-gray-800 border-b mb-3">
                                                <div className="flex items-center gap-1 text-gray-400">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>{channel.uploadFrequency}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-gray-400">
                                                    <span>{formatNumber(channel.videoCount)} vids</span>
                                                </div>
                                            </div>

                                            {/* Top Video (If available) */}
                                            {channel.topVideo && (
                                                <div className="bg-black/20 rounded p-2">
                                                    <p className="text-xs text-gray-500 uppercase mb-1">Recent Upload</p>
                                                    <p className="text-xs text-gray-300 line-clamp-2 hover:text-white cursor-pointer"
                                                        onClick={() => window.open(`https://youtube.com/watch?v=${channel.topVideo?.id}`, '_blank')}>
                                                        {channel.topVideo.title}
                                                    </p>
                                                </div>
                                            )}

                                            <Button
                                                variant="outline"
                                                className="w-full mt-4 text-xs h-8 border-gray-700 hover:bg-purple-900/20 hover:text-purple-300"
                                                onClick={() => window.open(`https://youtube.com/${channel.handle || 'channel/' + channel.id}`, '_blank')}
                                            >
                                                Visit Channel <ArrowRight className="ml-1 h-3 w-3" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
