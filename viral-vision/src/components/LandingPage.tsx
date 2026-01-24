import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader } from './ui/card';
import { Search, Sparkles } from 'lucide-react';
import { SearchFilters } from '@/types/filters';

interface LandingPageProps {
    onSearch: (niche: string) => void;
    onChannelAnalysis: (url: string) => void;
    isLoading: boolean;
    filters: SearchFilters;
    onFilterChange: (filters: SearchFilters) => void;
}

export function LandingPage({ onSearch, onChannelAnalysis, isLoading }: LandingPageProps) {
    const [nicheInput, setNicheInput] = useState('');
    const [urlInput, setUrlInput] = useState('');

    const exampleNiches = [
        'Fortnite montages',
        'Cooking shorts',
        'Tech reviews',
        'Fitness tips',
        'NBA highlights',
        'Minecraft builds',
    ];

    const handleSubmit = () => {
        if (nicheInput.trim()) {
            onSearch(nicheInput.trim());
        } else if (urlInput.trim()) {
            onChannelAnalysis(urlInput.trim());
        }
    };

    const isYouTubeUrl = (url: string) => {
        return url.includes('youtube.com') || url.includes('youtu.be');
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black px-4 py-12">
            {/* Hero Section */}
            <div className="mx-auto max-w-4xl text-center">
                {/* Logo/Title */}
                <div className="mb-6 flex items-center justify-center gap-3">
                    <div className="rounded-full bg-gradient-to-r from-red-500 to-orange-500 p-3">
                        <Sparkles className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-5xl font-black text-transparent">
                        ViralVision
                    </h1>
                </div>

                {/* Tagline */}
                <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
                    Find Your Next Viral Video Idea
                </h2>
                <p className="mb-12 text-lg text-gray-400">
                    Discover trending content from small channels with high viral potential.
                    <br />
                    Get data-driven recommendations tailored to your niche.
                </p>

                {/* Input Section */}
                <Card className="mx-auto max-w-2xl border-white/10 bg-gray-900/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row justify-end p-6 pb-0">
                        {/* Filters removed from landing page per user request */}
                    </CardHeader>

                    <CardContent className="space-y-6 p-8 pt-2">
                        {/* Niche Input */}
                        <div className="space-y-2">
                            <label className="text-left text-sm font-medium text-gray-300">
                                Enter your niche
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    placeholder="e.g., Fortnite montages, Cooking shorts..."
                                    value={nicheInput}
                                    onChange={(e) => {
                                        setNicheInput(e.target.value);
                                        setUrlInput(''); // Clear URL input when typing niche
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                    className="flex-1 border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-gray-700" />
                            <span className="text-sm text-gray-500">OR</span>
                            <div className="h-px flex-1 bg-gray-700" />
                        </div>

                        {/* URL Input */}
                        <div className="space-y-2">
                            <label className="text-left text-sm font-medium text-gray-300">
                                Paste your YouTube channel URL
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    type="url"
                                    placeholder="https://www.youtube.com/@yourchannel"
                                    value={urlInput}
                                    onChange={(e) => {
                                        setUrlInput(e.target.value);
                                        setNicheInput(''); // Clear niche input when typing URL
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                    className={`flex-1 border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 ${urlInput && !isYouTubeUrl(urlInput) ? 'border-red-500' : ''
                                        }`}
                                    disabled={isLoading}
                                />
                            </div>
                            {urlInput && !isYouTubeUrl(urlInput) && (
                                <p className="text-sm text-red-400">Please enter a valid YouTube URL</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <Button
                            size="lg"
                            className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-lg font-bold text-white hover:from-red-600 hover:to-orange-600"
                            onClick={handleSubmit}
                            disabled={isLoading || (!nicheInput && !urlInput) || (Boolean(urlInput) && !isYouTubeUrl(urlInput))}
                        >
                            <Search className="mr-2 h-5 w-5" />
                            {isLoading ? 'Analyzing...' : 'Analyze Trends'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Example Niches */}
                <div className="mt-8">
                    <p className="mb-4 text-sm text-gray-400">Trending Example Niches:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {exampleNiches.map((niche) => (
                            <Button
                                key={niche}
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setNicheInput(niche);
                                    setUrlInput('');
                                }}
                                disabled={isLoading}
                                className="border-gray-700 text-gray-300 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                            >
                                {niche}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-12 space-y-2 text-xs text-gray-500">
                    <p className="flex items-center justify-center gap-1">
                        <span className="text-gray-400">ℹ️</span>
                        Retention tiers and suggestions are AI estimates based on public signals.
                    </p>
                    <p className="flex items-center justify-center gap-1">
                        <span className="text-gray-400">⚠️</span>
                        Always add your own unique angle. Do not re-upload other creators' content.
                    </p>
                    <p className="text-gray-600">
                        Saved ideas are stored in your browser only and may reset if you clear your data.
                    </p>
                </div>
            </div>
        </div>
    );
}
 
