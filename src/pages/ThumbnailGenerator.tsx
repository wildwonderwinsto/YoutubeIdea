import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Image, Sparkles, Copy, ArrowLeft, Loader2, Download } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { ApiKeySettings } from '@/components/ApiKeySettings';
import { getBackendUrl, getAuthHeaders } from '@/lib/api-config';

interface ThumbnailConcept {
    name: string;
    description: string;
    textOverlay: string;
    colorScheme: string;
    layout: string;
    emotion: string;
    ctrHook: string;
    canvaPrompt: string;
    midjourneyPrompt: string;
}

interface GeneratorResult {
    concepts: ThumbnailConcept[];
    designTips: string[];
    colorPalettes: { name: string; colors: string[] }[];
}

export function ThumbnailGenerator() {
    const [title, setTitle] = useState('');
    const [niche, setNiche] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<GeneratorResult | null>(null);

    const handleGenerate = async () => {
        if (!title.trim()) {
            toast({ title: 'Title required', description: 'Please enter your video title', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const prompt = `You are a YouTube thumbnail designer with 10 years of experience creating viral thumbnails.

Create 3 HIGH-CTR thumbnail concepts for this video:

Title: "${title}"
Niche: ${niche || 'General entertainment'}

For EACH concept, provide:
1. **Name**: Short concept title (e.g., "The Shocked Face")
2. **Description**: 2-3 sentences describing the visual composition
3. **Text Overlay**: The exact text to put on thumbnail (MAX 5 words, use ALL CAPS for impact)
4. **Color Scheme**: List 3-4 specific hex colors (e.g., #FF0000, #FFFFFF)
5. **Layout**: Describe the visual hierarchy (what's left/right/center)
6. **Emotion**: Primary emotion to convey (shock, curiosity, excitement, etc.)
7. **CTR Hook**: Why someone would click this specific design
8. **Canva Prompt**: Exact instructions for recreating this in Canva
9. **Midjourney Prompt**: Detailed AI image generation prompt for this concept

Also provide:
- **Design Tips**: 7 specific tips for this niche
- **Color Palettes**: 3 high-converting color combinations with hex codes

Respond in this EXACT JSON format (no markdown, no backticks):

{
  "concepts": [
    {
      "name": "string",
      "description": "string",
      "textOverlay": "string",
      "colorScheme": "string",
      "layout": "string",
      "emotion": "string",
      "ctrHook": "string",
      "canvaPrompt": "string",
      "midjourneyPrompt": "string"
    }
  ],
  "designTips": ["tip1", "tip2", ...],
  "colorPalettes": [
    { "name": "Palette Name", "colors": ["#FF0000", "#FFFFFF", "#000000"] }
  ]
}`;

            const response = await fetch(`${getBackendUrl()}/api/gemini/generate`, {
                method: 'POST',
                headers: getAuthHeaders() as Record<string, string>,
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) throw new Error('Generation failed');

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanText);

            setResult(parsed);
            toast({ title: 'Success!', description: '3 thumbnail concepts generated' });
        } catch (error) {
            console.error('Thumbnail generation failed:', error);
            toast({
                title: 'Error',
                description: 'Failed to generate concepts. Try again or be more specific with niche.',
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        setResult(null);
        setTitle('');
        setNiche('');
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: `${label} copied!`, description: 'Ready to paste into your design tool' });
    };

    const downloadAsTextFile = (concept: ThumbnailConcept) => {
        const content = `THUMBNAIL CONCEPT: ${concept.name}

DESCRIPTION:
${concept.description}

TEXT OVERLAY: ${concept.textOverlay}

COLOR SCHEME: ${concept.colorScheme}

LAYOUT:
${concept.layout}

EMOTION: ${concept.emotion}

WHY IT WORKS:
${concept.ctrHook}

---

CANVA INSTRUCTIONS:
${concept.canvaPrompt}

---

MIDJOURNEY PROMPT:
${concept.midjourneyPrompt}`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${concept.name.replace(/\s+/g, '_')}_thumbnail_brief.txt`;
        a.click();
        URL.revokeObjectURL(url);

        toast({ title: 'Downloaded!', description: 'Concept brief saved as text file' });
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-gray-950 via-gray-900 to-black px-4 py-12">
            <div className="fixed top-6 right-6 z-50">
                <ApiKeySettings />
            </div>

            <div className="mx-auto max-w-7xl w-full">
                {/* Header */}
                <div className="text-center mb-12">
                    {result && (
                        <Button onClick={handleBack} variant="ghost" className="mb-6 text-gray-400 hover:text-white">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Input
                        </Button>
                    )}

                    <div className="mb-6 flex items-center justify-center gap-3">
                        <div className="rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 p-3">
                            <Image className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-5xl font-black text-transparent">
                            ViralVision
                        </h1>
                    </div>

                    <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
                        AI Thumbnail Generator
                    </h2>
                    <p className="text-lg text-gray-400">
                        Professional thumbnail concepts with ready-to-use prompts for Canva & AI tools
                    </p>
                </div>

                {/* Input Form */}
                {!result && (
                    <div className="mx-auto max-w-2xl bg-gray-900/50 p-8 rounded-2xl border border-gray-800 backdrop-blur-sm">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300">
                                    Video Title *
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
                                    Niche (Optional but recommended)
                                </label>
                                <Input
                                    value={niche}
                                    onChange={(e) => setNiche(e.target.value)}
                                    placeholder="e.g., Gaming, Fitness, Tech Reviews, Cooking..."
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
                                        Creating concepts...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-5 w-5" />
                                        Generate 3 Professional Concepts
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                        {/* Thumbnail Concepts */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {result.concepts.map((concept, idx) => (
                                <Card key={idx} className="bg-gray-900/50 border-gray-800 hover:border-cyan-500/30 transition-all">
                                    <div className="h-2 bg-gradient-to-r from-cyan-500 to-blue-500 w-full rounded-t-xl" />
                                    <CardContent className="p-6 space-y-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">{concept.name}</h3>
                                            <p className="text-gray-400 text-sm">{concept.description}</p>
                                        </div>

                                        <div className="bg-black/30 p-3 rounded-lg">
                                            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Text Overlay</p>
                                            <p className="text-white font-black text-lg">{concept.textOverlay}</p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold mb-2">Color Scheme</p>
                                            <div className="flex gap-2">
                                                {concept.colorScheme.match(/#[A-Fa-f0-9]{6}/g)?.map((color, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-10 h-10 rounded border border-gray-700 cursor-pointer hover:scale-110 transition-transform"
                                                        style={{ backgroundColor: color }}
                                                        title={color}
                                                        onClick={() => copyToClipboard(color, 'Color code')}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Layout</p>
                                            <p className="text-gray-300 text-sm">{concept.layout}</p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Why It Clicks</p>
                                            <p className="text-cyan-400 text-sm italic">{concept.ctrHook}</p>
                                        </div>

                                        <div className="pt-4 border-t border-gray-800 space-y-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => copyToClipboard(concept.canvaPrompt, 'Canva instructions')}
                                            >
                                                <Copy className="mr-2 h-4 w-4" />
                                                Copy Canva Instructions
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => copyToClipboard(concept.midjourneyPrompt, 'AI prompt')}
                                            >
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Copy AI Image Prompt
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => downloadAsTextFile(concept)}
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                Download Full Brief
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Color Palettes */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-6">Recommended Color Palettes</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {result.colorPalettes.map((palette, idx) => (
                                    <div key={idx} className="bg-black/30 p-4 rounded-lg">
                                        <p className="font-semibold text-white mb-3">{palette.name}</p>
                                        <div className="flex gap-2 mb-2">
                                            {palette.colors.map((color, i) => (
                                                <div
                                                    key={i}
                                                    className="flex-1 h-12 rounded cursor-pointer hover:scale-105 transition-transform"
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => copyToClipboard(color, 'Color')}
                                                    title={`Click to copy ${color}`}
                                                />
                                            ))}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full text-xs"
                                            onClick={() => copyToClipboard(palette.colors.join(', '), 'Palette')}
                                        >
                                            Copy All Colors
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Design Tips */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-yellow-400" />
                                Pro Design Tips
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {result.designTips.map((tip, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                                        <div className="min-w-[28px] h-7 flex items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold border border-cyan-500/30">
                                            {i + 1}
                                        </div>
                                        <p className="text-gray-300 text-sm pt-0.5">{tip}</p>
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
