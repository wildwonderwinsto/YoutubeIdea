import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Settings, Key, CheckCircle2, XCircle, Loader2, Eye, EyeOff, AlertCircle, ExternalLink, Copy, Info, Trash2, HelpCircle, Shield, Globe } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from './ui/use-toast';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

interface TestResult {
    youtube: TestStatus;
    gemini: TestStatus;
    youtubeMessage?: string;
    geminiMessage?: string;
    youtubeQuota?: {
        used: number;
        remaining: number;
    };
}

export function ApiKeySettings() {
    const { preferences, updateApiKeys } = useLocalStorage();
    const [youtubeKey, setYoutubeKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [showYoutubeKey, setShowYoutubeKey] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [testResults, setTestResults] = useState<TestResult>({
        youtube: 'idle',
        gemini: 'idle'
    });
    const [activeTab, setActiveTab] = useState<'youtube' | 'gemini'>('youtube');

    // Load saved keys when dialog opens
    useEffect(() => {
        if (isOpen) {
            setYoutubeKey(preferences.apiKeys?.youtube || '');
            setGeminiKey(preferences.apiKeys?.gemini || '');
            setHasChanges(false);
            setTestResults({ youtube: 'idle', gemini: 'idle' });
        }
    }, [isOpen, preferences.apiKeys?.youtube, preferences.apiKeys?.gemini]);

    // Track changes
    useEffect(() => {
        const ytChanged = youtubeKey !== (preferences.apiKeys?.youtube || '');
        const gmChanged = geminiKey !== (preferences.apiKeys?.gemini || '');
        setHasChanges(ytChanged || gmChanged);
    }, [youtubeKey, geminiKey, preferences.apiKeys]);

    const testYouTubeKey = async (key: string): Promise<void> => {
        const keyToTest = key.trim() || import.meta.env.VITE_YOUTUBE_API_KEY;

        if (!keyToTest) {
            setTestResults(prev => ({
                ...prev,
                youtube: 'error',
                youtubeMessage: 'No API key provided'
            }));
            return;
        }

        setTestResults(prev => ({ ...prev, youtube: 'testing' }));

        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=googledevelopers&key=${keyToTest}`
            );

            if (response.ok) {
                setTestResults(prev => ({
                    ...prev,
                    youtube: 'success',
                    youtubeMessage: 'API key is valid and working!'
                }));
            } else {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.error?.message || 'Invalid API key or quota exceeded';
                setTestResults(prev => ({
                    ...prev,
                    youtube: 'error',
                    youtubeMessage: message
                }));
            }
        } catch (error: any) {
            setTestResults(prev => ({
                ...prev,
                youtube: 'error',
                youtubeMessage: 'Network error. Check your connection.'
            }));
        }
    };

    const testGeminiKey = async (key: string): Promise<void> => {
        const keyToTest = key.trim() || import.meta.env.VITE_GEMINI_API_KEY;

        if (!keyToTest) {
            setTestResults(prev => ({
                ...prev,
                gemini: 'error',
                geminiMessage: 'No API key provided'
            }));
            return;
        }

        setTestResults(prev => ({ ...prev, gemini: 'testing' }));

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${keyToTest}`
            );

            if (response.ok) {
                setTestResults(prev => ({
                    ...prev,
                    gemini: 'success',
                    geminiMessage: 'API key is valid and working!'
                }));
            } else {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.error?.message || 'Invalid API key';
                setTestResults(prev => ({
                    ...prev,
                    gemini: 'error',
                    geminiMessage: message
                }));
            }
        } catch (error: any) {
            setTestResults(prev => ({
                ...prev,
                gemini: 'error',
                geminiMessage: 'Network error. Check your connection.'
            }));
        }
    };

    const handleSave = () => {
        if (!youtubeKey.trim() && !geminiKey.trim()) {
            toast({
                title: "Validation Error",
                description: "Please add at least one API key before saving.",
                variant: "destructive"
            });
            return;
        }

        updateApiKeys({
            youtube: youtubeKey.trim(),
            gemini: geminiKey.trim()
        });

        setIsOpen(false);
        toast({
            title: "Settings Saved",
            description: "Your API keys have been securely stored in browser storage.",
        });
    };

    const handleClearAll = () => {
        setYoutubeKey('');
        setGeminiKey('');
        setTestResults({ youtube: 'idle', gemini: 'idle' });
    };

    const handleReset = () => {
        setYoutubeKey(preferences.apiKeys?.youtube || '');
        setGeminiKey(preferences.apiKeys?.gemini || '');
        setTestResults({ youtube: 'idle', gemini: 'idle' });
    };

    const handleRemoveKeys = () => {
        updateApiKeys({ youtube: '', gemini: '' });
        setYoutubeKey('');
        setGeminiKey('');
        toast({
            title: "Keys Removed",
            description: "Custom API keys have been removed. Using system defaults.",
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({
                title: "Copied!",
                description: "API key copied to clipboard.",
            });
        });
    };

    const hasYoutubeKey = !!preferences.apiKeys?.youtube;
    const hasGeminiKey = !!preferences.apiKeys?.gemini;
    const getLast4 = (str: string) => str && str.length > 4 ? `...${str.slice(-4)}` : '';

    const StatusIcon = ({ status }: { status: TestStatus }) => {
        switch (status) {
            case 'testing':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-green-400" />;
            case 'error':
                return <XCircle className="h-4 w-4 text-red-400" />;
            default:
                return <AlertCircle className="h-4 w-4 text-gray-500" />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-white hover:bg-gray-800 relative"
                    title="API Configuration"
                >
                    <Settings className="h-5 w-5" />
                    {(hasYoutubeKey || hasGeminiKey) && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-gray-900" />
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="border-gray-800 bg-gray-900 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl text-white">
                        <div className="rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 p-2">
                            <Settings className="h-5 w-5 text-white" />
                        </div>
                        API Configuration
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Configure your API keys for YouTube Data API and Google Gemini. Keys are stored locally in your browser.
                    </DialogDescription>
                </DialogHeader>

                {/* Security Notice */}
                <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-4">
                    <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-blue-300">Security & Privacy</p>
                            <p className="text-xs text-blue-200/80">
                                Your API keys are stored <strong>locally in your browser only</strong> using localStorage.
                                They are never sent to any third-party servers except the official Google APIs.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-gray-800 pb-2">
                    <button
                        onClick={() => setActiveTab('youtube')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'youtube'
                                ? 'bg-red-500/20 text-red-400 border-b-2 border-red-500'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        <Globe className="h-4 w-4" />
                        YouTube API
                        {hasYoutubeKey && <span className="h-2 w-2 rounded-full bg-green-500" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('gemini')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'gemini'
                                ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-500'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        <Key className="h-4 w-4" />
                        Gemini API
                        {hasGeminiKey && <span className="h-2 w-2 rounded-full bg-green-500" />}
                    </button>
                </div>

                {/* YouTube Tab */}
                {activeTab === 'youtube' && (
                    <div className="space-y-4">
                        {/* Status Badge */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${hasYoutubeKey
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-gray-700/50 text-gray-400'
                                    }`}>
                                    {hasYoutubeKey ? (
                                        <>
                                            <CheckCircle2 className="h-3 w-3" />
                                            Custom Key Active
                                        </>
                                    ) : (
                                        <>
                                            <Info className="h-3 w-3" />
                                            Using System Default
                                        </>
                                    )}
                                </div>
                            </div>
                            {hasYoutubeKey && (
                                <span className="text-xs text-gray-500">
                                    Ends in: <code className="text-gray-400">{getLast4(preferences.apiKeys?.youtube || '')}</code>
                                </span>
                            )}
                        </div>

                        {/* API Key Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-200">
                                API Key
                            </label>
                            <div className="relative">
                                <Input
                                    type={showYoutubeKey ? "text" : "password"}
                                    placeholder="AIzaSy..."
                                    value={youtubeKey}
                                    onChange={(e) => setYoutubeKey(e.target.value)}
                                    className="pr-20 border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                    >
                                        {showYoutubeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                    {youtubeKey && (
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(youtubeKey)}
                                            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">
                                Required for searching videos and channel data. Leave empty to use system default.
                            </p>
                        </div>

                        {/* Test Button & Result */}
                        <div className="space-y-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => testYouTubeKey(youtubeKey)}
                                disabled={testResults.youtube === 'testing'}
                                className="w-full border-gray-700 hover:bg-gray-800"
                            >
                                {testResults.youtube === 'testing' ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Testing Connection...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="mr-2 h-4 w-4" />
                                        Test Connection
                                    </>
                                )}
                            </Button>

                            {testResults.youtube !== 'idle' && (
                                <div className={`rounded-lg border p-3 flex items-start gap-3 ${testResults.youtube === 'success'
                                        ? 'border-green-500/30 bg-green-950/20'
                                        : testResults.youtube === 'error'
                                            ? 'border-red-500/30 bg-red-950/20'
                                            : 'border-blue-500/30 bg-blue-950/20'
                                    }`}>
                                    <StatusIcon status={testResults.youtube} />
                                    <div className="flex-1">
                                        <p className={`text-sm font-medium ${testResults.youtube === 'success'
                                                ? 'text-green-300'
                                                : testResults.youtube === 'error'
                                                    ? 'text-red-300'
                                                    : 'text-blue-300'
                                            }`}>
                                            {testResults.youtube === 'success' ? 'Connection Successful' : 'Connection Failed'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {testResults.youtubeMessage}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Help Links */}
                        <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
                            <div className="flex items-start gap-2">
                                <HelpCircle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-400">Need help getting an API key?</p>
                                    <a
                                        href="https://console.cloud.google.com/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        Google Cloud Console
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Gemini Tab */}
                {activeTab === 'gemini' && (
                    <div className="space-y-4">
                        {/* Status Badge */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${hasGeminiKey
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-gray-700/50 text-gray-400'
                                    }`}>
                                    {hasGeminiKey ? (
                                        <>
                                            <CheckCircle2 className="h-3 w-3" />
                                            Custom Key Active
                                        </>
                                    ) : (
                                        <>
                                            <Info className="h-3 w-3" />
                                            Using System Default
                                        </>
                                    )}
                                </div>
                            </div>
                            {hasGeminiKey && (
                                <span className="text-xs text-gray-500">
                                    Ends in: <code className="text-gray-400">{getLast4(preferences.apiKeys?.gemini || '')}</code>
                                </span>
                            )}
                        </div>

                        {/* API Key Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-200">
                                API Key
                            </label>
                            <div className="relative">
                                <Input
                                    type={showGeminiKey ? "text" : "password"}
                                    placeholder="AIzaSy..."
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    className="pr-20 border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                    >
                                        {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                    {geminiKey && (
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(geminiKey)}
                                            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">
                                Required for generating strategy insights and content ideas. Leave empty to use system default.
                            </p>
                        </div>

                        {/* Test Button & Result */}
                        <div className="space-y-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => testGeminiKey(geminiKey)}
                                disabled={testResults.gemini === 'testing'}
                                className="w-full border-gray-700 hover:bg-gray-800"
                            >
                                {testResults.gemini === 'testing' ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Testing Connection...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="mr-2 h-4 w-4" />
                                        Test Connection
                                    </>
                                )}
                            </Button>

                            {testResults.gemini !== 'idle' && (
                                <div className={`rounded-lg border p-3 flex items-start gap-3 ${testResults.gemini === 'success'
                                        ? 'border-green-500/30 bg-green-950/20'
                                        : testResults.gemini === 'error'
                                            ? 'border-red-500/30 bg-red-950/20'
                                            : 'border-blue-500/30 bg-blue-950/20'
                                    }`}>
                                    <StatusIcon status={testResults.gemini} />
                                    <div className="flex-1">
                                        <p className={`text-sm font-medium ${testResults.gemini === 'success'
                                                ? 'text-green-300'
                                                : testResults.gemini === 'error'
                                                    ? 'text-red-300'
                                                    : 'text-blue-300'
                                            }`}>
                                            {testResults.gemini === 'success' ? 'Connection Successful' : 'Connection Failed'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {testResults.geminiMessage}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Help Links */}
                        <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
                            <div className="flex items-start gap-2">
                                <HelpCircle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-400">Need help getting an API key?</p>
                                    <a
                                        href="https://aistudio.google.com/app/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        Google AI Studio
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            disabled={!hasChanges}
                            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50"
                        >
                            Reset
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleClearAll}
                            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                        >
                            Clear Form
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        {(hasYoutubeKey || hasGeminiKey) && (
                            <Button
                                variant="outline"
                                onClick={handleRemoveKeys}
                                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove All Keys
                            </Button>
                        )}
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Save Configuration
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}