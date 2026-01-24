import { useState } from 'react';
import { Video } from '@/types/video';
import { Card, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Trophy, ExternalLink, Bookmark, Download, Terminal } from 'lucide-react';
import { toast } from './ui/use-toast';

interface VideoCardProps {
    video: Video;
    onSave?: () => void;
    isSaved?: boolean;
}

export function VideoCard({ video, onSave, isSaved }: VideoCardProps) {
    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const formatTimeAgo = (date: Date) => {
        const hours = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60));
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return `${Math.floor(days / 7)}w ago`;
    };

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const thumbnailUrl = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
    const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;
    const [isDownloading, setIsDownloading] = useState(false);

    return (
        <Card className="group relative overflow-hidden border-white/10 bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm transition-all hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/20">
            {/* Outlier Badge */}
            {video.isOutlier && (
                <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 px-2.5 py-1 text-xs font-bold text-black shadow-lg">
                    <Trophy className="h-3 w-3" />
                    <span>OUTLIER</span>
                </div>
            )}

            {/* Thumbnail */}
            <div className="relative aspect-video w-full overflow-hidden bg-gray-900">
                <img
                    src={thumbnailUrl}
                    alt={video.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-white">
                    {formatDuration(video.lengthSeconds)}
                </div>
            </div>

            <CardContent className="space-y-3 p-4">
                {/* Title */}
                <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-white">
                    {video.title}
                </h3>

                {/* Channel Info */}
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <div>
                        <p className="font-medium text-gray-300">{video.channelName}</p>
                        <p>{formatNumber(video.subscriberCount)} subs</p>
                    </div>
                    <div className="text-right">
                        <p className="font-medium text-gray-300">{formatNumber(video.views)} views</p>
                        <p>{formatTimeAgo(video.publishedAt)}</p>
                    </div>
                </div>

                {/* Metrics */}
                <div className="space-y-2">
                    {/* Viral Score */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Viral Score</span>
                        <span className="text-sm font-bold text-red-400">
                            {video.viralScore.toFixed(0)}/100
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                        <div
                            className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all"
                            style={{ width: `${video.viralScore}%` }}
                        />
                    </div>

                    {/* AVD & Engagement */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded bg-gray-800/50 p-2">
                            <p className="text-gray-500">AVD Tier</p>
                            <p className={`font-semibold ${video.estimatedAVDTier === 'High' ? 'text-green-400' :
                                video.estimatedAVDTier === 'Medium' ? 'text-yellow-400' :
                                    'text-gray-400'
                                }`}>
                                {video.estimatedAVDTier}
                            </p>
                        </div>
                        <div className="rounded bg-gray-800/50 p-2">
                            <p className="text-gray-500">Engagement</p>
                            <p className="font-semibold text-blue-400">
                                {(video.engagementRate * 100).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="flex gap-2 p-4 pt-0">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => window.open(youtubeUrl, '_blank')}
                >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Watch
                </Button>
                <div className="flex flex-1 gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isDownloading}
                        className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-50"
                        onClick={async () => {
                            if (isDownloading) return;
                            setIsDownloading(true);

                            try {
                                await navigator.clipboard.writeText(youtubeUrl);
                                window.open('https://cobalt.tools', '_blank');
                                toast({
                                    title: "Link copied!",
                                    description: "Paste it in the downloader we just opened for you.",
                                });
                            } catch (error) {
                                // Fallback for browsers without clipboard API
                                const textarea = document.createElement('textarea');
                                textarea.value = youtubeUrl;
                                document.body.appendChild(textarea);
                                textarea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textarea);

                                toast({
                                    title: "Link copied!",
                                    description: "Paste it in the downloader we just opened for you.",
                                });
                            } finally {
                                setTimeout(() => setIsDownloading(false), 2000);
                            }
                        }}
                    >
                        <Download className="mr-1 h-3 w-3" />
                        Download
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="w-9 border-gray-700 bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white"
                        onClick={() => {
                            navigator.clipboard.writeText(`yt-dlp "${youtubeUrl}"`);
                            toast({
                                title: "Command copied!",
                                description: "Run this in your terminal to download with yt-dlp.",
                            });
                        }}
                        title="Copy yt-dlp command"
                    >
                        <Terminal className="h-3 w-3" />
                    </Button>
                </div>
                {onSave && (
                    <Button
                        variant={isSaved ? 'default' : 'outline'}
                        size="sm"
                        className={isSaved ? 'flex-1 bg-red-500 text-white hover:bg-red-600' : 'flex-1 border-gray-600 hover:bg-gray-800'}
                        onClick={onSave}
                    >
                        <Bookmark className="mr-1 h-3 w-3" />
                        {isSaved ? 'Saved' : 'Save'}
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}


