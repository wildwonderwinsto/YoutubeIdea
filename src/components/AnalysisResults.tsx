import { Download, TrendingUp, Scissors, PackageOpen, CheckSquare, Star } from 'lucide-react';
import { Button } from './ui/button';
import { AnalysisResult } from '@/types/analysis';

interface AnalysisResultsProps {
    result: AnalysisResult;
    onReset: () => void;
}

export function AnalysisResults({ result, onReset }: AnalysisResultsProps) {
    const downloadResults = () => {
        const dataStr = JSON.stringify(result, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `viral-analysis-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    const getScoreBarColor = (score: number) => {
        if (score >= 80) return 'bg-green-500';
        if (score >= 60) return 'bg-yellow-500';
        if (score >= 40) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const subscoresArray = [
        { name: 'Hook Strength', ...result.subscores.hook },
        { name: 'Pacing & Flow', ...result.subscores.pacing },
        { name: 'Visual Variety', ...result.subscores.visualVariety },
        { name: 'Emotional Impact', ...result.subscores.emotionalImpact },
        { name: 'Clarity', ...result.subscores.clarity },
        { name: 'CTAs', ...result.subscores.ctas }
    ];

    return (
        <div className="w-full max-w-6xl mx-auto space-y-8">
            {/* Header with Actions */}
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-white">Analysis Complete</h2>
                <div className="flex gap-3">
                    <Button onClick={downloadResults} variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export Results
                    </Button>
                    <Button onClick={onReset}>
                        Analyze Another Video
                    </Button>
                </div>
            </div>

            {/* Viral Score Card */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-8">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-3">
                            <TrendingUp className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white">Viral Readiness Score</h3>
                    </div>
                    <div className="flex items-end gap-8">
                        <div>
                            <div className={`text-7xl font-bold ${getScoreColor(result.viralScore)}`}>
                                {result.viralScore}
                            </div>
                            <p className="text-gray-400 mt-2">out of 100</p>
                        </div>
                        <div className="flex-1 pb-4">
                            <p className="text-lg text-gray-300 mb-4">
                                <span className="font-semibold text-white">Biggest Issue:</span>{' '}
                                {result.biggestProblem}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-blue-600/10 to-transparent" />
            </div>

            {/* Subscores Grid */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Detailed Breakdown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {subscoresArray.map((sub) => (
                        <div key={sub.name} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-white">{sub.name}</span>
                                <span className={`text-lg font-bold ${getScoreColor(sub.score * 10)}`}>
                                    {sub.score}/10
                                </span>
                            </div>
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                                <div
                                    className={`h-full ${getScoreBarColor(sub.score * 10)} transition-all`}
                                    style={{ width: `${sub.score * 10}%` }}
                                />
                            </div>
                            <p className="text-sm text-gray-400">{sub.why}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Plan Timeline */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Scissors className="h-5 w-5" />
                    CapCut-Style Edit Instructions
                </h3>
                <div className="space-y-3">
                    {result.editPlan.map((edit, index) => (
                        <div key={index} className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                            <div className="flex items-start gap-4">
                                <div className="rounded-lg bg-blue-600/20 px-3 py-1 text-sm font-mono text-blue-400 flex-shrink-0">
                                    {edit.timestamp}
                                </div>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Action</p>
                                        <p className="text-white">{edit.action}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Visual</p>
                                        <p className="text-gray-300">{edit.visual}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Audio</p>
                                        <p className="text-gray-300">{edit.audio}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Goal</p>
                                        <p className="text-gray-400 italic">{edit.goal}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Packaging Suggestions */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <PackageOpen className="h-5 w-5" />
                    Packaging Suggestions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                        <h4 className="font-semibold text-white mb-3">Title Ideas</h4>
                        <ul className="space-y-2">
                            {result.packaging.titles.map((title, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <span className="text-blue-400 mt-1">→</span>
                                    <span className="text-gray-300">{title}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                        <h4 className="font-semibold text-white mb-3">Thumbnail Concepts</h4>
                        <ul className="space-y-2">
                            {result.packaging.thumbnails.map((thumb, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <span className="text-green-400 mt-1">→</span>
                                    <span className="text-gray-300">{thumb}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                    <h4 className="font-semibold text-white mb-3">Target Audience</h4>
                    <div className="flex flex-wrap gap-2">
                        {result.packaging.audience.map((aud, index) => (
                            <span key={index} className="px-3 py-1 rounded-full bg-purple-600/20 text-purple-300 text-sm">
                                {aud}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Checklist */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <CheckSquare className="h-5 w-5" />
                    Pre-Upload Checklist
                </h3>
                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                    <ul className="space-y-2">
                        {result.checklist.map((item, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <div className="mt-0.5 h-5 w-5 rounded border-2 border-gray-600" />
                                <span className="text-gray-300">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
