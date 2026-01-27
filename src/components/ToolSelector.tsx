import { Film, Search, Users, Hash, Video, Image } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { ApiKeySettings } from './ApiKeySettings';

interface ToolSelectorProps {
    onSelectTool: (tool: 'niche-finder' | 'video-analyzer' | 'channel-finder' | 'keyword-tool' | 'video-similarity' | 'thumbnail-generator') => void;
}

const tools = [
    {
        id: 'video-analyzer' as const,
        title: 'Video Analyzer',
        description: 'Upload your video and get CapCut-style editing instructions with viral scoring',
        icon: Film,
        color: 'from-blue-500 to-indigo-600',
        badge: 'NEW'
    },
    {
        id: 'niche-finder' as const,
        title: 'Niche Finder',
        description: 'Discover trending content from small channels with high viral potential',
        icon: Search,
        color: 'from-red-500 to-orange-500',
        badge: null
    },
    {
        id: 'channel-finder' as const,
        title: 'Channel Finder',
        description: 'Find similar channels based on a YouTube channel URL',
        icon: Users,
        color: 'from-purple-500 to-pink-500',
        badge: 'NEW'
    },
    {
        id: 'keyword-tool' as const,
        title: 'Keyword Research',
        description: 'Find trending keywords and topics in your niche',
        icon: Hash,
        color: 'from-green-500 to-teal-500',
        badge: 'NEW'
    },
    {
        id: 'video-similarity' as const,
        title: 'Video Similarity',
        description: 'Find videos similar to a specific YouTube video',
        icon: Video,
        color: 'from-yellow-500 to-amber-500',
        badge: 'NEW'
    },
    {
        id: 'thumbnail-generator' as const,
        title: 'Thumbnail Generator',
        description: 'Create eye-catching thumbnails with AI-powered design suggestions',
        icon: Image,
        color: 'from-cyan-500 to-blue-500',
        badge: 'NEW'
    }
];

export function ToolSelector({ onSelectTool }: ToolSelectorProps) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black px-4 py-12">
            {/* Settings in top-right */}
            <div className="fixed top-6 right-6">
                <ApiKeySettings />
            </div>

            <div className="mx-auto max-w-6xl w-full">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="mb-6 flex items-center justify-center gap-3">
                        <h1 className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-5xl md:text-6xl font-black text-transparent">
                            ViralVision
                        </h1>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                        Your Complete YouTube Growth Toolkit
                    </h2>
                    <p className="text-lg text-gray-400">
                        Choose a tool to get started
                    </p>
                </div>

                {/* Tool Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tools.map((tool) => {
                        const Icon = tool.icon;
                        const isDisabled = tool.badge === 'COMING SOON';

                        return (
                            <Card
                                key={tool.id}
                                onClick={() => !isDisabled && onSelectTool(tool.id)}
                                className={`
                                    group relative overflow-hidden border-gray-800 bg-gray-900/50 backdrop-blur-sm
                                    transition-all duration-300
                                    ${isDisabled
                                        ? 'opacity-60 cursor-not-allowed'
                                        : 'cursor-pointer hover:border-gray-700 hover:bg-gray-900 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20'
                                    }
                                `}
                            >
                                <CardContent className="p-6">
                                    {/* Badge */}
                                    {tool.badge && (
                                        <div className="absolute top-4 right-4">
                                            <span className={`
                                                px-2 py-1 text-xs font-bold rounded-full
                                                ${tool.badge === 'NEW' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}
                                            `}>
                                                {tool.badge}
                                            </span>
                                        </div>
                                    )}

                                    {/* Icon */}
                                    <div className={`
                                        mb-4 inline-block rounded-xl p-3
                                        bg-gradient-to-br ${tool.color}
                                        ${!isDisabled && 'group-hover:scale-110 transition-transform'}
                                        relative
                                    `}>
                                        <Icon className="h-8 w-8 text-white" />
                                    </div>

                                    {/* Title & Description */}
                                    <h3 className="text-xl font-bold text-white mb-2">
                                        {tool.title}
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                        {tool.description}
                                    </p>

                                    {/* Hover Effect */}
                                    {!isDisabled && (
                                        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                                            Launch Tool
                                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="mt-12 text-center text-sm text-gray-500">
                    <p>💡 Tip: Add your own API keys in Settings (top-right) for unlimited usage</p>
                </div>
            </div>
        </div>
    );
}
