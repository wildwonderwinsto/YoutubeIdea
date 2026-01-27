import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle, Film, MessageSquare, BarChart3, Volume2, Sparkles } from 'lucide-react';
import { getBackendUrl } from '@/lib/api-config';
import { AnalysisJobStatus } from '@/types/analysis';

interface AnalysisProgressProps {
    jobId: string;
    onComplete: (result: any) => void;
    onError: (error: string) => void;
}

const STEPS = [
    { id: 'upload', label: 'Video uploaded', icon: Film },
    { id: 'audio', label: 'Extracting audio', icon: Volume2 },
    { id: 'transcript', label: 'Transcribing speech', icon: MessageSquare },
    { id: 'scenes', label: 'Detecting scenes', icon: BarChart3 },
    { id: 'analysis', label: 'AI analysis', icon: Sparkles }
];

export function AnalysisProgress({ jobId, onComplete, onError }: AnalysisProgressProps) {
    const [status, setStatus] = useState<AnalysisJobStatus | null>(null);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const pollStatus = async () => {
            try {
                const response = await fetch(`${getBackendUrl()}/api/analyze/status/${jobId}`);
                const data: AnalysisJobStatus = await response.json();

                setStatus(data);

                // Update current step based on progress
                if (data.progress) {
                    if (data.progress < 20) setCurrentStep(1);
                    else if (data.progress < 60) setCurrentStep(2);
                    else if (data.progress < 75) setCurrentStep(3);
                    else if (data.progress < 100) setCurrentStep(4);
                }

                if (data.status === 'complete' && data.result) {
                    onComplete(data.result);
                } else if (data.status === 'error') {
                    onError(data.error || 'Analysis failed');
                }
            } catch (error) {
                console.error('Status poll error:', error);
            }
        };

        // Poll every 3 seconds
        const interval = setInterval(pollStatus, 3000);
        pollStatus(); // Initial call

        return () => clearInterval(interval);
    }, [jobId, onComplete, onError]);

    if (!status) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">
                    Analyzing Your Video
                </h2>
                <p className="text-gray-400">
                    Job ID: <span className="font-mono text-sm">{jobId}</span>
                </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">
                        {status.step || 'Processing...'}
                    </span>
                    <span className="text-sm font-medium text-gray-300">
                        {status.progress || 0}%
                    </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 ease-out"
                        style={{ width: `${status.progress || 0}%` }}
                    />
                </div>
            </div>

            {/* Step Indicators */}
            <div className="space-y-4">
                {STEPS.map((step, index) => {
                    const isComplete = index < currentStep;
                    const isCurrent = index === currentStep;
                    const Icon = step.icon;

                    return (
                        <div
                            key={step.id}
                            className={`
                                flex items-center gap-4 p-4 rounded-xl border transition-all
                                ${isCurrent ? 'border-blue-500 bg-blue-950/20' : ''}
                                ${isComplete ? 'border-green-500/30 bg-green-950/10' : ''}
                                ${!isCurrent && !isComplete ? 'border-gray-800 bg-gray-900/50' : ''}
                            `}
                        >
                            <div className={`
                                flex items-center justify-center w-10 h-10 rounded-full
                                ${isComplete ? 'bg-green-500' : ''}
                                ${isCurrent ? 'bg-blue-500' : ''}
                                ${!isCurrent && !isComplete ? 'bg-gray-800' : ''}
                            `}>
                                {isComplete ? (
                                    <CheckCircle2 className="h-5 w-5 text-white" />
                                ) : isCurrent ? (
                                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                                ) : (
                                    <Icon className="h-5 w-5 text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className={`font-medium ${isCurrent || isComplete ? 'text-white' : 'text-gray-400'}`}>
                                    {step.label}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Estimated Time */}
            {status.duration && (
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-400">
                        Video duration: {Math.floor(status.duration / 60)}:{Math.floor(status.duration % 60).toString().padStart(2, '0')}
                    </p>
                </div>
            )}

            {/* Warning */}
            <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-950/10 p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-200">
                        You can safely close this tab. Bookmark this page or save your Job ID to check results later.
                    </p>
                </div>
            </div>
        </div>
    );
}
