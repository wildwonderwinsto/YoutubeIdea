import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Hash, TrendingUp, ArrowLeft, Loader2, Copy, Sparkles } from 'lucide-react';
import { generateKeywords, analyzeKeywords, generateTags, KeywordAnalysis } from '@/lib/keyword-research-api';
import { toast } from '@/components/ui/use-toast';
import { ApiKeySettings } from '@/components/ApiKeySettings';

export function KeywordResearch() {
    const [topicInput, setTopicInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [results, setResults] = useState<KeywordAnalysis[]>([]);
    const [generatedTags, setGeneratedTags] = useState<string[]>([]);
    const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

    // Bulk actions state
    const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
    const [showOptimized, setShowOptimized] = useState(false);

    const handleSearch = async () => {
        if (!topicInput.trim()) return;

        setIsLoading(true);
        setStatus('Finding long-tail keywords...');
        setResults([]);
        setGeneratedTags([]);
        setSelectedKeywords(new Set());
        setSelectedKeyword(null);

        try {
            // 1. Generate keywords via autocomplete
            const suggestions = await generateKeywords(topicInput);

            if (suggestions.length === 0) {
                toast({ title: 'No keywords found', description: 'Try a broader topic', variant: 'destructive' });
                setIsLoading(false);
                return;
            }

            setStatus(`Analyzing ${Math.min(suggestions.length, 20)} keywords with AI...`);

            // 2. Analyze with Gemini
            const analysis = await analyzeKeywords(suggestions);
            setResults(analysis.sort((a, b) => b.viralPotential - a.viralPotential));

        } catch (error) {
            console.error('Keyword research error:', error);
            toast({
                title: 'Error',
                description: 'Failed to analyze keywords',
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
            setStatus('');
        }
    };

    const handleBack = () => {
        setResults([]);
        setTopicInput('');
        setSelectedKeywords(new Set());
        setGeneratedTags([]);
        setSelectedKeyword(null);
    };

    const handleGenerateTags = (keyword: string) => {
        const tags = generateTags(keyword);
        setGeneratedTags(tags);
        setSelectedKeyword(keyword);
    };

    const copyTags = () => {
        navigator.clipboard.writeText(generatedTags.join(', '));
        toast({ title: 'Tags copied to clipboard' });
    };

    // Bulk Actions
    const toggleKeyword = (keyword: string) => {
        const newSet = new Set(selectedKeywords);
        if (newSet.has(keyword)) {
            newSet.delete(keyword);
        } else {
            newSet.add(keyword);
        }
        setSelectedKeywords(newSet);
    };

    const selectAll = () => {
        setSelectedKeywords(new Set(results.map(r => r.keyword)));
    };

    const clearSelection = () => {
        setSelectedKeywords(new Set());
    };

    const getOptimizedKeywords = () => {
        return results.filter(k => k.viralPotential >= 70 && k.saturation === 'Low');
    };

    const copySelected = () => {
        const keywords = Array.from(selectedKeywords);
        navigator.clipboard.writeText(keywords.join(', '));
        toast({
            title: 'Copied!',
            description: `${keywords.length} keywords copied to clipboard`
        });
    };

    const copyOptimized = () => {
        const optimized = getOptimizedKeywords().map(k => k.keyword);
        navigator.clipboard.writeText(optimized.join(', '));
        toast({
            title: 'Optimized keywords copied!',
            description: `${optimized.length} high-potential keywords`
        });
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-gray-400';
    };

    const getSaturationColor = (level: string) => {
        if (level === 'Low') return 'bg-green-500/20 text-green-400 border-green-500/30';
        if (level === 'Medium') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        return 'bg-red-500/20 text-red-400 border-red-500/30';
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

                    {/* Branding */}
                    <div className="mb-6 flex items-center justify-center gap-3">
                        <div className="rounded-full bg-gradient-to-br from-green-500 to-teal-500 p-3">
                            <Hash className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-5xl font-black text-transparent">
                            ViralVision
                        </h1>
                    </div>

                    <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
                        Keyword Research
                    </h2>
                    <p className="text-lg text-gray-400">
                        The SEO Trend Spotter: Find high-demand, low-competition topics
                    </p>
                </div>

                {/* Search Input */}
                {results.length === 0 && (
                    <div className="mx-auto max-w-2xl bg-gray-900/50 p-8 rounded-2xl border border-gray-800 backdrop-blur-sm">
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-300">
                                Enter a broad topic
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={topicInput}
                                    onChange={(e) => setTopicInput(e.target.value)}
                                    placeholder="e.g., Minecraft, Keto Diet, iPhone 16..."
                                    className="bg-gray-800 border-gray-700 text-white"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Button
                                    onClick={handleSearch}
                                    disabled={isLoading}
                                    className="bg-teal-600 hover:bg-teal-700 min-w-[120px]"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'Analyze'}
                                </Button>
                            </div>
                            {isLoading && (
                                <p className="text-sm text-teal-400 animate-pulse text-center mt-2">
                                    {status}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Results Grid */}
                {results.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* Left: Keyword List */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-green-400" />
                                    Top Opportunities
                                </h3>
                            </div>

                            {/* Bulk Actions Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 bg-gray-900/40 p-3 rounded-lg border border-gray-800">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={selectAll}
                                        className="text-gray-300 hover:text-white"
                                    >
                                        All ({results.length})
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearSelection}
                                        disabled={selectedKeywords.size === 0}
                                        className="text-gray-300 hover:text-white"
                                    >
                                        None
                                    </Button>
                                    <div className="h-4 w-px bg-gray-700 mx-2" />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowOptimized(!showOptimized)}
                                        className={showOptimized ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'border-gray-700'}
                                    >
                                        {showOptimized ? 'Show Best Only' : 'Show All'}
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        onClick={copySelected}
                                        disabled={selectedKeywords.size === 0}
                                        className="bg-teal-600 hover:bg-teal-700 h-8"
                                    >
                                        <Copy className="mr-2 h-3 w-3" />
                                        Copy ({selectedKeywords.size})
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={copyOptimized}
                                        className="bg-green-600 hover:bg-green-700 h-8"
                                    >
                                        <Sparkles className="mr-2 h-3 w-3" />
                                        Copy Best
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-3">
                                {(showOptimized ? getOptimizedKeywords() : results).map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`
                                            p-4 rounded-xl border transition-all
                                            ${selectedKeywords.has(item.keyword)
                                                ? 'bg-teal-950/30 border-teal-500 ring-1 ring-teal-500'
                                                : selectedKeyword === item.keyword
                                                    ? 'bg-teal-950/20 border-teal-500/50'
                                                    : 'bg-gray-900/50 border-gray-800 hover:border-teal-500/30'
                                            }
                                        `}
                                    >
                                        <div className="flex items-start gap-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedKeywords.has(item.keyword)}
                                                onChange={() => toggleKeyword(item.keyword)}
                                                className="mt-1.5 h-4 w-4 rounded border-gray-700 bg-gray-800 text-teal-600 focus:ring-teal-500 focus:ring-offset-gray-900 cursor-pointer"
                                            />

                                            <div
                                                className="flex-1 cursor-pointer"
                                                onClick={() => handleGenerateTags(item.keyword)}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-semibold text-white text-lg">{item.keyword}</h4>
                                                    <div className={`px-2 py-0.5 rounded text-xs font-medium border ${getSaturationColor(item.saturation)}`}>
                                                        {item.saturation} Comp.
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-sm">
                                                    <p className="text-gray-400">{item.reasoning}</p>
                                                    <div className="flex items-center gap-1 font-bold pl-4 border-l border-gray-700 ml-4">
                                                        <span className={getScoreColor(item.viralPotential)}>{item.viralPotential}</span>
                                                        <span className="text-gray-500">/100</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Selected Keyword Actions */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-24 space-y-6">
                                <Card className="bg-gray-900/80 border-gray-700 backdrop-blur">
                                    <CardContent className="p-6">
                                        <h3 className="text-lg font-bold text-white mb-4">Tag Generator</h3>

                                        {!selectedKeyword ? (
                                            <div className="text-center py-8 text-gray-500">
                                                <p>Click any keyword on the left to generate optimized tags</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="mb-4">
                                                    <p className="text-sm text-gray-400 mb-1">Selected Keyword</p>
                                                    <p className="text-white font-medium">{selectedKeyword}</p>
                                                </div>

                                                <div className="bg-black/40 rounded-lg p-3 mb-4 min-h-[100px] text-sm text-gray-300 font-mono">
                                                    {generatedTags.join(', ')}
                                                </div>

                                                <Button
                                                    onClick={copyTags}
                                                    className="w-full bg-teal-600 hover:bg-teal-700"
                                                >
                                                    <Copy className="mr-2 h-4 w-4" />
                                                    Copy Tags
                                                </Button>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
