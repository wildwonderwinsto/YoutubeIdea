import { useState } from 'react';
import { VideoUpload } from '@/components/VideoUpload';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { AnalysisResults } from '@/components/AnalysisResults';
import { AnalysisResult } from '@/types/analysis';
import { ArrowLeft, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiKeySettings } from '@/components/ApiKeySettings';

type ViewState = 'upload' | 'processing' | 'results';

export function VideoAnalyzer() {
    const [view, setView] = useState<ViewState>('upload');
    const [jobId, setJobId] = useState<string | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleUploadStart = (newJobId: string) => {
        setJobId(newJobId);
        setView('processing');
        setError(null);
    };

    const handleComplete = (analysisResult: AnalysisResult) => {
        setResult(analysisResult);
        setView('results');
    };

    const handleError = (errorMessage: string) => {
        setError(errorMessage);
        console.error('Analysis error:', errorMessage);
    };

    const handleReset = () => {
        setView('upload');
        setJobId(null);
        setResult(null);
        setError(null);
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black px-4 py-12">
            {/* Settings in top-right */}
            {view === 'upload' && (
                <div className="fixed top-6 right-6">
                    <ApiKeySettings />
                </div>
            )}

            {/* Main Content */}
            <div className="mx-auto max-w-4xl w-full">
                {/* Header */}
                <div className="text-center mb-12">
                    {/* Back button for non-upload views */}
                    {view !== 'upload' && (
                        <Button
                            onClick={handleReset}
                            variant="ghost"
                            className="mb-6 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Upload
                        </Button>
                    )}

                    {/* Logo/Title - matching tool card style */}
                    <div className="mb-6 flex items-center justify-center gap-3">
                        <div className="rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-3">
                            <Film className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-5xl font-black text-transparent">
                            ViralVision
                        </h1>
                    </div>

                    {/* Tagline */}
                    <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
                        Video Viral Analyzer
                    </h2>
                    <p className="mb-12 text-lg text-gray-400">
                        Upload your video and get CapCut-style editing instructions.
                        <br />
                        Powered by AI to maximize your viral potential.
                    </p>
                </div>

                {/* Content */}
                {view === 'upload' && (
                    <VideoUpload onUploadStart={handleUploadStart} />
                )}

                {view === 'processing' && jobId && (
                    <AnalysisProgress
                        jobId={jobId}
                        onComplete={handleComplete}
                        onError={handleError}
                    />
                )}

                {view === 'results' && result && (
                    <AnalysisResults result={result} onReset={handleReset} />
                )}

                {error && (
                    <div className="mt-8 rounded-xl border border-red-500 bg-red-950/20 p-6 text-center">
                        <p className="text-red-400 font-semibold mb-2">Analysis Failed</p>
                        <p className="text-red-300 text-sm">{error}</p>
                        <Button onClick={handleReset} variant="outline" className="mt-4">
                            Try Again
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
