import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Video, Network, ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { ApiKeySettings } from '@/components/ApiKeySettings';
import { getBackendUrl } from '@/lib/api-config';

interface RelatedVideo {
    videoId: string;
    title: string;
    channelName: string;
    thumbnailUrl: string;
}

export function VideoSimilarity() {
    const [videoUrl, setVideoUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<RelatedVideo[]>([]);
    const [targetVideoId, setTargetVideoId] = useState<string | null>(null);

    const extractVideoId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const handleSearch = async () => {
        const id = extractVideoId(videoUrl);
        if (!id) {
            toast({ title: 'Invalid URL', description: 'Please enter a valid YouTube video URL', variant: 'destructive' });
            return;
        }

        setTargetVideoId(id);
        setIsLoading(true);
        setResults([]);

        try {
            const response = await fetch(`${getBackendUrl()}/api/youtube/related?videoId=${id}`);
            const data = await response.json();

            if (data.relatedVideos && data.relatedVideos.length > 0) {
                setResults(data.relatedVideos);
            } else {
                toast({
                    title: 'No related videos found',
                    description: 'Could not scrape related videos. YouTube might be blocking requests.',
                    variant: 'destructive'
                });
            }
        } catch (error) {
            console.error('Error fetching related videos:', error);
            toast({ title: 'Error', description: 'Failed to fetch related videos', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        setResults([]);
        setVideoUrl('');
        setTargetVideoId(null);
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
                    {results.length > 0 && (
                        <Button
                            onClick={handleBack}
                            variant="ghost"
                            className="mb-6 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Search
                        </Button>
                    )}

                    {/* Branding - Matching Video Icon */}
                    <div className="mb-6 flex items-center justify-center gap-3">
                        <div className="rounded-full bg-gradient-to-br from-yellow-500 to-amber-500 p-3">
                            <Video className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-5xl font-black text-transparent">
                            ViralVision
                        </h1>
                    </div>

                    <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
                        Video Similarity
                    </h2>
                    <p className="text-lg text-gray-400">
                        The Algo Hacker: See what YouTube recommends next to your competitors
                    </p>
                </div>

                {/* Search Input */}
                {results.length === 0 && (
                    <div className="mx-auto max-w-2xl bg-gray-900/50 p-8 rounded-2xl border border-gray-800 backdrop-blur-sm">
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-300">
                                Enter Target Video URL
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    placeholder="e.g., https://www.youtube.com/watch?v=..."
                                    className="bg-gray-800 border-gray-700 text-white"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Button
                                    onClick={handleSearch}
                                    disabled={isLoading}
                                    className="bg-amber-600 hover:bg-amber-700 min-w-[120px]"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'Scan Algo'}
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500">
                                Find out which videos are stealing traffic from this video
                            </p>
                        </div>
                    </div>
                )}

                {/* Results Grid */}
                {results.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-gray-900/50 border border-amber-500/20 rounded-2xl p-6 mb-8">
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <Network className="h-5 w-5 text-amber-400" />
                                Algorithm Recommendations
                            </h3>
                            <p className="text-gray-400 text-sm">
                                YouTube suggests these {results.length} videos next. Create content that beats these to steal the "Suggested Video" traffic.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {results.map((video) => (
                                <Card key={video.videoId} className="bg-gray-900/50 border-gray-800 hover:border-amber-500/30 transition-all group">
                                    <div className="aspect-video relative overflow-hidden rounded-t-xl">
                                        <img
                                            src={video.thumbnailUrl}
                                            alt={video.title}
                                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                    <CardContent className="p-4">
                                        <h4 className="font-bold text-white line-clamp-2 mb-2 group-hover:text-amber-400 transition-colors">
                                            {video.title}
                                        </h4>
                                        <p className="text-sm text-gray-400 mb-4">{video.channelName}</p>

                                        <Button
                                            variant="outline"
                                            className="w-full text-xs border-gray-700 hover:bg-amber-900/20 hover:text-amber-300"
                                            onClick={() => window.open(`https://youtube.com/watch?v=${video.videoId}`, '_blank')}
                                        >
                                            Watch Video <ExternalLink className="ml-1 h-3 w-3" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
