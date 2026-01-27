import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Image, Sparkles, Copy, ArrowLeft, Loader2, Palette, Type, MousePointerClick } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { ApiKeySettings } from '@/components/ApiKeySettings';
import { getBackendUrl } from '@/lib/api-config';

interface ThumbnailConcept {
    name: string;
    mainVisual: string;
    textOverlay: string;
    colorScheme: string;
    emotion: string;
    ctrHook: string;
}

interface GeneratorResult {
    concepts: ThumbnailConcept[];
    designTips: string[];
}

export function ThumbnailGenerator() {
    const [title, setTitle] = useState('');
    const [niche, setNiche] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<GeneratorResult | null>(null);

    // Helper to get auth headers with API key
    const getAuthHeaders = () => {
        const customKey = localStorage.getItem('gemini_api_key');
        return customKey ? { 'x-api-key': customKey } : {};
    };

    const handleGenerate = async () => {
        if (!title.trim()) {
            toast({ title: 'Title required', description: 'Please enter your video title', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const prompt = `Create 3 distinct, high-CTR thumbnail concepts for this YouTube video:

Title: "${title}"
Niche/Context: ${niche || 'General'}

For each concept, provide:
1. Main Visual: Focal point description
2. Text Overlay: Exact text to put on image (keep it short, under 5 words)
3. Color Scheme: Dominant colors
4. Emotion: What feeling it evokes
5. CTR Hook: Why would someone click?

Also provide 5 actionable design tips for this specific type of video.

Respond ONLY in valid JSON format:
{
  "concepts": [
    {
      "name": "Concept Name",
      "mainVisual": "Description",
      "textOverlay": "Text",
      "colorScheme": "Colors",
      "emotion": "Feeling",
      "ctrHook": "Reason"
    }
  ],
  "designTips": ["tip1", "tip2"]
}`;

            const response = await fetch(`${getBackendUrl()}/api/gemini/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(getAuthHeaders() as Record<string, string>)
                },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) throw new Error('Generation failed');

            const data = await response.json();
            const text = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(text);

            setResult(parsed);
        } catch (error) {
            console.error('Thumbnail generation failed:', error);
            toast({ title: 'Error', description: 'Failed to generate concepts. Try listing specific niche.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        setResult(null);
        setTitle('');
        setNiche('');
    };

    const copyConcept = (concept: ThumbnailConcept) => {
        const text = `Thumbnail Concept: ${concept.name}
Visual: ${concept.mainVisual}
Text: ${concept.textOverlay}
Colors: ${concept.colorScheme}`;
        navigator.clipboard.writeText(text);
        toast({ title: 'Concept copied', description: 'Ready to paste to your designer or AI image generator' });
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
                    {result && (
                        <Button
                            onClick={handleBack}
                            variant="ghost"
                            className="mb-6 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Input
                        </Button>
                    )}

                    {/* Branding - Matching Image Icon */}
                    <div className="mb-6 flex items-center justify-center gap-3">
                        <div className="rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 p-3">
                            <Image className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-5xl font-black text-transparent">
                            ViralVision
                        </h1>
                    </div>

                    <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
                        Thumbnail Generator
                    </h2>
                    <p className="text-lg text-gray-400">
                        The CTR Machine: AI-powered concepts to maximize clicks
                    </p>
                </div>

                {/* Input Form */}
                {!result && (
                    <div className="mx-auto max-w-2xl bg-gray-900/50 p-8 rounded-2xl border border-gray-800 backdrop-blur-sm">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300">
                                    Video Title
                                </label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., I Survived 100 Days in Minecraft Hardcore"
                                    className="bg-gray-800 border-gray-700 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300">
                                    Niche / Context (Optional)
                                </label>
                                <Input
                                    value={niche}
                                    onChange={(e) => setNiche(e.target.value)}
                                    placeholder="e.g., Gaming, Gaming Challenge, Education..."
                                    className="bg-gray-800 border-gray-700 text-white"
                                />
                            </div>

                            <Button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className="w-full bg-cyan-600 hover:bg-cyan-700 h-12 text-lg"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" />
                                        Dreaming up concepts...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-5 w-5" />
                                        Generate 3 Viral Concepts
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Results Grid */}
                {result && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">

                        {/* Concepts */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {result.concepts.map((concept, idx) => (
                                <Card key={idx} className="bg-gray-900/50 border-gray-800 hover:border-cyan-500/30 transition-all flex flex-col">
                                    <div className="h-2 bg-gradient-to-r from-cyan-500 to-blue-500 w-full rounded-t-xl" />
                                    <CardContent className="p-6 flex-1 flex flex-col">
                                        <h3 className="text-xl font-bold text-white mb-4">{concept.name}</h3>

                                        <div className="space-y-4 flex-1">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
                                                    <Image className="h-3 w-3" /> Visual
                                                </p>
                                                <p className="text-gray-300 text-sm">{concept.mainVisual}</p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
                                                    <Type className="h-3 w-3" /> Text Overlay
                                                </p>
                                                <p className="text-white font-mono text-sm bg-black/30 p-2 rounded border border-gray-700">
                                                    "{concept.textOverlay}"
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
                                                    <Palette className="h-3 w-3" /> Colors
                                                </p>
                                                <p className="text-gray-400 text-sm">{concept.colorScheme}</p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
                                                    <MousePointerClick className="h-3 w-3" /> Why Click?
                                                </p>
                                                <p className="text-cyan-400 text-sm italic">{concept.ctrHook}</p>
                                            </div>
                                        </div>

                                        <Button
                                            variant="secondary"
                                            className="w-full mt-6"
                                            onClick={() => copyConcept(concept)}
                                        >
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy Prompt
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Design Tips */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-yellow-400" />
                                Pro Design Tips for this Video
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {result.designTips.map((tip, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                                        <div className="min-w-[24px] h-6 flex items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold border border-cyan-500/30">
                                            {i + 1}
                                        </div>
                                        <p className="text-gray-300 text-sm">{tip}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
